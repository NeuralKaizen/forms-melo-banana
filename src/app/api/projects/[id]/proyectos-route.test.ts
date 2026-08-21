import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

import { PATCH, DELETE } from './route'
import { db } from '@/lib/db/client'
import { findOrCreateProject, getProject, createSession, assignSessionToProject } from '@/lib/db/store'

beforeEach(() => { process.env.ADMIN_PASSWORD = 'secreta' })

function pedido(id: string, init: RequestInit & { conCookie?: boolean } = {}) {
  const { conCookie = true, ...resto } = init
  return new Request(`http://localhost/api/projects/${id}`, {
    ...resto,
    headers: {
      'content-type': 'application/json',
      ...(conCookie ? { cookie: 'admin=secreta' } : {}),
      ...resto.headers,
    },
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe('PATCH /api/projects/[id]', () => {
  it('sin la cookie de admin es 401, sin tocar nada', async () => {
    const p = await findOrCreateProject(db, 'Intocable')
    const res = await PATCH(
      pedido(p.id, { method: 'PATCH', body: JSON.stringify({ name: 'Hackeada' }), conCookie: false }),
      params(p.id),
    )
    expect(res.status).toBe(401)
    expect((await getProject(db, p.id))!.name).toBe('Intocable')
  })

  it('renombra y devuelve el proyecto nuevo', async () => {
    const p = await findOrCreateProject(db, 'Antes')
    const res = await PATCH(
      pedido(p.id, { method: 'PATCH', body: JSON.stringify({ name: 'Después' }) }),
      params(p.id),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('Después')
  })

  it('chocar con el nombre de otro proyecto es 400 con el motivo', async () => {
    await findOrCreateProject(db, 'Ocupadísimo')
    const p = await findOrCreateProject(db, 'Aparte')
    const res = await PATCH(
      pedido(p.id, { method: 'PATCH', body: JSON.stringify({ name: 'ocupadísimo' }) }),
      params(p.id),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Ya hay otro proyecto')
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('sin la cookie de admin es 401', async () => {
    const p = await findOrCreateProject(db, 'Protegido')
    const res = await DELETE(pedido(p.id, { method: 'DELETE', conCookie: false }), params(p.id))
    expect(res.status).toBe(401)
    expect(await getProject(db, p.id)).not.toBeNull()
  })

  it('borra el proyecto con sus sesiones y cuenta cuántas se llevó', async () => {
    const p = await findOrCreateProject(db, 'Borrable')
    const s = await createSession(db, { name: 'Ana' })
    await assignSessionToProject(db, s.id, p.id)

    const res = await DELETE(pedido(p.id, { method: 'DELETE' }), params(p.id))
    expect(res.status).toBe(200)
    expect((await res.json()).sesionesBorradas).toBe(1)
    expect(await getProject(db, p.id)).toBeNull()

    // Repetir el borrado ya no encuentra nada: 404, no un ok mentiroso.
    expect((await DELETE(pedido(p.id, { method: 'DELETE' }), params(p.id))).status).toBe(404)
  })
})
