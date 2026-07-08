import { describe, it, expect } from 'vitest'
import { buildPersonalidadPrompt, validatePersonalidad } from './personalidad'
import type { RespondentInput } from '../schema'

const R: RespondentInput[] = [
  { respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'animal', text: 'perro, leal', imageChoice: 'perro' }] },
  { respondentName: 'Beto', role: 'CM', answers: [{ questionId: 'genero', text: 'mujer', imageChoice: 'mujer' }] },
]

describe('paso personalidad', () => {
  it('el prompt trae preámbulo, respondientes y pide las metáforas proyectivas', () => {
    const p = buildPersonalidadPrompt(R)
    expect(p).toMatch(/estratega/i)          // preámbulo
    expect(p).toContain('Ana')               // respondientes
    expect(p).toMatch(/animal|color|género|olor|ciudad/i) // lectura proyectiva
    expect(p).toMatch(/arquetipo/i)
  })
  it('validatePersonalidad acepta forma correcta', () => {
    const ok = { arquetipo: 'cercano', atributos: ['leal'], queNoQuiereSer: ['frío'], tensiones: ['género mixto'] }
    expect(validatePersonalidad(ok)).toEqual(ok)
  })
  it('validatePersonalidad rechaza forma incorrecta', () => {
    expect(() => validatePersonalidad({ arquetipo: 'x' })).toThrow()
  })
})
