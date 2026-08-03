import { db } from '@/lib/db/client'
import {
  getProjectWithSessions, getDeliverable,
  landscapeState, listLandscapeActivity, summarizeLandscape, type TendenciasContent,
} from '@/lib/db/store'
import { derivePhases } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectHeader } from '@/components/ProjectHeader'
import { buildStages, haceCuanto, textoActividad } from '@/lib/landscape/stages'
import { LandscapeWorkspace } from './LandscapeWorkspace'

export const dynamic = 'force-dynamic'

export default async function LandscapeView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return (
    <AdminShell activeProjectId={id}>
      <p className="pt-16 text-center text-[15px] text-[#8a8170]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = await getDeliverable(db, id)
  const rawSessions = project.sessions as { status?: string | null }[]
  const estado = await landscapeState(db, id)
  const phases = derivePhases(id, projectSignals({
    sessions: rawSessions, tieneEntregable: !!deliverable, landscape: summarizeLandscape(estado),
  }))

  const stages = buildStages(estado)

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
            // Lo que Claude escribió después de la aprobación: no desplaza a lo aprobado,
            // pero el panel lo tiene que poder mostrar y ofrecer al gate humano.
            borradorNuevo: e.borradorNuevo
              ? { id: e.borradorNuevo.id, content: e.borradorNuevo.content }
              : null,
          }
        : null,
    ]),
  )

  return (
    <AdminShell activeProjectId={id}>
      <div className="space-y-8">
      <ProjectHeader name={project.name} phases={phases} active="landscape" />
      <LandscapeWorkspace
        projectId={id}
        stages={stages}
        tendencias={tendenciasContent?.candidatas ?? []}
        seleccionAprobada={seleccionAprobada}
        tendenciasAprobadas={etapaTendencias.aprobada}
        contenidoPorEtapa={contenidoPorEtapa}
        actividad={actividad}
      />
      </div>
    </AdminShell>
  )
}
