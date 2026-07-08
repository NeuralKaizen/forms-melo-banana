import { describe, it, expect } from 'vitest'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from './prompt-preamble'
import type { RespondentInput } from './schema'

const R: RespondentInput[] = [
  { respondentName: 'Ana', role: 'Fundadora', answers: [
    { questionId: 'animal', text: 'un perro, leal', imageChoice: 'perro' },
    { questionId: 'estrategia', text: 'crecer en B2B' },
  ]},
  { respondentName: 'Beto', role: 'CM', answers: [
    { questionId: 'animal', text: 'un león', imageChoice: 'leon' },
  ]},
]

describe('preámbulo compartido', () => {
  it('el preámbulo trae rol, regla de oro y tono', () => {
    expect(PREAMBULO).toMatch(/estratega/i)
    expect(PREAMBULO).toMatch(/no.*invent/i)
    expect(PREAMBULO).toMatch(/colombiano/i)
  })
  it('la instrucción de origen exige cliente|equipo|pendiente y triangular', () => {
    expect(ORIGEN_Y_TRIANGULACION).toMatch(/cliente/); expect(ORIGEN_Y_TRIANGULACION).toMatch(/equipo/)
    expect(ORIGEN_Y_TRIANGULACION).toMatch(/pendiente/); expect(ORIGEN_Y_TRIANGULACION).toMatch(/tensi/i)
  })
  it('formatRespondents incluye nombre, cargo, la pregunta legible y la elección', () => {
    const out = formatRespondents(R)
    expect(out).toContain('Ana'); expect(out).toContain('Fundadora'); expect(out).toContain('Beto')
    expect(out).toMatch(/animal/i)              // prompt legible de la pregunta
    expect(out).toContain('un perro, leal')
    expect(out).toContain('perro')              // imageChoice
  })
})
