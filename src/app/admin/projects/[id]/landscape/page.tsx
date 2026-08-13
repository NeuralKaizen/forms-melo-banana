import { db } from '@/lib/db/client'
import {
  getProjectWithSessions, getDeliverable,
  landscapeState, listLandscapeActivity, summarizeLandscape, type TendenciasContent,
} from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { construirIndice, esperanDecision, resolverEtapaActiva } from '@/lib/pipeline/indice'
import { procedenciaDeVersion, autorDeVersion } from '@/lib/pipeline/procedencia'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectIndex } from '@/components/ProjectIndex'
import { buildStages, haceCuanto, textoActividad, STAGE_ORDER, type StageKey } from '@/lib/landscape/stages'
import { buildEtapasEstrategia } from '@/lib/estrategia/stages'
import { LandscapeWorkspace } from './LandscapeWorkspace'

export const dynamic = 'force-dynamic'

export default async function LandscapeView({ params, searchParams }: {
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
  const estado = await landscapeState(db, id)
  const estrategiaEstado = await strategyState(db, id)
  const señales = projectSignals({
    sessions: rawSessions,
    tieneEntregable: !!deliverable,
    landscape: summarizeLandscape(estado),
    estrategia: summarizeStrategy(estrategiaEstado),
  })

  const stages = buildStages(estado)

  // La query manda, pero sólo si nombra una etapa real: una `?etapa=` inventada cae a la
  // primera que se pueda trabajar en vez de romper la página.
  const etapaActiva: StageKey = resolverEtapaActiva(etapa, STAGE_ORDER, stages)

  const fases = deriveFases(id, señales)
  const pantallas = derivePantallas(id, señales)
  const indice = construirIndice({
    projectId: id,
    fases,
    pantallas,
    etapaActiva: `landscape:${etapaActiva}`,
    stagesLandscape: stages,
    etapasEstrategia: buildEtapasEstrategia(estrategiaEstado),
    esperanDecision: [
      ...esperanDecision('landscape', estado),
      ...esperanDecision('estrategia', estrategiaEstado),
    ],
    todas: todas === '1',
  })
  const actual = pantallaActual(fases, pantallas)
  // Lo que la fase necesita de otra y todavía no llegó. Lo rendía `ProjectHeader`; ahora
  // vive en el área de trabajo, que es donde el equipo se pregunta por qué no puede avanzar.
  const dependencia = fases.find(f => f.key === 'landscape')?.dependencia

  const etapaTendencias = estado.find(e => e.stage === 'tendencias')!
  // La long list se toma de la versión más nueva, igual criterio que el gate en
  // `selectTendencias`: si Claude amplió la lista después de una selección aprobada, el
  // equipo tiene que ver la lista ampliada para poder re-elegir sobre ella.
  const versionLongList = etapaTendencias.borradorNuevo ?? etapaTendencias.actual
  const tendenciasContent = versionLongList?.content as TendenciasContent | undefined
  // La selección marcada, en cambio, es la que el equipo aprobó — no la que venga en un
  // borrador que todavía nadie decidió.
  const seleccionAprobada = (etapaTendencias.actual?.content as TendenciasContent | undefined)?.seleccionadas ?? []

  // Se formatea el tiempo en el servidor para que no baile entre servidor y cliente.
  const ahora = new Date()
  const actividad = (await listLandscapeActivity(db, id)).map(e => ({
    id: e.id,
    autor: e.autor,
    quien: e.quien,
    texto: textoActividad(e),
    cuando: haceCuanto(e.cuando, ahora),
  }))

  const contenidoPorEtapa = Object.fromEntries(
    estado.map(e => [
      e.stage,
      e.actual
        ? {
            id: e.actual.id,
            content: e.actual.content,
            aprobada: !!e.actual.approvedAt,
            // Con `origen`: si la vigente ratifica una anterior —el equipo mantuvo lo
            // aprobado—, quién escribió y cuándo salen de la copiada. Sin eso, la fila
            // nueva haría parecer recién escrito algo de hace días.
            procedencia: procedenciaDeVersion(e.actual, ahora, e.origen),
            // Misma razón en la cabecera de la columna vigente del comparador.
            cuando: haceCuanto((e.origen ?? e.actual).createdAt, ahora),
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
      <LandscapeWorkspace
        projectId={id}
        etapaActiva={etapaActiva}
        stages={stages}
        tendencias={tendenciasContent?.candidatas ?? []}
        seleccionAprobada={seleccionAprobada}
        tendenciasAprobadas={etapaTendencias.aprobada}
        contenidoPorEtapa={contenidoPorEtapa}
        actividad={actividad}
        dependencia={dependencia}
      />
    </AdminShell>
  )
}
