import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { completeSession } from '@/lib/db/store'
import { generateAndSaveBrief } from '@/lib/brief/service'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await completeSession(db, id)
  try { await generateAndSaveBrief(id) } catch (e) { console.error('brief failed', e) }
  return NextResponse.json({ status: s.status })
}
