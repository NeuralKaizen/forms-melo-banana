import { describe, expect, it } from 'vitest'
import { ETAPA_ORDER, ETAPA_LABEL, ETAPA_HINT, ESENCIA, buildEtapasEstrategia } from './stages'

describe('etapas de estrategia', () => {
  it('son 14, arrancan en diagnóstico y cierran en cuadros', () => {
    expect(ETAPA_ORDER).toHaveLength(14)
    expect(ETAPA_ORDER[0]).toBe('diagnostico')
    expect(ETAPA_ORDER[13]).toBe('cuadros')
  })

  it('la esencia son las 11 etapas entre consumidor y cuadros', () => {
    expect(ESENCIA).toEqual(ETAPA_ORDER.slice(2, 13))
  })

  it('toda etapa tiene label, y cuadros tiene su hint', () => {
    for (const k of ETAPA_ORDER) expect(ETAPA_LABEL[k]).toBeTruthy()
    expect(ETAPA_HINT.cuadros).toBe('se llena desde lo aprobado')
  })

  it('buildEtapasEstrategia devuelve las 14 aunque no haya filas', () => {
    const etapas = buildEtapasEstrategia([])
    expect(etapas).toHaveLength(14)
    expect(etapas.every(e => e.status === 'pendiente')).toBe(true)
  })

  it('buildEtapasEstrategia respeta el estado guardado', () => {
    const etapas = buildEtapasEstrategia([{ stage: 'concepto', status: 'aprobada' }])
    expect(etapas.find(e => e.key === 'concepto')?.status).toBe('aprobada')
  })
})
