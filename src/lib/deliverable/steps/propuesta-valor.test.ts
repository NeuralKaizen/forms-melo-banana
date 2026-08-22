import { describe, it, expect } from 'vitest'
import { buildPropuestaValorPrompt, validatePropuestaValor } from './propuesta-valor'
import type { RespondentInput, Problema, Perfil } from '../schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'estrategia', text: 'x' }] }]
const PROB: Problema = { problemaMundo: 'm', problemaMarca: 'x', problemaConsumidor: [], comoLoHacemos: [], porQueRelevante: [] }
const PERF: Perfil = { jobs: [{ texto: 'Quiero poder adoptar IA', origen: 'cliente' }], gains: [], pains: [] }

describe('paso propuesta de valor', () => {
  it('el prompt pide una fila por JTBD (sin fórmula ni síntesis), e inyecta los jobs del perfil', () => {
    const p = buildPropuestaValorPrompt(R, PROB, PERF)
    expect(p).toMatch(/pain reliever|gain creator|una fila/i)
    expect(p).not.toMatch(/fórmula|síntesis/i)
    expect(p).toContain('Quiero poder adoptar IA')  // job del perfil
  })
  it('validatePropuestaValor acepta forma correcta', () => {
    const ok = { filas: [{ job: 'adoptar IA', solucion: 'acompañamiento', comoSeResuelve: 'de punta a punta', origen: 'equipo' }] }
    expect(validatePropuestaValor(ok).filas[0].job).toBe('adoptar IA')
  })
  it('validatePropuestaValor rechaza una fila sin origen válido', () => {
    expect(() => validatePropuestaValor({ filas: [{ job: 'x', solucion: 's', comoSeResuelve: 'c', origen: 'nadie' }] })).toThrow()
  })
})
