import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { createSession } from '@/lib/db/store'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  // El proyecto viene del link de entrevista (`/?p=<id>`), no de lo que tipea la
  // persona. Un valor roto se ignora en vez de rechazar: el link nunca puede dejar
  // a alguien sin poder responder.
  const projectId = typeof body.projectId === 'string' && UUID.test(body.projectId)
    ? body.projectId
    : undefined
  const s = await createSession(db, {
    name: body.name, company: body.company, role: body.role, email: body.email, projectId,
  })
  return NextResponse.json({ id: s.id })
}
