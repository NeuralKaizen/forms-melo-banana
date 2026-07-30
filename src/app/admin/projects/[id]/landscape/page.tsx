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
  const tendenciasContent = etapaTendencias.actual?.content as TendenciasContent | undefined

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
      e.actual ? { id: e.actual.id, content: e.actual.content, aprobada: !!e.actual.approvedAt } : null,
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
        seleccionAprobada={tendenciasContent?.seleccionadas ?? []}
        tendenciasAprobadas={etapaTendencias.aprobada}
        contenidoPorEtapa={contenidoPorEtapa}
        actividad={actividad}
      />
      </div>
    </AdminShell>
  )
}
