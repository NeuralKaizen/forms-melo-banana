import { describe, it, expect } from 'vitest'
import { validarContenidoEstrategia } from './validar-estrategia'
import { ErrorDeHerramienta } from './errores'

const validos: Record<string, unknown> = {
  diagnostico: { problema: 'p', insight: 'i', ventaja: 'v', diferenciales: ['d1'] },
  consumidor: { metodologia: 'm', frases: ['f1'] },
  rtbs: { items: ['r1'] },
  concepto: { concepto: 'c', racional: 'r' },
  beneficios: { funcionales: ['f'], emocionales: ['e'] },
  arquetipo: { arquetipo: 'a', justificacion: 'j' },
  personalidad: { rasgos: ['r'] },
  valores: { items: [{ valor: 'v', validacion: 'ok' }] },
  territorio: { texto: 't' },
  brand_ideal: { texto: 't' },
  ingredients: { items: ['i'] },
  tagline: { texto: 't' },
  manifiesto: { texto: 't' },
  cuadros: { brandEssence: { proposito: 'p' }, consumidor: { jtbd: 'j' } },
}

const invalidos: Record<string, unknown> = {
  diagnostico: { problema: 'p', insight: 'i', ventaja: 'v', diferenciales: [] },
  consumidor: { metodologia: '', frases: ['f'] },
  rtbs: { items: [] },
  concepto: { concepto: 'c' },
  beneficios: { funcionales: ['f'], emocionales: [] },
  arquetipo: { arquetipo: '  ', justificacion: 'j' },
  personalidad: {},
  valores: { items: [{ valor: 'v' }] },
  territorio: { texto: '' },
  brand_ideal: {},
  ingredients: { items: [''] },
  tagline: { texto: '   ' },
  manifiesto: { otroCampo: 'x' },
  cuadros: { brandEssence: {}, consumidor: { jtbd: 'j' } },
}

describe('validarContenidoEstrategia', () => {
  it('rechaza lo que no es objeto', () => {
    expect(() => validarContenidoEstrategia('concepto', null)).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEstrategia('concepto', ['lista'])).toThrow(ErrorDeHerramienta)
  })

  for (const [etapa, contenido] of Object.entries(validos))
    it(`acepta un ${etapa} bien formado`, () => {
      expect(() => validarContenidoEstrategia(etapa as never, contenido)).not.toThrow()
    })

  for (const [etapa, contenido] of Object.entries(invalidos))
    it(`rechaza un ${etapa} mal formado con mensaje accionable`, () => {
      expect(() => validarContenidoEstrategia(etapa as never, contenido)).toThrow(ErrorDeHerramienta)
    })
})
