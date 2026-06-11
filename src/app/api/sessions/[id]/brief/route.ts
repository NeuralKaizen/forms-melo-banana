import { NextResponse } from 'next/server'
import { generateAndSaveBrief } from '@/lib/brief/service'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try { return NextResponse.json(await generateAndSaveBrief(id)) }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
