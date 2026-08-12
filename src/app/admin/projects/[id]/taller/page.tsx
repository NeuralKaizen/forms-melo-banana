import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { construirIndice, esperanDecision } from '@/lib/pipeline/indice'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectIndex } from '@/components/ProjectIndex'
import { PhaseNote } from '@/components/PhaseNote'
import { buildStages } from '@/lib/landscape/stages'
import { buildEtapasEstrategia } from '@/lib/estrategia/stages'

export const dynamic = 'force-dynamic'

export default async function TallerView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return (
    <AdminShell activeProjectId={id}>
      <p className="pt-16 text-center text-[15px] text-[var(--secundario)]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = await getDeliverable(db, id)
  const rawSessions = project.sessions as { status?: string | null }[]
  const estadoLandscape = await landscapeState(db, id)
  const estrategiaEstado = await strategyState(db, id)
  const señales = projectSignals({
    sessions: rawSessions,
    tieneEntregable: !!deliverable,
    landscape: summarizeLandscape(estadoLandscape),
    estrategia: summarizeStrategy(estrategiaEstado),
  })
  const fases = deriveFases(id, señales)
  const pantallas = derivePantallas(id, señales)
  const taller = pantallas.taller

  // Esta pantalla no tiene etapas propias, así que no lee `?etapa=`: es una entrada sola
  // del índice, y su key va sin namespace.
  const indice = construirIndice({
    projectId: id,
    fases,
    pantallas,
    etapaActiva: 'taller',
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
      <PhaseNote
        titulo="Taller"
        estado={taller.status}
        bajada={taller.detalle}
      >
        <p className="mt-4 max-w-[60ch] text-[14px] leading-[1.66] text-[var(--secundario)]">
          El taller se hace en Miro, con el equipo y el cliente en la misma mesa. Lo que importa acá es lo
          que vuelve de esa sesión: la propuesta de valor refinada y los cuatro competidores definidos, que
          es de lo que depende el panorama de categoría del landscape.
        </p>
        <p className="mt-4 max-w-[60ch] border-l-[1.5px] border-[var(--ink)] pl-3 text-[13px] leading-[1.66] text-[var(--secundario)]">
          Todavía no se pueden transcribir las conclusiones desde el panel. Es la próxima pieza de esta
          fase: sin ella, lo que el taller decide no vuelve al proyecto.
        </p>
      </PhaseNote>
    </AdminShell>
  )
}
