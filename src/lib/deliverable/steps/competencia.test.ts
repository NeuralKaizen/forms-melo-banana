import { describe, it, expect } from 'vitest'
import { buildCompetenciaPrompt, validateCompetencia } from './competencia'
import type { RespondentInput } from '../schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'estrategia', text: 'competimos con Platzi' }] }]

describe('paso competencia', () => {
  it('el prompt pide competidores, 2 ejes y posición actual/ideal, marcando aportes del equipo', () => {
    const p = buildCompetenciaPrompt(R)
    expect(p).toMatch(/competidor/i); expect(p).toMatch(/eje/i)
    expect(p).toMatch(/posición.*ideal/i); expect(p).toMatch(/equipo/i)
  })
  it('validateCompetencia acepta forma correcta con 2 ejes', () => {
    const ok = {
      competidores: [{ texto: 'Platzi', origen: 'cliente' }],
      otrosReferentes: [{ marca: 'Lovable', tipo: 'referente de marca', origen: 'equipo' }],
      ejes: [
        { nombre: 'accesibilidad', extremoIzquierdo: 'accesible', extremoDerecho: 'poco accesible', origen: 'equipo' },
        { nombre: 'credibilidad', extremoIzquierdo: 'menor', extremoDerecho: 'mayor', origen: 'equipo' },
      ],
      posicionActual: { texto: 'centro-izq', origen: 'equipo' },
      posicionIdeal: { texto: 'arriba-der', origen: 'equipo' },
    }
    expect(validateCompetencia(ok).ejes).toHaveLength(2)
  })
  it('validateCompetencia rechaza referente sin tipo', () => {
    expect(() => validateCompetencia({ competidores: [], otrosReferentes: [{ marca: 'X' }], ejes: [],
      posicionActual: { texto: 'a', origen: 'equipo' }, posicionIdeal: { texto: 'b', origen: 'equipo' } })).toThrow()
  })
})
