import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { completeSession, getSessionWithAnswers, findOrCreateProject, assignSessionToProject, getProject } from '@/lib/db/store'
import { notificarEntrevistaCompleta } from '@/lib/email/notify'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Solo la primera completada devuelve fila: el entrevistado puede volver al link y
  // terminar de nuevo, y ese segundo cierre no puede repetir efectos (ver completeSession).
  const recienCompletada = await completeSession(db, id)
  const full = await getSessionWithAnswers(db, id)
  if (!full) return NextResponse.json({ error: 'no existe la sesión' }, { status: 404 })

  let proyecto: string | null = null
  try {
    const company = full.company?.trim()
    // La empresa tipeada solo decide cuando la sesión no tiene proyecto todavía (una
    // sesión de link viejo, sin `?p=`). Con proyecto puesto —por el link o porque el
    // equipo la movió a mano— re-completar no lo pisa: eso deshacía el movimiento.
    if (!full.projectId && company) {
      const project = await findOrCreateProject(db, company)
      await assignSessionToProject(db, id, project.id)
      proyecto = project.name
    } else if (full.projectId) {
      proyecto = (await getProject(db, full.projectId))?.name ?? null
    }
  } catch (e) {
    console.error('auto-assign de proyecto falló:', e)
  }

  if (recienCompletada) {
    await notificarEntrevistaCompleta({
      sessionId: id,
      nombre: full.name,
      empresa: full.company,
      proyecto,
    })
  }

  return NextResponse.json({ status: full.status })
}
