import type Anthropic from '@anthropic-ai/sdk'
import type { Deliverable, PartKey, RespondentInput, Part } from './schema'
import { runPersonalidad } from './steps/personalidad'
import { runProblema } from './steps/problema'
import { runCompetencia } from './steps/competencia'
import { runPerfil } from './steps/perfil'
import { runPropuestaValor } from './steps/propuesta-valor'

const now = () => new Date().toISOString()
const ok = <T>(data: T): Part<T> => ({ data, meta: { generatedAt: now(), error: null } })
const fail = (error: unknown): Part<never> => ({ data: null, meta: { generatedAt: now(), error: String(error) } })

// Regeneración de una sola parte: usa dependencias de prev; si falta, error claro.
async function regenOne(client: Anthropic, respondents: RespondentInput[], only: PartKey, prev: Deliverable): Promise<Deliverable> {
  const need = (k: PartKey) => {
    const p = prev[k]
    if (!p || !p.data) throw new Error(`No se puede regenerar "${only}": falta la dependencia "${k}". Generá el entregable completo primero.`)
    return p.data as any
  }
  const out: Deliverable = { ...prev }
  try {
    if (only === 'personalidad') out.personalidad = ok(await runPersonalidad(client, respondents))
    else if (only === 'problema') out.problema = ok(await runProblema(client, respondents, need('personalidad')))
    else if (only === 'competencia') out.competencia = ok(await runCompetencia(client, respondents))
    else if (only === 'perfil') out.perfil = ok(await runPerfil(client, respondents, need('problema'), need('personalidad')))
    else if (only === 'propuestaValor') out.propuestaValor = ok(await runPropuestaValor(client, respondents, need('problema'), need('perfil')))
  } catch (e) {
    // errores de dependencia ausente se propagan; errores del LLM se marcan en la parte
    if (String(e).includes('falta la dependencia')) throw e
    out[only] = (prev[only]?.data ? prev[only] : fail(e)) as any
  }
  return out
}

export async function generateDeliverable(
  client: Anthropic,
  respondents: RespondentInput[],
  opts: { only?: PartKey; prev?: Deliverable } = {},
): Promise<Deliverable> {
  if (opts.only) return regenOne(client, respondents, opts.only, opts.prev ?? {})

  const prev = opts.prev ?? {}
  const keep = (k: PartKey, part: Part<any>): Part<any> =>
    part.data ? part : ((prev[k]?.data ? prev[k] : part) as Part<any>)

  const out: Deliverable = {}
  // paso 0
  try { out.personalidad = keep('personalidad', ok(await runPersonalidad(client, respondents))) }
  catch (e) { out.personalidad = keep('personalidad', fail(e) as any) }
  // paso 1 (dep personalidad)
  if (out.personalidad?.data) {
    try { out.problema = keep('problema', ok(await runProblema(client, respondents, out.personalidad.data))) }
    catch (e) { out.problema = keep('problema', fail(e) as any) }
  } else out.problema = keep('problema', fail('dependencia personalidad falló') as any)
  // paso 2 (independiente)
  try { out.competencia = keep('competencia', ok(await runCompetencia(client, respondents))) }
  catch (e) { out.competencia = keep('competencia', fail(e) as any) }
  // paso 3 (dep problema + personalidad)
  if (out.problema?.data && out.personalidad?.data) {
    try { out.perfil = keep('perfil', ok(await runPerfil(client, respondents, out.problema.data, out.personalidad.data))) }
    catch (e) { out.perfil = keep('perfil', fail(e) as any) }
  } else out.perfil = keep('perfil', fail('dependencia problema/personalidad falló') as any)
  // paso 4 (dep problema + perfil)
  if (out.problema?.data && out.perfil?.data) {
    try { out.propuestaValor = keep('propuestaValor', ok(await runPropuestaValor(client, respondents, out.problema.data, out.perfil.data))) }
    catch (e) { out.propuestaValor = keep('propuestaValor', fail(e) as any) }
  } else out.propuestaValor = keep('propuestaValor', fail('dependencia problema/perfil falló') as any)

  return out
}
