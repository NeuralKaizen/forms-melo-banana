import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

import { POST } from './[stage]/route'
import { db } from '@/lib/db/client'
import {
  findOrCreateProject, saveLandscapeVersion, approveLandscapeVersion, landscapeState,
} from '@/lib/db/store'

let contador = 0
let projectId: string
beforeEach(async () => { projectId = (await findOrCreateProject(db, `Marca ${contador++}`)).id })

function post(id: string, stage: string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/projects/${id}/landscape/${stage}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id, stage }) },
  )
}

describe('POST /api/projects/[id]/landscape/[stage] — aprobar', () => {
  it('con versionId inexistente devuelve 404, no 500', async () => {
    const res = await post(projectId, 'contexto', {
      accion: 'aprobar', versionId: '00000000-0000-4000-8000-000000000000',
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/projects/[id]/landscape/[stage] — reafirmar', () => {
  /** Etapa aprobada, y encima un borrador que llegó después. */
  async function conConflicto() {
    const v = await saveLandscapeVersion(db, projectId, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v.id, { projectId, stage: 'contexto' })
    await saveLandscapeVersion(db, projectId, 'contexto', { content: { v: 2 }, author: 'claude' })
  }

  it('ratifica la vigente y la etapa deja de tener borrador pendiente', async () => {
    await conConflicto()
    const res = await post(projectId, 'contexto', { accion: 'reafirmar', autor: 'Flor' })
    expect(res.status).toBe(200)

    const { reafirmada, version } = await res.json()
    expect(reafirmada).toBe(true)
    expect(version.approvedAt).not.toBeNull()
    expect(version.authorLabel).toBe('Flor')

    const etapa = (await landscapeState(db, projectId)).find(e => e.stage === 'contexto')!
    expect(etapa.borradorNuevo).toBeNull()
    expect(etapa.actual!.content).toEqual({ v: 1 })
  })

  it('sin conflicto responde que no ratificó nada, sin escribir', async () => {
    const res = await post(projectId, 'contexto', { accion: 'reafirmar' })
    expect(res.status).toBe(200)
    expect((await res.json()).reafirmada).toBe(false)
    expect((await landscapeState(db, projectId)).find(e => e.stage === 'contexto')!.versiones).toBe(0)
  })

  it('con un proyecto que no existe devuelve 404, no 500', async () => {
    const res = await post('00000000-0000-4000-8000-000000000000', 'contexto', { accion: 'reafirmar' })
    expect(res.status).toBe(404)
  })

  it('con una etapa desconocida devuelve 400', async () => {
    const res = await post(projectId, 'inventada', { accion: 'reafirmar' })
    expect(res.status).toBe(400)
  })
})
