import { describe, it, expect } from 'vitest'
import { generateDeliverable } from './generator'
import type { RespondentInput } from './schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'animal', text: 'perro' }] }]

// client falso: mira el prompt y responde el JSON del paso correspondiente
function fakeClient(opts: { failCompetencia?: boolean } = {}) {
  const byStep = (prompt: string) => {
    if (/LECTURA PROYECTIVA/.test(prompt)) return '{"arquetipo":"cercano","atributos":[],"queNoQuiereSer":[],"tensiones":[]}'
    if (/DECLARACIÓN DEL PROBLEMA/.test(prompt)) return '{"problemaMundo":"m","problemaMarca":"x","problemaConsumidor":[],"comoLoHacemos":[],"porQueRelevante":[]}'
    if (/PANORAMA DE LA CATEGORÍA/.test(prompt)) {
      if (opts.failCompetencia) return 'no json'
      return '{"competidores":[],"otrosReferentes":[],"ejes":[{"nombre":"a","extremoIzquierdo":"i","extremoDerecho":"d","origen":"equipo"},{"nombre":"b","extremoIzquierdo":"i","extremoDerecho":"d","origen":"equipo"}],"posicionActual":{"texto":"a","origen":"equipo"},"posicionIdeal":{"texto":"b","origen":"equipo"}}'
    }
    if (/PERFIL DE USUARIO/.test(prompt)) return '{"jobs":[],"gains":[],"pains":[]}'
    if (/PROPUESTA DE VALOR/.test(prompt)) return '{"formula":{"marca":"M","verbo":"v","razonDeSer":"r","beneficioCentral":"b"},"filas":[]}'
    return '{}'
  }
  return { messages: { create: async (a: any) => ({ content: [{ type: 'text', text: byStep(a.messages.at(-1).content) }] }) } } as any
}

describe('generateDeliverable', () => {
  it('run completo produce las 5 partes con generatedAt', async () => {
    const d = await generateDeliverable(fakeClient(), R)
    for (const k of ['personalidad', 'problema', 'competencia', 'perfil', 'propuestaValor'] as const) {
      expect(d[k]!.data).not.toBeNull()
      expect(d[k]!.meta.generatedAt).toBeTruthy()
    }
  })
  it('un paso que falla queda aislado; los demás se conservan', async () => {
    const d = await generateDeliverable(fakeClient({ failCompetencia: true }), R)
    expect(d.competencia!.data).toBeNull()
    expect(d.competencia!.meta.error).toBeTruthy()
    expect(d.personalidad!.data).not.toBeNull()
    expect(d.propuestaValor!.data).not.toBeNull()  // no depende de competencia
  })
  it('only=perfil reusa problema+personalidad de prev', async () => {
    const prev = await generateDeliverable(fakeClient(), R)
    const d = await generateDeliverable(fakeClient(), R, { only: 'perfil', prev })
    expect(d.perfil!.data).not.toBeNull()
    expect(d.problema).toEqual(prev.problema)       // no regeneró la dependencia
  })
  it('only con dependencia ausente lanza error', async () => {
    await expect(generateDeliverable(fakeClient(), R, { only: 'perfil', prev: {} })).rejects.toThrow()
  })
  it('run completo con prev bueno conserva competencia previa si el paso fresco falla', async () => {
    const prev = await generateDeliverable(fakeClient(), R)
    const d = await generateDeliverable(fakeClient({ failCompetencia: true }), R, { prev })
    expect(d.competencia!.data).not.toBeNull()
    expect(d.competencia).toEqual(prev.competencia)
  })
  it('only=competencia con prev bueno conserva la previa si falla', async () => {
    const prev = await generateDeliverable(fakeClient(), R)
    const d = await generateDeliverable(fakeClient({ failCompetencia: true }), R, { only: 'competencia', prev })
    expect(d.competencia!.data).not.toBeNull()
    expect(d.competencia).toEqual(prev.competencia)
  })
})
