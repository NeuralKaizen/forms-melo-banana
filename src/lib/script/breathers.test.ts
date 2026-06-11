import { describe, it, expect } from 'vitest'
import { closingAfter, sectionIntro } from './breathers'

describe('closingAfter', () => {
  it('da el cierre tras la última', () => {
    expect(closingAfter(15, 15)).toEqual({ message: '¡Eso es todo! Gracias por compartir tu visión con nosotros.', closing: true })
  })
  it('no da nada antes del final', () => {
    expect(closingAfter(7, 15)).toBeNull()
    expect(closingAfter(12, 15)).toBeNull()
    expect(closingAfter(3, 15)).toBeNull()
  })
})

describe('sectionIntro', () => {
  it('abre cada sección del flujo de voz con su transición', () => {
    expect(sectionIntro('empresa_historia')?.emoji).toBe('🏢')
    expect(sectionIntro('problema')?.emoji).toBe('👥')
    expect(sectionIntro('objetivos')?.emoji).toBe('🎨')
    expect(sectionIntro('animal')?.emoji).toBe('✨')
  })
  it('la primera sección trae CTA propio', () => {
    expect(sectionIntro('empresa_historia')?.cta).toBe('Empezar')
  })
  it('no devuelve intro para preguntas que no abren sección', () => {
    expect(sectionIntro('productos')).toBeNull()
    expect(sectionIntro('color')).toBeNull()
  })
})
