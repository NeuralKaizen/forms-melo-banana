import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { assignSessionToProject, ErrorNoEncontrado } from '@/lib/db/store'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (typeof body?.projectId !== 'string')
    return NextResponse.json({ error: 'falta projectId' }, { status: 400 })
  try {
    await assignSessionToProject(db, id, body.projectId)
  } catch (e) {
    if (e instanceof ErrorNoEncontrado)
      return NextResponse.json({ error: e.message }, { status: 404 })
    throw e
  }
  return NextResponse.json({ ok: true })
}
