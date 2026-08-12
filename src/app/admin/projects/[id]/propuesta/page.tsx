import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import type { Deliverable } from '@/lib/deliverable/schema'
import { buildProjectDeckView } from '@/lib/deck/service'
import { deriveFases, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { construirIndice, esperanDecision } from '@/lib/pipeline/indice'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectIndex } from '@/components/ProjectIndex'
import { buildStages } from '@/lib/landscape/stages'
import { buildEtapasEstrategia } from '@/lib/estrategia/stages'
import { DeliverablePanel } from '../DeliverablePanel'

export const dynamic = 'force-dynamic'

export default async function PropuestaView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return (
    <AdminShell activeProjectId={id}>
      <p className="pt-16 text-center text-[15px] text-[var(--secundario)]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = (await getDeliverable(db, id))?.content as Deliverable | null
  const deckView = await buildProjectDeckView(id)
  const rawSessions = project.sessions as { status?: string | null }[]
  const estadoLandscape = await landscapeState(db, id)
  const estrategiaEstado = await strategyState(db, id)
  const señales = projectSignals({
    sessions: rawSessions,
    tieneEntregable: !!deliverable,
    landscape: summarizeLandscape(estadoLandscape),
    estrategia: summarizeStrategy(estrategiaEstado),
  })

  // Esta pantalla no tiene etapas propias, así que no lee `?etapa=`: es una entrada sola
  // del índice, y su key va sin namespace.
  const fases = deriveFases(id, señales)
  const pantallas = derivePantallas(id, señales)
  const indice = construirIndice({
    projectId: id,
    fases,
    pantallas,
    etapaActiva: 'propuesta',
    stagesLandscape: buildStages(estadoLandscape),
    etapasEstrategia: buildEtapasEstrategia(estrategiaEstado),
    esperanDecision: [
      ...esperanDecision('landscape', estadoLandscape),
      ...esperanDecision('estrategia', estrategiaEstado),
    ],
  })
  const actual = pantallaActual(fases, pantallas)

  return (
    <AdminShell
      activeProjectId={id}
      indice={
        <ProjectIndex
          nombre={project.name}
          subtitulo={`${actual.label} · ${actual.detalle}`}
          fases={indice}
        />
      }
    >
      <DeliverablePanel
        projectId={id}
        view={deckView}
        personalidad={deliverable?.personalidad ?? null}
        sessionsCount={rawSessions.length}
      />
    </AdminShell>
  )
}
