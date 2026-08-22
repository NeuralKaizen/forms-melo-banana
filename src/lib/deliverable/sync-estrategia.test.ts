import { describe, it, expect } from 'vitest'
import { makeTestDb } from '@/lib/db/testdb'
import { findOrCreateProject } from '@/lib/db/store'
import { listStrategyVersions, strategyState, approveStrategyVersion } from '@/lib/db/strategy-store'
import { sincronizarPersonalidadEnEstrategia } from './sync-estrategia'
import type { Personalidad } from './schema'

const PERS: Personalidad = { arquetipo: 'El Cuidador', atributos: ['cálido'], queNoQuiereSer: ['frío'], tensiones: [] }

describe('sincronizarPersonalidadEnEstrategia', () => {
  it('la personalidad generada aparece como borrador de Claude en la etapa de estrategia', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await sincronizarPersonalidadEnEstrategia(db, p.id, PERS)
    expect(v).not.toBeNull()
    expect(v!.author).toBe('claude')
    expect(v!.approvedAt).toBeNull()
    const etapa = (await strategyState(db, p.id)).find(e => e.stage === 'personalidad')!
    expect(etapa.status).toBe('en_curso')
    expect((etapa.actual!.content as Personalidad).arquetipo).toBe('El Cuidador')
  })

  it('regenerar con el mismo contenido no ensucia el historial', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await sincronizarPersonalidadEnEstrategia(db, p.id, PERS)
    expect(await sincronizarPersonalidadEnEstrategia(db, p.id, { ...PERS })).toBeNull()
    expect(await listStrategyVersions(db, p.id, 'personalidad')).toHaveLength(1)
  })

  it('un contenido distinto sí escribe una versión nueva', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await sincronizarPersonalidadEnEstrategia(db, p.id, PERS)
    await new Promise(r => setTimeout(r, 2))
    const v = await sincronizarPersonalidadEnEstrategia(db, p.id, { ...PERS, arquetipo: 'El Sabio' })
    expect(v).not.toBeNull()
    expect(await listStrategyVersions(db, p.id, 'personalidad')).toHaveLength(2)
  })

  it('sobre una etapa ya aprobada queda como borrador nuevo, sin reabrirla', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v1 = (await sincronizarPersonalidadEnEstrategia(db, p.id, PERS))!
    await approveStrategyVersion(db, v1.id, { projectId: p.id, stage: 'personalidad' })
    await new Promise(r => setTimeout(r, 2))

    await sincronizarPersonalidadEnEstrategia(db, p.id, { ...PERS, arquetipo: 'El Sabio' })
    const etapa = (await strategyState(db, p.id)).find(e => e.stage === 'personalidad')!
    expect(etapa.status).toBe('aprobada')
    expect(etapa.borradorNuevo).not.toBeNull()
  })
})
