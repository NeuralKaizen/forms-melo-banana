import type Anthropic from '@anthropic-ai/sdk'
import type { PropuestaValor, FilaValor, Problema, Perfil, RespondentInput, Origen } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { callJson } from '../llm'

const GUIA = [
  'PASO 4 — PROPUESTA DE VALOR (lado derecho del canvas + síntesis).',
  'Primero sintetizá la propuesta de valor con esta fórmula:',
  '  En [marca], [verbo] [razón de ser]. Somos [beneficio central].',
  'Después mapeá CADA job del perfil con su pain reliever / gain creator y una descripción',
  'de cómo se resuelve (una fila por job). Marcá el origen de cada fila.',
].join('\n')

export function buildPropuestaValorPrompt(respondents: RespondentInput[], problema: Problema, perfil: Perfil): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Jobs to be done del perfil (paso previo)',
    perfil.jobs.map(j => `- ${j.texto}`).join('\n') || '- (ninguno; márcalo pendiente)',
    `Impacto/relevancia: ${problema.porQueRelevante.map(i => i.texto).join(' | ') || '—'}`,
    '', '## Respuestas de los respondientes', formatRespondents(respondents), '',
    'Devolvé SOLO JSON con esta forma:',
    '{"formula": {"marca": string, "verbo": string, "razonDeSer": string, "beneficioCentral": string},',
    ' "filas": [{"job": string, "solucion": string, "comoSeResuelve": string, "origen": Origen}]}',
  ].join('\n')
}

const ORIGENES: Origen[] = ['cliente', 'equipo', 'pendiente']

export function validatePropuestaValor(o: unknown): PropuestaValor {
  const p = o as any
  const f = p?.formula
  if (!f || ['marca', 'verbo', 'razonDeSer', 'beneficioCentral'].some(k => typeof f[k] !== 'string'))
    throw new Error('fórmula incompleta')
  const filas: FilaValor[] = (Array.isArray(p?.filas) ? p.filas : []).map((r: any) => {
    if (typeof r?.job !== 'string' || typeof r?.solucion !== 'string'
      || typeof r?.comoSeResuelve !== 'string' || !ORIGENES.includes(r?.origen)) throw new Error('Fila inválida')
    return { job: r.job, solucion: r.solucion, comoSeResuelve: r.comoSeResuelve, origen: r.origen }
  })
  return { formula: { marca: f.marca, verbo: f.verbo, razonDeSer: f.razonDeSer, beneficioCentral: f.beneficioCentral }, filas }
}

export function runPropuestaValor(client: Anthropic, respondents: RespondentInput[], problema: Problema, perfil: Perfil): Promise<PropuestaValor> {
  return callJson(client, buildPropuestaValorPrompt(respondents, problema, perfil), 3000, validatePropuestaValor)
}
