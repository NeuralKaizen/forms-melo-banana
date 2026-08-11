import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

import { POST } from './[stage]/route'
import { db } from '@/lib/db/client'
import { findOrCreateProject } from '@/lib/db/store'

let contador = 0
let projectId: string
beforeEach(async () => { projectId = (await findOrCreateProject(db, `Marca ${contador++}`)).id })

describe('POST /api/projects/[id]/landscape/[stage] — aprobar', () => {
  it('con versionId inexistente devuelve 404, no 500', async () => {
    const res = await POST(
      new Request(`http://localhost/api/projects/${projectId}/landscape/contexto`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion: 'aprobar', versionId: '00000000-0000-4000-8000-000000000000' }),
      }),
      { params: Promise.resolve({ id: projectId, stage: 'contexto' }) },
    )
    expect(res.status).toBe(404)
  })
})
