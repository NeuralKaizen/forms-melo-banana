import { describe, it, expect } from 'vitest'
import { derivePhases, currentPhase, neighbours, type ProjectSignals } from './phases'

const base: ProjectSignals = {
  sessionsTotal: 0,
  sessionsCompleted: 0,
  tieneEntregable: false,
  tienePostTaller: false,
  landscapeEtapasAprobadas: 0,
  landscapeEtapasTotal: 6,
}

const byKey = (s: ProjectSignals) =>
  Object.fromEntries(derivePhases('p1', s).map(p => [p.key, p]))

describe('derivePhases', () => {
  it('un proyecto vacío está parado en entrevistas', () => {
    const phases = derivePhases('p1', base)
    expect(currentPhase(phases).key).toBe('entrevistas')
    expect(byKey(base).entrevistas.detalle).toBe('Sin respondientes')
  })

  it('con entrevistas a medias, entrevistas queda en curso', () => {
    const p = byKey({ ...base, sessionsTotal: 3, sessionsCompleted: 1 })
    expect(p.entrevistas.status).toBe('en_curso')
    expect(p.entrevistas.detalle).toBe('1 de 3 completadas')
  })

  it('con todas completas, la propuesta queda lista para generar', () => {
    const p = byKey({ ...base, sessionsTotal: 2, sessionsCompleted: 2 })
    expect(p.entrevistas.status).toBe('completa')
    expect(p.propuesta.detalle).toBe('Lista para generar')
  })

  it('el taller espera mientras las conclusiones no vuelvan del Miro', () => {
    const p = byKey({ ...base, sessionsTotal: 2, sessionsCompleted: 2, tieneEntregable: true })
    expect(p.taller.status).toBe('espera')
  })

  it('toda fase tiene pantalla propia: el recorrido se navega entero', () => {
    expect(derivePhases('p1', base).map(p => p.href)).toEqual([
      '/admin/projects/p1/entrevistas',
      '/admin/projects/p1/propuesta',
      '/admin/projects/p1/taller',
      '/admin/projects/p1/landscape',
      '/admin/projects/p1/entrega',
    ])
  })

  it('neighbours devuelve la anterior y la siguiente, y nada en los extremos', () => {
    const phases = derivePhases('p1', base)
    expect(neighbours(phases, 'entrevistas').prev).toBeNull()
    expect(neighbours(phases, 'entrevistas').next?.key).toBe('propuesta')
    expect(neighbours(phases, 'landscape').prev?.key).toBe('taller')
    expect(neighbours(phases, 'entrega').next).toBeNull()
  })

  it('el landscape avisa que depende del taller mientras no esté transcrito', () => {
    const sinTaller = byKey({ ...base, tieneEntregable: true })
    expect(sinTaller.landscape.dependencia).toMatch(/competidores del taller/)

    const conTaller = byKey({ ...base, tieneEntregable: true, tienePostTaller: true })
    expect(conTaller.landscape.dependencia).toBeUndefined()
    expect(conTaller.taller.status).toBe('completa')
  })

  it('el landscape se completa solo cuando todas sus etapas están aprobadas', () => {
    const aMedias = byKey({ ...base, landscapeEtapasAprobadas: 2 })
    expect(aMedias.landscape.status).toBe('en_curso')
    expect(aMedias.landscape.detalle).toBe('2 de 6 etapas aprobadas')

    const todas = byKey({ ...base, landscapeEtapasAprobadas: 6 })
    expect(todas.landscape.status).toBe('completa')
    expect(todas.entrega.detalle).toBe('Lista para presentar')
  })

  it('currentPhase salta las completas', () => {
    const phases = derivePhases('p1', {
      ...base, sessionsTotal: 2, sessionsCompleted: 2, tieneEntregable: true, tienePostTaller: true,
    })
    expect(currentPhase(phases).key).toBe('landscape')
  })
})
