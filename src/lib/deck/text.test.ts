import { describe, it, expect } from 'vitest'
import { normalizarTexto, citaVerificada } from './text'

const CORPUS = [
  'Queremos que la gente se sienta acompañada, no vendida.',
  'Nuestro margen real es del 12% y eso nos aprieta.',
]

describe('normalizarTexto', () => {
  it('baja a minúsculas, quita tildes y colapsa espacios', () => {
    expect(normalizarTexto('  Él  CANTÓ   más  ')).toBe('el canto mas')
  })

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(normalizarTexto('')).toBe('')
  })
})

describe('citaVerificada', () => {
  it('acepta una cita que aparece textual en el corpus', () => {
    expect(citaVerificada('la gente se sienta acompañada', CORPUS))
      .toBe('la gente se sienta acompañada')
  })

  it('acepta ignorando tildes, mayúsculas y espacios de más', () => {
    expect(citaVerificada('  La Gente Se Sienta   ACOMPANADA ', CORPUS))
      .toBe('La Gente Se Sienta   ACOMPANADA')
  })

  it('rechaza una cita inventada', () => {
    expect(citaVerificada('somos líderes del mercado', CORPUS)).toBeNull()
  })

  it('rechaza una cita que mezcla dos respuestas distintas', () => {
    expect(citaVerificada('no vendida. Nuestro margen real', CORPUS)).toBeNull()
  })

  it('devuelve null para null, undefined o vacío', () => {
    expect(citaVerificada(null, CORPUS)).toBeNull()
    expect(citaVerificada(undefined, CORPUS)).toBeNull()
    expect(citaVerificada('   ', CORPUS)).toBeNull()
  })

  it('rechaza citas demasiado cortas para ser significativas', () => {
    // "del" aparece en el corpus, pero citarlo no prueba nada.
    expect(citaVerificada('del', CORPUS)).toBeNull()
  })

  it('preserva el texto original de la cita, no el normalizado', () => {
    expect(citaVerificada('Nuestro margen real es del 12%', CORPUS))
      .toBe('Nuestro margen real es del 12%')
  })
})
