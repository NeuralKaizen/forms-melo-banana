import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

import { POST as crearSesion } from './route'
import { POST as completar } from './[id]/complete/route'
import { PATCH as mover } from './[id]/route'
import { db } from '@/lib/db/client'
import { findOrCreateProject, getSessionWithAnswers } from '@/lib/db/store'

const INEXISTENTE = '00000000-0000-4000-8000-000000000000'

async function crear(body: Record<string, unknown>) {
  const res = await crearSesion(new Request('http://localhost/api/sessions', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }))
  return (await res.json()).id as string
}

function completarSesion(id: string) {
  return completar(new Request(`http://localhost/api/sessions/${id}/complete`, { method: 'POST' }),
    { params: Promise.resolve({ id }) })
}

function moverSesion(id: string, projectId: string) {
  return mover(new Request(`http://localhost/api/sessions/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId }),
  }), { params: Promise.resolve({ id }) })
}

describe('sesiones y su proyecto', () => {
  it('la sesión que arranca desde el link del proyecto nace asignada a ese proyecto', async () => {
    const p = await findOrCreateProject(db, 'Del Link')
    const id = await crear({ name: 'Ana', company: 'Otra Cosa SAS', projectId: p.id })
    expect((await getSessionWithAnswers(db, id))!.projectId).toBe(p.id)
  })

  it('un projectId que no es uuid se ignora en vez de romper la entrevista', async () => {
    const id = await crear({ name: 'Ana', projectId: 'basura' })
    expect((await getSessionWithAnswers(db, id))!.projectId).toBeNull()
  })

  it('un link a un proyecto que ya no existe tampoco bloquea: la sesión nace sin proyecto', async () => {
    const id = await crear({ name: 'Ana', projectId: INEXISTENTE })
    expect((await getSessionWithAnswers(db, id))!.projectId).toBeNull()
  })

  it('al completar, la empresa tipeada asigna proyecto solo si la sesión no tenía', async () => {
    const id = await crear({ name: 'Ana', company: 'Acme' })
    await completarSesion(id)
    const asignado = (await getSessionWithAnswers(db, id))!.projectId
    expect(asignado).toBe((await findOrCreateProject(db, 'acme')).id)
  })

  it('la sesión del link conserva su proyecto aunque la empresa tipeada diga otra cosa', async () => {
    const p = await findOrCreateProject(db, 'El Del Link')
    const id = await crear({ name: 'Ana', company: 'Empresa Tipeada Distinta', projectId: p.id })
    await completarSesion(id)
    expect((await getSessionWithAnswers(db, id))!.projectId).toBe(p.id)
  })

  it('mover la entrevista persiste aunque el cierre se dispare de nuevo', async () => {
    const id = await crear({ name: 'Ana', company: 'Origen SA' })
    await completarSesion(id)

    const destino = await findOrCreateProject(db, 'Destino')
    expect((await moverSesion(id, destino.id)).status).toBe(200)

    // El entrevistado vuelve a entrar al link y termina otra vez: antes esto
    // re-asignaba por empresa y deshacía el movimiento del equipo.
    await completarSesion(id)
    expect((await getSessionWithAnswers(db, id))!.projectId).toBe(destino.id)
  })

  it('mover a un proyecto inexistente da 404 y no toca la sesión', async () => {
    const id = await crear({ name: 'Ana', company: 'Quieta SA' })
    await completarSesion(id)
    const antes = (await getSessionWithAnswers(db, id))!.projectId

    expect((await moverSesion(id, INEXISTENTE)).status).toBe(404)
    expect((await getSessionWithAnswers(db, id))!.projectId).toBe(antes)
  })

  it('mover una sesión inexistente da 404, no un ok silencioso', async () => {
    const p = await findOrCreateProject(db, 'Cualquiera')
    expect((await moverSesion(INEXISTENTE, p.id)).status).toBe(404)
  })
})
