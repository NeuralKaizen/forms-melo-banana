import { describe, it, expect } from 'vitest'
import { buildStages, textoActividad, haceCuanto, STAGE_ORDER } from './stages'

describe('buildStages', () => {
  it('arma las seis etapas en orden con etiqueta y estado', () => {
    const stages = buildStages([
      { stage: 'setup', status: 'aprobada' },
      { stage: 'contexto', status: 'aprobada' },
      { stage: 'tendencias', status: 'en_curso' },
      { stage: 'panorama', status: 'pendiente' },
      { stage: 'diagnostico', status: 'no_aplica' },
      { stage: 'entrega', status: 'pendiente' },
    ])
    expect(stages.map(s => s.key)).toEqual(STAGE_ORDER)
    expect(stages[1].label).toBe('Contexto del sector')
    expect(stages[2].status).toBe('en_curso')
    expect(stages[4].hint).toBe('solo rebranding')
    expect(stages[0].hint).toBeUndefined()
  })

  it('lo que no viene queda pendiente', () => {
    const stages = buildStages([{ stage: 'setup', status: 'aprobada' }])
    expect(stages).toHaveLength(6)
    expect(stages.find(s => s.key === 'entrega')!.status).toBe('pendiente')
  })
})

describe('textoActividad', () => {
  it('describe qué pasó, en español y con el nombre de la etapa', () => {
    expect(textoActividad({ tipo: 'guardado', stage: 'tendencias' }))
      .toBe('Guardó un borrador de Tendencias')
    expect(textoActividad({ tipo: 'aprobado', stage: 'contexto' }))
      .toBe('Aprobó Contexto del sector')
  })
})

describe('haceCuanto', () => {
  const ahora = new Date('2026-07-29T12:00:00Z')
  const antes = (ms: number) => new Date(ahora.getTime() - ms)
  const MIN = 60_000, HORA = 60 * MIN, DIA = 24 * HORA

  it('traduce distancias a lenguaje del panel', () => {
    expect(haceCuanto(antes(30_000), ahora)).toBe('recién')
    expect(haceCuanto(antes(5 * MIN), ahora)).toBe('hace 5 min')
    expect(haceCuanto(antes(2 * HORA), ahora)).toBe('hace 2 h')
    expect(haceCuanto(antes(30 * HORA), ahora)).toBe('ayer')
    expect(haceCuanto(antes(4 * DIA), ahora)).toBe('hace 4 días')
  })

  it('más de una semana muestra la fecha', () => {
    expect(haceCuanto(new Date('2026-07-02T09:00:00Z'), ahora)).toBe('2 jul')
  })
})
