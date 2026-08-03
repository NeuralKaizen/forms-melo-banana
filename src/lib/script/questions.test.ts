import { describe, it, expect } from 'vitest'
import { SCRIPT } from './questions'

describe('SCRIPT', () => {
  it('has unique question ids', () => {
    const ids = SCRIPT.flatMap(s => s.questions.map(q => q.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('covers the 5 sections from the form', () => {
    expect(SCRIPT.map(s => s.key)).toEqual([
      'identity', 'project', 'consumer', 'design', 'projective',
    ])
  })
  it('opciones coinciden con el tipo de pregunta', () => {
    for (const s of SCRIPT) for (const q of s.questions) {
      if (q.type === 'open') { expect(q.options).toBeUndefined() }
      else { expect(q.options!.length).toBeGreaterThanOrEqual(2) }
      if (q.type === 'image-grid') for (const o of q.options!) expect(o.src).toBeTruthy()
      if (q.type === 'color-grid') for (const o of q.options!) expect((o.colors ?? []).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('la sección proyectiva tiene las 6 preguntas', () => {
    const proj = SCRIPT.find(s => s.key === 'projective')!
    expect(proj.questions.map(q => q.id)).toEqual([
      'animal', 'color', 'genero', 'edad', 'olor', 'ciudad',
    ])
  })
  it('género incluye neutro', () => {
    const genero = SCRIPT.flatMap(s => s.questions).find(q => q.id === 'genero')!
    expect(genero.options!.map(o => o.id)).toEqual(['hombre', 'mujer', 'neutro'])
  })
  it('los olores usan las etiquetas aprobadas por el cliente', () => {
    const olor = SCRIPT.flatMap(s => s.questions).find(q => q.id === 'olor')!
    expect(olor.options!.map(o => o.label)).toEqual([
      'Flores', 'Bosque', 'Césped', 'Río', 'Dulce', 'Madera', 'Hierbas', 'Cítrico', 'Rosas',
    ])
  })
  it('every question has a non-empty prompt and audio path', () => {
    for (const s of SCRIPT) for (const q of s.questions) {
      expect(q.prompt.length).toBeGreaterThan(0)
      expect(q.audio).toMatch(/^\/audio\/.+\.mp3$/)
    }
  })
  it('applies the approved merges', () => {
    const ids = SCRIPT.flatMap(s => s.questions.map(q => q.id))
    expect(ids).toContain('empresa_historia')
    expect(ids).toContain('porque_ahora')
    expect(ids).toContain('percepcion')
    for (const gone of ['descripcion', 'historia', 'si_nada', 'piensan', 'relacion', 'uso']) {
      expect(ids).not.toContain(gone)
    }
  })
})
