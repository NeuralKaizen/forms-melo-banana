import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

import { POST } from './[stage]/route'
import { db } from '@/lib/db/client'
import { findOrCreateProject } from '@/lib/db/store'
import { saveStrategyVersion } from '@/lib/db/strategy-store'

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
})
