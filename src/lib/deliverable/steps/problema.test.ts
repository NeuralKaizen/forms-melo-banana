import { describe, it, expect } from 'vitest'
import { buildProblemaPrompt, validateProblema } from './problema'
import type { RespondentInput, Personalidad } from '../schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'estrategia', text: 'crecer en B2B' }] }]
const PERS: Personalidad = { arquetipo: 'cercano', atributos: ['cálido'], queNoQuiereSer: ['frío', 'corporativo'], tensiones: [] }

describe('paso problema', () => {
  it('el prompt inyecta la personalidad (qué NO quiere ser) y pide los 5 bloques', () => {
    const p = buildProblemaPrompt(R, PERS)
    expect(p).toContain('corporativo')                 // viene de personalidad
    expect(p).toMatch(/mundo|consumidor/i)
    expect(p).toMatch(/cómo.*hacer/i)
    expect(p).toMatch(/relevante/i)
  })
  it('validateProblema acepta forma correcta con Items marcados', () => {
    const ok = {
      problemaMundo: 'p1', problemaMarca: 'p2',
      problemaConsumidor: [{ texto: 'no saben empezar', origen: 'cliente', cita: 'no sé por dónde' }],
      comoLoHacemos: [{ texto: 'marca cálida', origen: 'cliente' }],
      porQueRelevante: [{ texto: 'desbloquea crecimiento', origen: 'equipo' }],
    }
    expect(validateProblema(ok).problemaConsumidor[0].origen).toBe('cliente')
  })
  it('validateProblema rechaza origen inválido', () => {
    expect(() => validateProblema({ problemaMundo: 'a', problemaMarca: 'b',
      problemaConsumidor: [{ texto: 't', origen: 'inventado' }], comoLoHacemos: [], porQueRelevante: [] })).toThrow()
  })
})
