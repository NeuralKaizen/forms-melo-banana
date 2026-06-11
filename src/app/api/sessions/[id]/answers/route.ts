import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { saveAnswer } from '@/lib/db/store'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (!body.questionId || typeof body.rawText !== 'string') {
    return NextResponse.json({ error: 'questionId and rawText required' }, { status: 400 })
  }
  const row = await saveAnswer(db, id, {
    questionId: body.questionId, rawText: body.rawText, imageChoice: body.imageChoice,
  })
  return NextResponse.json({ id: row.id })
}
