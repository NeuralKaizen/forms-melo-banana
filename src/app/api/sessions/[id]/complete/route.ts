import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { completeSession } from '@/lib/db/store'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await completeSession(db, id)
  // Phase 3 adds: await generateAndSaveBrief(id)
  return NextResponse.json({ status: s.status })
}
