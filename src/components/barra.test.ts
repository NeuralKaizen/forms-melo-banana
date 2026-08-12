import { describe, it, expect } from 'vitest'
import { estadoBarra, iniciales } from './barra'

describe('estadoBarra', () => {
  it('es ancha sin proyecto activo y riel con uno', () => {
    expect(estadoBarra(undefined)).toBe('ancha')
    expect(estadoBarra('p1')).toBe('riel')
  })
})

describe('iniciales', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(iniciales('Café Lunar')).toBe('CL')
    expect(iniciales('Almacén del Sur')).toBe('AD')
  })

  it('con una sola palabra toma las dos primeras letras', () => {
    expect(iniciales('Lunar')).toBe('LU')
  })
})
