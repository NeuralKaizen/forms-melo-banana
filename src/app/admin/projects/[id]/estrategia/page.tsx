import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { construirIndice, esperanDecision } from '@/lib/pipeline/indice'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectIndex } from '@/components/ProjectIndex'
import { buildStages, haceCuanto } from '@/lib/landscape/stages'
import { buildEtapasEstrategia, ETAPA_ORDER, type EstrategiaKey } from '@/lib/estrategia/stages'
import { EstrategiaWorkspace } from './EstrategiaWorkspace'

export const dynamic = 'force-dynamic'

/** Igual que en el landscape: el pie de decisión dice de dónde viene lo que estás mirando. */
type VersionVista = { author: string; authorLabel: string | null; createdAt: Date; approvedAt: Date | null }
function procedenciaDe(v: VersionVista, ahora: Date): string {
  const quien = v.author === 'claude' ? 'Claude' : v.authorLabel ?? 'el equipo'
  return `Escrito por ${quien} · ${haceCuanto(v.createdAt, ahora)} · ${v.approvedAt ? 'aprobada' : 'sin aprobar'}`
}

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
  // primera sin aprobar en vez de romper la página.
  const primeraSinAprobar = etapas.find(e => e.status !== 'aprobada')?.key ?? ETAPA_ORDER[0]
  const etapaActiva: EstrategiaKey =
    etapa && (ETAPA_ORDER as string[]).includes(etapa) ? (etapa as EstrategiaKey) : primeraSinAprobar

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

  const ahora = new Date()
  const contenidoPorEtapa = Object.fromEntries(
    estado.map(e => [
      e.stage,
      e.actual
        ? {
            id: e.actual.id,
            content: e.actual.content,
            aprobada: !!e.actual.approvedAt,
            procedencia: procedenciaDe(e.actual, ahora),
            cuando: haceCuanto(e.actual.createdAt, ahora),
            // Lo que Claude escribió después de la aprobación: no desplaza a lo aprobado,
            // pero el panel lo tiene que poder mostrar y ofrecer al gate humano.
            borradorNuevo: e.borradorNuevo
              ? {
                  id: e.borradorNuevo.id,
                  content: e.borradorNuevo.content,
                  cuando: haceCuanto(e.borradorNuevo.createdAt, ahora),
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
      />
    </AdminShell>
  )
}
