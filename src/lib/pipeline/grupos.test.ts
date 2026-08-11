import { describe, expect, it } from 'vitest'
import { deriveGrupos, grupoDePantalla, grupoActual } from './phases'
import { projectSignals } from './signals'

const base = { sessions: [{ status: 'completed' }], tieneEntregable: true, landscape: { aprobadas: 4, total: 6 } }

describe('deriveGrupos', () => {
  it('devuelve los tres grupos en orden, sin entrega', () => {
    const g = deriveGrupos('p1', projectSignals(base))
    expect(g.map(x => x.key)).toEqual(['propuesta-valor', 'landscape', 'estrategia'])
  })

  it('el grupo 1 lleva las tres tabs con sus hrefs', () => {
    const g = deriveGrupos('p1', projectSignals(base))
    expect(g[0].tabs?.map(t => t.key)).toEqual(['entrevistas', 'propuesta', 'taller'])
    expect(g[0].tabs?.[0].href).toBe('/admin/projects/p1/entrevistas')
    expect(g[1].tabs).toBeUndefined()
  })

  it('estrategia muestra su avance cuando hay señal', () => {
    const g = deriveGrupos('p1', projectSignals({ ...base, estrategia: { aprobadas: 2, total: 14 } }))
    expect(g[2].status).toBe('en_curso')
    expect(g[2].detalle).toBe('2 de 14 aprobadas')
  })

  it('sin señal de estrategia queda pendiente y sin empezar', () => {
    const g = deriveGrupos('p1', projectSignals(base))
    expect(g[2].status).toBe('pendiente')
    expect(g[2].detalle).toBe('Sin empezar')
  })

  it('landscape conserva su dependencia del taller', () => {
    const g = deriveGrupos('p1', projectSignals({ ...base }))
    expect(g[1].dependencia).toMatch(/competidores del taller/)
  })

  it('grupoDePantalla mapea las cinco pantallas', () => {
    expect(grupoDePantalla('entrevistas')).toBe('propuesta-valor')
    expect(grupoDePantalla('taller')).toBe('propuesta-valor')
    expect(grupoDePantalla('landscape')).toBe('landscape')
    expect(grupoDePantalla('estrategia')).toBe('estrategia')
  })

  it('grupoActual es el primero no completo', () => {
    const g = deriveGrupos('p1', projectSignals(base))
    expect(grupoActual(g).key).toBe('propuesta-valor') // taller sin post-taller → espera
  })
})
