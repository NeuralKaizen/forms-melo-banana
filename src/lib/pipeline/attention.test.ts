import { describe, it, expect } from 'vitest'
import { derivePantallas, type ProjectSignals } from './phases'
import { attentionItems, haceCuanto, type AttentionInput } from './attention'

const señales = (over: Partial<ProjectSignals> = {}): ProjectSignals => ({
  sessionsTotal: 0,
  sessionsCompleted: 0,
  tieneEntregable: false,
  tienePostTaller: false,
  landscapeEtapasAprobadas: 0,
  landscapeEtapasTotal: 6,
  estrategiaEtapasAprobadas: 0,
  estrategiaEtapasTotal: 14,
  ...over,
})

const proyecto = (id: string, name: string, over: Partial<ProjectSignals> = {}, ultimaActividad?: Date): AttentionInput => {
  const s = señales(over)
  return {
    id, name,
    pantallas: derivePantallas(id, s),
    sessionsTotal: s.sessionsTotal,
    sessionsCompleted: s.sessionsCompleted,
    tieneEntregable: s.tieneEntregable,
    ultimaActividad,
  }
}

describe('attentionItems', () => {
  it('avisa cuando la propuesta se puede generar ya', () => {
    const [item] = attentionItems([proyecto('p1', 'Fruta Viva', { sessionsTotal: 3, sessionsCompleted: 3 })])
    expect(item.accion).toBe('Propuesta de valor lista para generar')
    expect(item.bloqueo).toBe('equipo')
    expect(item.href).toBe('/admin/projects/p1/propuesta')
  })

  it('distingue lo que destraba el equipo de lo que espera a alguien de afuera', () => {
    const [taller] = attentionItems([
      proyecto('p1', 'Alta', { sessionsTotal: 1, sessionsCompleted: 1, tieneEntregable: true }),
    ])
    expect(taller.accion).toBe('Faltan las conclusiones del taller')
    expect(taller.bloqueo).toBe('externo')
  })

  it('cuenta las entrevistas que faltan, en singular y en plural', () => {
    const [una] = attentionItems([proyecto('p1', 'A', { sessionsTotal: 2, sessionsCompleted: 1 })])
    expect(una.accion).toBe('Propuesta de valor lista para generar')

    const [ninguna] = attentionItems([proyecto('p2', 'B', { sessionsTotal: 2, sessionsCompleted: 0 })])
    expect(ninguna.accion).toBe('2 entrevistas sin completar')
  })

  it('un proyecto sin entrevistas pide entrevistas', () => {
    const [item] = attentionItems([proyecto('p1', 'Nuevo')])
    expect(item.accion).toBe('Sin entrevistas todavía')
    expect(item.fase).toBe('entrevistas')
  })

  it('ordena lo accionable primero y, a igual rango, lo más quieto', () => {
    const viejo = new Date('2026-01-01')
    const nuevo = new Date('2026-07-01')
    const items = attentionItems([
      proyecto('p1', 'Espera taller', { sessionsTotal: 1, sessionsCompleted: 1, tieneEntregable: true }, nuevo),
      proyecto('p2', 'Reciente', { sessionsTotal: 1, sessionsCompleted: 1 }, nuevo),
      proyecto('p3', 'Quieto', { sessionsTotal: 1, sessionsCompleted: 1 }, viejo),
    ])
    expect(items.map(i => i.projectName)).toEqual(['Quieto', 'Reciente', 'Espera taller'])
  })

  it('un proyecto terminado no aparece en la lista', () => {
    const items = attentionItems([
      proyecto('p1', 'Cerrado', {
        sessionsTotal: 2, sessionsCompleted: 2, tieneEntregable: true,
        tienePostTaller: true, landscapeEtapasAprobadas: 6,
      }),
    ])
    expect(items).toEqual([])
  })
})

describe('haceCuanto', () => {
  const ahora = new Date('2026-07-28T12:00:00Z')

  it('traduce la distancia a lenguaje corto', () => {
    expect(haceCuanto(new Date('2026-07-28T09:00:00Z'), ahora)).toBe('hoy')
    expect(haceCuanto(new Date('2026-07-27T09:00:00Z'), ahora)).toBe('ayer')
    expect(haceCuanto(new Date('2026-07-20T12:00:00Z'), ahora)).toBe('hace 8 días')
    expect(haceCuanto(new Date('2026-06-20T12:00:00Z'), ahora)).toBe('hace 1 mes')
    expect(haceCuanto(null, ahora)).toBe('—')
  })
})
