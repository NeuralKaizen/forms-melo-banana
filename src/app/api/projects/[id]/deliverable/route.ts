import { NextResponse } from 'next/server'
import { generateProjectDeliverable } from '@/lib/deliverable/service'
import type { PartKey } from '@/lib/deliverable/schema'

const PARTS: PartKey[] = ['personalidad', 'problema', 'competencia', 'perfil', 'propuestaValor']

// Cada request genera UNA parte (una sola llamada al modelo, ~30-60s). El entregable
// completo son 5 requests encadenados desde el cliente (ver DeliverablePanel), así que
// ninguna función sola se acerca al tope de 300s del plan.
export const maxDuration = 300

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const partParam = new URL(req.url).searchParams.get('part')
  if (partParam && !PARTS.includes(partParam as PartKey))
    return NextResponse.json({ error: `part inválido: ${partParam}` }, { status: 400 })
  try {
    const content = await generateProjectDeliverable(id, partParam ? { part: partParam as PartKey } : {})
    return NextResponse.json(content)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
