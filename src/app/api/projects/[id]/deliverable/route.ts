import { NextResponse } from 'next/server'
import { generateProjectDeliverable } from '@/lib/deliverable/service'
import type { PartKey } from '@/lib/deliverable/schema'

const PARTS: PartKey[] = ['personalidad', 'problema', 'competencia', 'perfil', 'propuestaValor']

// El entregable completo son 5 llamadas al modelo encadenadas: medido en prod, ~270s.
// Con 300 el margen era de 33s y un día lento del proveedor lo tumbaba.
export const maxDuration = 800

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
