import { describe, it, expect } from 'vitest'
import { buildCompetenciaPrompt, validateCompetencia } from './competencia'
import type { RespondentInput } from '../schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'estrategia', text: 'competimos con Platzi' }] }]

describe('paso competencia', () => {
  it('el prompt pide competidores, 4 ejes y posición actual/ideal, marcando aportes del equipo', () => {
    const p = buildCompetenciaPrompt(R)
    expect(p).toMatch(/competidor/i); expect(p).toMatch(/EXACTAMENTE 4 ejes/)
    expect(p).toMatch(/posición.*ideal/i); expect(p).toMatch(/equipo/i)
  })
  // Regresión: el prompt decía `Item[]` sin describir el tipo, y el modelo devolvía
  // {"nombre": ...} o {"descripcion": ...}. validateCompetencia lo rechazaba y la parte
  // fallaba SIEMPRE, incluso tras el reintento. Verificado contra el modelo real.
  it('el prompt describe la forma del Item, porque el modelo no conoce el tipo', () => {
    const p = buildCompetenciaPrompt(R)
    expect(p).toContain('"texto"')
    expect(p).toContain('"origen"')
    expect(p).toContain('"cita"')
  })

  const CUATRO_EJES = [
    { nombre: 'accesibilidad', extremoIzquierdo: 'accesible', extremoDerecho: 'poco accesible', origen: 'equipo' },
    { nombre: 'credibilidad', extremoIzquierdo: 'menor', extremoDerecho: 'mayor', origen: 'equipo' },
    { nombre: 'precio', extremoIzquierdo: 'económico', extremoDerecho: 'premium', origen: 'equipo' },
    { nombre: 'cercanía', extremoIzquierdo: 'distante', extremoDerecho: 'cercana', origen: 'equipo' },
  ]

  it('validateCompetencia acepta forma correcta con 4 ejes', () => {
    const ok = {
      competidores: [{ texto: 'Platzi', origen: 'cliente' }],
      otrosReferentes: [{ marca: 'Lovable', tipo: 'referente de marca', origen: 'equipo' }],
      ejes: CUATRO_EJES,
      posicionActual: { texto: 'centro-izq', origen: 'equipo' },
      posicionIdeal: { texto: 'arriba-der', origen: 'equipo' },
    }
    expect(validateCompetencia(ok).ejes).toHaveLength(4)
  })

  it('validateCompetencia rechaza cualquier cantidad de ejes que no sea 4', () => {
    const base = {
      competidores: [], otrosReferentes: [],
      posicionActual: { texto: 'a', origen: 'equipo' }, posicionIdeal: { texto: 'b', origen: 'equipo' },
    }
    expect(() => validateCompetencia({ ...base, ejes: CUATRO_EJES.slice(0, 2) })).toThrow(/4/)
    expect(() => validateCompetencia({ ...base, ejes: [...CUATRO_EJES, CUATRO_EJES[0]] })).toThrow(/4/)
  })
  it('validateCompetencia rechaza referente sin tipo', () => {
    expect(() => validateCompetencia({ competidores: [], otrosReferentes: [{ marca: 'X' }], ejes: [],
      posicionActual: { texto: 'a', origen: 'equipo' }, posicionIdeal: { texto: 'b', origen: 'equipo' } })).toThrow()
  })
})
