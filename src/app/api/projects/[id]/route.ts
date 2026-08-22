import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { renameProject, deleteProject, ErrorDeValidacion, ErrorNoEncontrado } from '@/lib/db/store'
import { esAdminRequest } from '@/lib/admin/auth'
import { esUuidValido } from '@/lib/landscape/ids'

function conErrores(e: unknown): NextResponse {
  if (e instanceof ErrorDeValidacion) return NextResponse.json({ error: e.message }, { status: 400 })
  if (e instanceof ErrorNoEncontrado) return NextResponse.json({ error: e.message }, { status: 404 })
  throw e
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!esAdminRequest(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  if (!esUuidValido(id)) return NextResponse.json({ error: `Id de proyecto inválido: ${id}` }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  if (typeof body?.name !== 'string')
    return NextResponse.json({ error: 'falta name' }, { status: 400 })
  try {
    return NextResponse.json(await renameProject(db, id, body.name))
  } catch (e) {
    return conErrores(e)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!esAdminRequest(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  if (!esUuidValido(id)) return NextResponse.json({ error: `Id de proyecto inválido: ${id}` }, { status: 400 })
  try {
    const { sesionesBorradas } = await deleteProject(db, id)
    return NextResponse.json({ ok: true, sesionesBorradas })
  } catch (e) {
    return conErrores(e)
  }
}
