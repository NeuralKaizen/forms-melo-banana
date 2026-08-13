import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

import { POST } from './[stage]/route'
import { db } from '@/lib/db/client'
import { findOrCreateProject } from '@/lib/db/store'
import { saveStrategyVersion, approveStrategyVersion, strategyState } from '@/lib/db/strategy-store'

let contador = 0
let projectId: string
beforeEach(async () => { projectId = (await findOrCreateProject(db, `Marca ${contador++}`)).id })

function post(id: string, stage: string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/projects/${id}/estrategia/${stage}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id, stage }) },
  )
}

describe('POST /api/projects/[id]/estrategia/[stage]', () => {
  it('guardar crea un borrador humano', async () => {
    const res = await post(projectId, 'concepto', { accion: 'guardar', content: { concepto: 'c', racional: 'r' } })
    expect(res.status).toBe(200)
    expect((await res.json()).approvedAt).toBeNull()
  })

  it('aprobar sella la versión', async () => {
    const v = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'c', racional: 'r' }, author: 'claude' })
    const res = await post(projectId, 'concepto', { accion: 'aprobar', versionId: v.id })
    expect(res.status).toBe(200)
    expect((await res.json()).approvedAt).not.toBeNull()
  })

  it('aprobar con versionId inexistente devuelve 404', async () => {
    const res = await post(projectId, 'concepto', { accion: 'aprobar', versionId: '00000000-0000-4000-8000-000000000000' })
    expect(res.status).toBe(404)
  })

  it('etapa desconocida devuelve 400', async () => {
    const res = await post(projectId, 'tendencias', { accion: 'guardar', content: {} })
    expect(res.status).toBe(400)
  })

  it('reafirmar ratifica la vigente y disuelve el conflicto', async () => {
    const v = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'a', racional: 'b' }, author: 'claude' })
    await approveStrategyVersion(db, v.id, { projectId, stage: 'concepto' })
    await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'c', racional: 'd' }, author: 'claude' })

    const res = await post(projectId, 'concepto', { accion: 'reafirmar', autor: 'Flor' })
    expect(res.status).toBe(200)
    expect((await res.json()).reafirmada).toBe(true)

    const etapa = (await strategyState(db, projectId)).find(e => e.stage === 'concepto')!
    expect(etapa.borradorNuevo).toBeNull()
    expect(etapa.actual!.content).toEqual({ concepto: 'a', racional: 'b' })
  })

  it('reafirmar sin conflicto no escribe nada', async () => {
    const res = await post(projectId, 'concepto', { accion: 'reafirmar' })
    expect(res.status).toBe(200)
    expect((await res.json()).reafirmada).toBe(false)
    expect((await strategyState(db, projectId)).find(e => e.stage === 'concepto')!.versiones).toBe(0)
  })

  it('reafirmar con un proyecto que no existe devuelve 404', async () => {
    const res = await post('00000000-0000-4000-8000-000000000000', 'concepto', { accion: 'reafirmar' })
    expect(res.status).toBe(404)
  })
})
