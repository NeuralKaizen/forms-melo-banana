import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { createSession } from '@/lib/db/store'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const s = await createSession(db, {
    name: body.name, company: body.company, role: body.role, email: body.email,
  })
  return NextResponse.json({ id: s.id })
}
