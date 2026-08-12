import { redirect, notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'

export const dynamic = 'force-dynamic'

/**
 * El proyecto no es una pantalla: es un recorrido. Entrar por la raíz te deja parado en la
 * fase donde el proyecto realmente está, y desde ahí se camina con la cabecera.
 */
export default async function ProjectView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) notFound()

  const deliverable = await getDeliverable(db, id)
  const estadoLandscape = await landscapeState(db, id)
  const estrategia = summarizeStrategy(await strategyState(db, id))
  const señales = projectSignals({
    sessions: project.sessions as { status?: string | null }[],
    tieneEntregable: !!deliverable,
    landscape: summarizeLandscape(estadoLandscape),
    estrategia,
  })
  const fases = deriveFases(id, señales)

  redirect(pantallaActual(fases, derivePantallas(id, señales)).href)
}
