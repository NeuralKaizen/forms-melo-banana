import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { assignSessionToProject } from '@/lib/db/store'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (typeof body?.projectId !== 'string')
    return NextResponse.json({ error: 'falta projectId' }, { status: 400 })
  await assignSessionToProject(db, id, body.projectId)
  return NextResponse.json({ ok: true })
}
