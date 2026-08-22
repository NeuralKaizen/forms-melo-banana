import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

import { PATCH } from './route'
import { db } from '@/lib/db/client'
import { findOrCreateProject, saveDeliverable, getDeliverable } from '@/lib/db/store'
import type { Deliverable } from '@/lib/deliverable/schema'

beforeEach(() => { process.env.ADMIN_PASSWORD = 'secreta' })

const PROBLEMA = {
  problemaMundo: 'mundo', problemaMarca: 'marca',
  problemaConsumidor: [{ texto: 'dolor', origen: 'cliente', cita: null }],
  comoLoHacemos: [], porQueRelevante: [],
}

function patch(id: string, body: unknown, conCookie = true) {
  return PATCH(new Request(`http://localhost/api/projects/${id}/deliverable`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(conCookie ? { cookie: 'admin=secreta' } : {}) },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) })
}

describe('PATCH /api/projects/[id]/deliverable', () => {
  it('sin la cookie de admin es 401', async () => {
    const p = await findOrCreateProject(db, 'Sin Permiso')
    expect((await patch(p.id, { part: 'problema', data: PROBLEMA }, false)).status).toBe(401)
  })

  it('guarda la edición conservando cuándo lo generó el modelo y fechando la edición', async () => {
    const p = await findOrCreateProject(db, 'Editable')
    const generadoEn = '2026-08-01T00:00:00.000Z'
    await saveDeliverable(db, p.id, {
      problema: { data: PROBLEMA, meta: { generatedAt: generadoEn, error: null } },
    })

    const res = await patch(p.id, { part: 'problema', data: { ...PROBLEMA, problemaMundo: 'mundo corregido' } })
    expect(res.status).toBe(200)

    const guardado = (await getDeliverable(db, p.id))!.content as Deliverable
    expect(guardado.problema!.data!.problemaMundo).toBe('mundo corregido')
    expect(guardado.problema!.meta.generatedAt).toBe(generadoEn)
    expect(guardado.problema!.meta.editedAt).toBeTruthy()
  })

  it('la personalidad no se edita acá: vive en Estrategia', async () => {
    const p = await findOrCreateProject(db, 'Con Personalidad')
    const res = await patch(p.id, { part: 'personalidad', data: { arquetipo: 'x', atributos: [], queNoQuiereSer: [], tensiones: [] } })
    expect(res.status).toBe(400)
  })

  it('rechaza contenido que no pasa el validador del paso (2 ejes no son 4)', async () => {
    const p = await findOrCreateProject(db, 'Estricto')
    const eje = { nombre: 'a', extremoIzquierdo: 'i', extremoDerecho: 'd', origen: 'equipo' }
    const res = await patch(p.id, {
      part: 'competencia',
      data: {
        competidores: [], otrosReferentes: [], ejes: [eje, eje],
        posicionActual: { texto: 'a', origen: 'equipo' }, posicionIdeal: { texto: 'b', origen: 'equipo' },
      },
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('4')
  })

  it('editar sobre un proyecto inexistente es 404', async () => {
    const res = await patch('00000000-0000-4000-8000-000000000000', { part: 'problema', data: PROBLEMA })
    expect(res.status).toBe(404)
  })
})
