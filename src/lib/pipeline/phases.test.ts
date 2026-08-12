import { describe, expect, it } from 'vitest'
import { deriveFases, faseDeEtapa, faseActual, derivePantallas, pantallaActual, type ProjectSignals, type Fase } from './phases'
import { projectSignals } from './signals'

const base = { sessions: [{ status: 'completed' }], tieneEntregable: true, landscape: { aprobadas: 4, total: 6 } }

describe('deriveFases', () => {
  it('devuelve las tres fases en orden, sin entrega', () => {
    const g = deriveFases('p1', projectSignals(base))
    expect(g.map(x => x.key)).toEqual(['propuesta-valor', 'landscape', 'estrategia'])
  })

  it('la fase 1 lleva las tres tabs con sus hrefs', () => {
    const g = deriveFases('p1', projectSignals(base))
    expect(g[0].tabs?.map(t => t.key)).toEqual(['entrevistas', 'propuesta', 'taller'])
    expect(g[0].tabs?.[0].href).toBe('/admin/projects/p1/entrevistas')
    expect(g[1].tabs).toBeUndefined()
  })

  it('estrategia muestra su avance cuando hay señal', () => {
    const g = deriveFases('p1', projectSignals({ ...base, estrategia: { aprobadas: 2, total: 14 } }))
    expect(g[2].status).toBe('en_curso')
    expect(g[2].detalle).toBe('2 de 14 aprobadas')
  })

  it('sin señal de estrategia queda pendiente y sin empezar', () => {
    const g = deriveFases('p1', projectSignals(base))
    expect(g[2].status).toBe('pendiente')
    expect(g[2].detalle).toBe('Sin empezar')
  })

  it('landscape conserva su dependencia del taller', () => {
    const g = deriveFases('p1', projectSignals({ ...base }))
    expect(g[1].dependencia).toMatch(/competidores del taller/)
  })

  it('faseDeEtapa mapea las cinco etapas', () => {
    expect(faseDeEtapa('entrevistas')).toBe('propuesta-valor')
    expect(faseDeEtapa('taller')).toBe('propuesta-valor')
    expect(faseDeEtapa('landscape')).toBe('landscape')
    expect(faseDeEtapa('estrategia')).toBe('estrategia')
  })

  it('faseActual es la primera no completa', () => {
    const g = deriveFases('p1', projectSignals(base))
    expect(faseActual(g).key).toBe('propuesta-valor') // taller sin post-taller → espera
  })
})

describe('derivePantallas', () => {
  it('hrefs por pantalla correctos', () => {
    const p = derivePantallas('p1', projectSignals(base))
    expect(p.entrevistas.href).toBe('/admin/projects/p1/entrevistas')
    expect(p.propuesta.href).toBe('/admin/projects/p1/propuesta')
    expect(p.taller.href).toBe('/admin/projects/p1/taller')
    expect(p.landscape.href).toBe('/admin/projects/p1/landscape')
  })

  // Las tres armadas a mano: `projectSignals()` hardcodea `tienePostTaller: false`, así
  // que para ver el taller 'completa' hay que construir el ProjectSignals directo.
  it('taller pendiente sin entregable', () => {
    const s: ProjectSignals = {
      sessionsTotal: 1, sessionsCompleted: 1, tieneEntregable: false, tienePostTaller: false,
      landscapeEtapasAprobadas: 0, landscapeEtapasTotal: 6, estrategiaEtapasAprobadas: 0, estrategiaEtapasTotal: 14,
    }
    const p = derivePantallas('p1', s)
    expect(p.taller.status).toBe('pendiente')
  })

  it('taller en espera con entregable sin post-taller', () => {
    const s: ProjectSignals = {
      sessionsTotal: 1, sessionsCompleted: 1, tieneEntregable: true, tienePostTaller: false,
      landscapeEtapasAprobadas: 0, landscapeEtapasTotal: 6, estrategiaEtapasAprobadas: 0, estrategiaEtapasTotal: 14,
    }
    const p = derivePantallas('p1', s)
    expect(p.taller.status).toBe('espera')
  })

  it('taller completa con post-taller', () => {
    const s: ProjectSignals = {
      sessionsTotal: 1, sessionsCompleted: 1, tieneEntregable: true, tienePostTaller: true,
      landscapeEtapasAprobadas: 0, landscapeEtapasTotal: 6, estrategiaEtapasAprobadas: 0, estrategiaEtapasTotal: 14,
    }
    const p = derivePantallas('p1', s)
    expect(p.taller.status).toBe('completa')
  })
})

