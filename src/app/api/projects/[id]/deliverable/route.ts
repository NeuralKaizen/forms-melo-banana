import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { getDeliverable, saveDeliverable, existeProyecto } from '@/lib/db/store'
import { generateProjectDeliverable } from '@/lib/deliverable/service'
import { validateProblema } from '@/lib/deliverable/steps/problema'
import { validateCompetencia } from '@/lib/deliverable/steps/competencia'
import { validatePerfil } from '@/lib/deliverable/steps/perfil'
import { validatePropuestaValor } from '@/lib/deliverable/steps/propuesta-valor'
import { esAdminRequest } from '@/lib/admin/auth'
import type { Deliverable, PartKey } from '@/lib/deliverable/schema'

const PARTS: PartKey[] = ['personalidad', 'problema', 'competencia', 'perfil', 'propuestaValor']

/**
 * Qué se puede editar a mano y con qué se valida: los mismos validadores que le exigen
 * forma al modelo se la exigen al equipo (los 4 ejes incluidos). `personalidad` no está
 * a propósito: se edita en su etapa de Estrategia, no acá.
 */
const EDITABLES: Partial<Record<PartKey, (o: unknown) => unknown>> = {
  problema: validateProblema,
  competencia: validateCompetencia,
  perfil: validatePerfil,
  propuestaValor: validatePropuestaValor,
}

// Cada request genera UNA parte (una sola llamada al modelo, ~30-60s). El entregable
// completo son 5 requests encadenados desde el cliente (ver DeliverablePanel), así que
// ninguna función sola se acerca al tope de 300s del plan.
export const maxDuration = 300

/** Edición a mano de una parte del entregable. El insumo de la exportación que viene. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!esAdminRequest(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const part = body?.part as PartKey | undefined
  const validar = part ? EDITABLES[part] : undefined
  if (!part || !validar)
    return NextResponse.json({ error: `part inválido: ${part}` }, { status: 400 })

  let data: unknown
  try {
    data = validar(body.data)
  } catch (e) {
    return NextResponse.json({ error: `contenido inválido: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 })
  }

  if (!(await existeProyecto(db, id)))
    return NextResponse.json({ error: `No existe el proyecto ${id}` }, { status: 404 })

  const prev = ((await getDeliverable(db, id))?.content ?? {}) as Deliverable
  const ahora = new Date().toISOString()
  const content: Deliverable = {
    ...prev,
    [part]: {
      data,
      // Se conserva cuándo lo generó el modelo; la edición queda fechada aparte.
      meta: { generatedAt: prev[part]?.meta.generatedAt ?? ahora, error: null, editedAt: ahora },
    },
  }
  await saveDeliverable(db, id, content)
  return NextResponse.json(content[part])
}

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
