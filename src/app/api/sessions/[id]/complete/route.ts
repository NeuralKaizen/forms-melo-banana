import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { completeSession } from '@/lib/db/store'
// Brief por IA en pausa (feature futura): el endpoint POST /api/sessions/[id]/brief
// sigue disponible para generarlo a demanda con generateAndSaveBrief().

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await completeSession(db, id)
  return NextResponse.json({ status: s.status })
}
