import { describe, it, expect } from 'vitest'
import { sectionIntro } from './breathers'

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
