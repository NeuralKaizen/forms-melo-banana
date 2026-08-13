import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { construirIndice, esperanDecision, resolverEtapaActiva } from '@/lib/pipeline/indice'
import { procedenciaDeVersion, autorDeVersion } from '@/lib/pipeline/procedencia'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectIndex } from '@/components/ProjectIndex'
import { buildStages, haceCuanto } from '@/lib/landscape/stages'
import { buildEtapasEstrategia, ETAPA_ORDER, type EstrategiaKey } from '@/lib/estrategia/stages'
import { EstrategiaWorkspace } from './EstrategiaWorkspace'

export const dynamic = 'force-dynamic'

export default async function EstrategiaView({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ etapa?: string; todas?: string }>
}) {
  const { id } = await params
  const { etapa, todas } = await searchParams
  const project = await getProjectWithSessions(db, id)
  if (!project) return (
    <AdminShell activeProjectId={id}>
      <p className="pt-16 text-center text-[15px] text-[var(--secundario)]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = await getDeliverable(db, id)
  const rawSessions = project.sessions as { status?: string | null }[]
  const landscapeEstado = await landscapeState(db, id)
  const estado = await strategyState(db, id)
  const etapas = buildEtapasEstrategia(estado)
  const resumen = summarizeStrategy(estado)
  const señales = projectSignals({
    sessions: rawSessions,
    tieneEntregable: !!deliverable,
    landscape: summarizeLandscape(landscapeEstado),
    estrategia: resumen,
  })

  // La query manda, pero sólo si nombra una etapa real: una `?etapa=` inventada cae a la
  // primera que se pueda trabajar en vez de romper la página.
  const etapaActiva: EstrategiaKey = resolverEtapaActiva(etapa, ETAPA_ORDER, etapas)

  const fases = deriveFases(id, señales)
  const pantallas = derivePantallas(id, señales)
  const indice = construirIndice({
    projectId: id,
    fases,
    pantallas,
    etapaActiva: `estrategia:${etapaActiva}`,
    stagesLandscape: buildStages(landscapeEstado),
    etapasEstrategia: etapas,
    esperanDecision: [
      ...esperanDecision('landscape', landscapeEstado),
      ...esperanDecision('estrategia', estado),
    ],
    todas: todas === '1',
  })
  const actual = pantallaActual(fases, pantallas)
  // Lo que la fase necesita de otra y todavía no llegó. Lo rendía `ProjectHeader`; ahora
  // vive en el área de trabajo, que es donde el equipo se pregunta por qué no puede avanzar.
  const dependencia = fases.find(f => f.key === 'estrategia')?.dependencia

  const ahora = new Date()
  const contenidoPorEtapa = Object.fromEntries(
    estado.map(e => [
      e.stage,
      e.actual
        ? {
            id: e.actual.id,
            content: e.actual.content,
            aprobada: !!e.actual.approvedAt,
            procedencia: procedenciaDeVersion(e.actual, ahora),
            cuando: haceCuanto(e.actual.createdAt, ahora),
            // Lo que Claude escribió después de la aprobación: no desplaza a lo aprobado,
            // pero el panel lo tiene que poder mostrar y ofrecer al gate humano.
            borradorNuevo: e.borradorNuevo
              ? {
                  id: e.borradorNuevo.id,
                  content: e.borradorNuevo.content,
                  cuando: haceCuanto(e.borradorNuevo.createdAt, ahora),
                  autor: autorDeVersion(e.borradorNuevo),
                }
              : null,
          }
        : null,
    ]),
  )

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
      <EstrategiaWorkspace
        projectId={id}
        etapaActiva={etapaActiva}
        etapas={etapas}
        contenidoPorEtapa={contenidoPorEtapa}
        dependencia={dependencia}
      />
    </AdminShell>
  )
}
