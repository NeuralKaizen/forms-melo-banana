import { describe, it, expect } from 'vitest'
import { breatherAfter } from './breathers'

describe('breatherAfter', () => {
  it('da un respiro tras la 7 y la 12', () => {
    expect(breatherAfter(7, 15)).toEqual({ message: 'Vamos por la mitad de camino. Recuerda tomarte el tiempo que necesites.', closing: false })
    expect(breatherAfter(12, 15)).toEqual({ message: 'Doce preguntas y contando. Ya casi lo tenemos.', closing: false })
  })
  it('da el cierre tras la última', () => {
    expect(breatherAfter(15, 15)).toEqual({ message: '¡Eso es todo! Gracias por compartir tu visión con nosotros.', closing: true })
  })
  it('no da nada en otras posiciones', () => {
    expect(breatherAfter(3, 15)).toBeNull()
    expect(breatherAfter(8, 15)).toBeNull()
  })
})
