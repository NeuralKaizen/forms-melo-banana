import { describe, it, expect } from 'vitest'
import { buildPerfilPrompt, validatePerfil } from './perfil'
import type { RespondentInput, Problema, Personalidad } from '../schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'estrategia', text: 'quieren productividad' }] }]
const PROB: Problema = { problemaMundo: 'm', problemaMarca: 'x',
  problemaConsumidor: [{ texto: 'no saben empezar', origen: 'cliente' }], comoLoHacemos: [], porQueRelevante: [] }
const PERS: Personalidad = { arquetipo: 'cercano', atributos: [], queNoQuiereSer: [], tensiones: [] }

describe('paso perfil', () => {
  it('el prompt pide jobs (Quiero poder…), gains y pains e inyecta el problema', () => {
    const p = buildPerfilPrompt(R, PROB, PERS)
    expect(p).toMatch(/jobs to be done|quiero poder/i)
    expect(p).toMatch(/gains/i); expect(p).toMatch(/pains/i)
    expect(p).toContain('no saben empezar')       // viene del problema
  })
  it('validatePerfil acepta y rechaza correctamente', () => {
    const ok = { jobs: [{ texto: 'Quiero poder X', origen: 'cliente' }], gains: [], pains: [] }
    expect(validatePerfil(ok).jobs).toHaveLength(1)
    expect(() => validatePerfil({ jobs: 'x', gains: [], pains: [] })).toThrow()
  })
})
