import { describe, it, expect } from 'vitest'
import { armarNosToca, armarMovimientos } from './mesa'
import type { FaseIndice } from './indice'
import type { AttentionItem } from './attention'

const entrada = (over: Partial<FaseIndice['entradas'][0]>) => ({
  key: 'landscape:tendencias', label: 'Tendencias', href: '/x', estado: 'pendiente' as const, espera: false, ...over,
})

const fase = (over: Partial<FaseIndice>): FaseIndice => ({
  key: 'landscape', label: 'Landscape', avance: '2/6', entradas: [], ocultas: 0, hrefTodas: '/x?todas=1', ...over,
})

const atencion = (over: Partial<AttentionItem>): AttentionItem => ({
  projectId: 'p1', projectName: 'Café Lunar', accion: 'Landscape sin empezar',
  href: '/admin/projects/p1/landscape', fase: 'landscape', bloqueo: 'equipo', ...over,
})

describe('armarNosToca', () => {
  it('cada etapa con versión sin aprobar es una decisión con su link directo', () => {
    const indice = [fase({
      entradas: [
        entrada({ key: 'landscape:tendencias', label: 'Tendencias', href: '/admin/projects/p1/landscape?etapa=tendencias', espera: true }),
        entrada({ key: 'landscape:setup', label: 'Setup', href: '/admin/projects/p1/landscape?etapa=setup', estado: 'aprobada' }),
      ],
    })]
    const toca = armarNosToca(indice, [])
    expect(toca).toHaveLength(1)
    expect(toca[0].titulo).toBe('Revisar «Tendencias»')
    expect(toca[0].href).toBe('/admin/projects/p1/landscape?etapa=tendencias')
  })

  it('la señal gruesa se calla cuando su fase ya tiene esperas finas', () => {
    const indice = [fase({
      entradas: [entrada({ href: '/admin/projects/p1/landscape?etapa=tendencias', espera: true })],
    })]
    const toca = armarNosToca(indice, [atencion({ accion: 'Terminar el landscape' })])
    expect(toca).toHaveLength(1)
    expect(toca[0].titulo).toContain('Tendencias')
  })

  it('la señal gruesa entra cuando apunta a otra cosa, y va primero', () => {
    const indice = [fase({
      entradas: [entrada({ href: '/admin/projects/p1/landscape?etapa=tendencias', espera: true })],
    })]
    const toca = armarNosToca(indice, [atencion({
      accion: 'Propuesta de valor lista para generar', href: '/admin/projects/p1/propuesta', fase: 'propuesta',
    })])
    expect(toca.map(t => t.titulo)).toEqual(['Propuesta de valor lista para generar', 'Revisar «Tendencias»'])
  })

  it('lo que espera a alguien de afuera no es una decisión del equipo', () => {
    const toca = armarNosToca([fase({})], [atencion({ bloqueo: 'externo', accion: '2 entrevistas sin completar' })])
    expect(toca).toHaveLength(0)
  })
})

describe('armarMovimientos', () => {
  const t = (dia: number) => new Date(2026, 7, dia)

  it('mezcla las tres fuentes en un solo hilo, del más nuevo al más viejo', () => {
    const movs = armarMovimientos({
      projectId: 'p1',
      landscape: [{ id: 'v1:guardado', tipo: 'guardado', stage: 'panorama', autor: 'claude', cuando: t(19) }],
      estrategia: [{ id: 'v2:aprobado', tipo: 'aprobado', stage: 'concepto', autor: 'humano', quien: 'Flor', cuando: t(21) }],
      sesiones: [{ id: 's1', name: 'Ana Restrepo', completedAt: t(20) }],
    })
    expect(movs.map(m => `${m.quien} ${m.texto}`)).toEqual([
      'Flor aprobó Concepto estratégico',
      'Ana Restrepo completó su entrevista',
      'Claude guardó Panorama de categoría',
    ])
    expect(movs[0].href).toBe('/admin/projects/p1/estrategia?etapa=concepto')
    expect(movs[1].href).toBe('/admin/s1')
    expect(movs[2].href).toBe('/admin/projects/p1/landscape?etapa=panorama')
  })

  it('una sesión sin completar no es un movimiento, y el límite corta', () => {
    const movs = armarMovimientos({
      projectId: 'p1',
      landscape: [
        { id: 'a', tipo: 'guardado', stage: 'setup', autor: 'claude', cuando: t(10) },
        { id: 'b', tipo: 'guardado', stage: 'contexto', autor: 'claude', cuando: t(11) },
      ],
      estrategia: [],
      sesiones: [{ id: 's1', name: 'Ana', completedAt: null }],
      limite: 1,
    })
    expect(movs).toHaveLength(1)
    expect(movs[0].texto).toBe('guardó Contexto del sector')
  })

  it('sin autor con nombre, el que aprueba es el Equipo', () => {
    const movs = armarMovimientos({
      projectId: 'p1',
      landscape: [{ id: 'v:aprobado', tipo: 'aprobado', stage: 'setup', autor: 'humano', cuando: t(1) }],
      estrategia: [],
      sesiones: [],
    })
    expect(movs[0].quien).toBe('Equipo')
  })
})
