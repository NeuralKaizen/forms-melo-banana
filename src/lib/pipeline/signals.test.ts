import { describe, it, expect } from 'vitest'
import { projectSignals } from './signals'
import { STAGE_ORDER } from '@/lib/landscape/stages'

describe('projectSignals', () => {
  it('sin landscape, cae a "nada aprobado de las seis etapas" en vez de inventar un número', () => {
    const s = projectSignals({ sessions: [], tieneEntregable: false })
    expect(s.landscapeEtapasAprobadas).toBe(0)
    expect(s.landscapeEtapasTotal).toBe(STAGE_ORDER.length)
    expect(s.landscapeEtapasTotal).toBe(6)
  })

  it('con landscape, usa el conteo real tal cual llega', () => {
    const s = projectSignals({
      sessions: [], tieneEntregable: false,
      landscape: { aprobadas: 3, total: 5 },
    })
    expect(s.landscapeEtapasAprobadas).toBe(3)
    expect(s.landscapeEtapasTotal).toBe(5)
  })

  it('sessionsTotal/Completed y tieneEntregable siguen igual que antes', () => {
    const s = projectSignals({
      sessions: [{ status: 'completed' }, { status: 'in_progress' }, { status: 'completed' }],
      tieneEntregable: true,
    })
    expect(s.sessionsTotal).toBe(3)
    expect(s.sessionsCompleted).toBe(2)
    expect(s.tieneEntregable).toBe(true)
    expect(s.tienePostTaller).toBe(false)
  })
})