describe('pantallaActual', () => {
  it('con 3/3 entrevistas y sin entregable, cae en propuesta', () => {
    const s = projectSignals({ sessions: [{ status: 'completed' }, { status: 'completed' }, { status: 'completed' }], tieneEntregable: false })
    const fases = deriveFases('p1', s)
    const pantallas = derivePantallas('p1', s)
    expect(pantallaActual(fases, pantallas).key).toBe('propuesta')
  })

  it('con la propuesta generada, cae en taller', () => {
    const s = projectSignals({ sessions: [{ status: 'completed' }, { status: 'completed' }, { status: 'completed' }], tieneEntregable: true })
    const fases = deriveFases('p1', s)
    const pantallas = derivePantallas('p1', s)
    expect(pantallaActual(fases, pantallas).key).toBe('taller')
  })

  it('con la fase 1 completa (hoy imposible vía señales reales), pasa a la fase siguiente no completa', () => {
    // `tienePostTaller` está hardcodeada en `false` en signals.ts — la fase 1 nunca
    // llega sola a 'completa'. Se arman las fases a mano para probar que, cuando sí lo
    // está, `pantallaActual` no se queda pegado en 'propuesta-valor'.
    const s = projectSignals({ sessions: [{ status: 'completed' }], tieneEntregable: true }) // landscape sin empezar
    const faseUnoCompleta: Fase = {
      key: 'propuesta-valor', label: 'Entrevistas / Propuesta de valor', status: 'completa',
      detalle: 'Conclusiones transcritas', href: '/admin/projects/p1/entrevistas',
    }
    const fases = [faseUnoCompleta, ...deriveFases('p1', s).slice(1)]
    const pantallas = derivePantallas('p1', s)
    expect(pantallaActual(fases, pantallas).key).toBe('landscape')
  })

  it('con la fase 1 y landscape completas, arma la pantalla de estrategia al vuelo', () => {
    const s = projectSignals({ sessions: [{ status: 'completed' }], tieneEntregable: true, landscape: { aprobadas: 6, total: 6 } })
    const [, landscapeCompleto, estrategia] = deriveFases('p1', s)
    const faseUnoCompleta: Fase = {
      key: 'propuesta-valor', label: 'Entrevistas / Propuesta de valor', status: 'completa',
      detalle: 'Conclusiones transcritas', href: '/admin/projects/p1/entrevistas',
    }
    const fases = [faseUnoCompleta, landscapeCompleto, estrategia]
    const pantallas = derivePantallas('p1', s)
    const actual = pantallaActual(fases, pantallas)
    expect(actual.key).toBe('estrategia')
    expect(actual.href).toBe(estrategia.href)
    expect(actual.label).toBe(estrategia.label)
  })

  it('cuando las tres sub-pantallas de la fase 1 están completas, cae por defecto en taller', () => {
    const faseUnoSola: Fase = {
      key: 'propuesta-valor', label: 'Entrevistas / Propuesta de valor', status: 'completa',
      detalle: 'Conclusiones transcritas', href: '/admin/projects/p1/entrevistas',
    }
    const s: ProjectSignals = {
      sessionsTotal: 1, sessionsCompleted: 1, tieneEntregable: true, tienePostTaller: true,
      landscapeEtapasAprobadas: 0, landscapeEtapasTotal: 6, estrategiaEtapasAprobadas: 0, estrategiaEtapasTotal: 14,
    }
    const pantallas = derivePantallas('p1', s)
    expect(pantallaActual([faseUnoSola], pantallas).key).toBe('taller')
  })
})
