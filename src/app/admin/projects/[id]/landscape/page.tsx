import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable } from '@/lib/db/store'
import { derivePhases } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectHeader } from '@/components/ProjectHeader'
import { ACTIVIDAD_DEMO, TENDENCIAS_DEMO } from '@/lib/landscape/stages'
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
  const phases = derivePhases(id, projectSignals({ sessions: rawSessions, tieneEntregable: !!deliverable }))

  return (
    <AdminShell activeProjectId={id}>
      <div className="space-y-8">
      <ProjectHeader name={project.name} phases={phases} active="landscape" />
      <LandscapeWorkspace tendencias={TENDENCIAS_DEMO} actividad={ACTIVIDAD_DEMO} />
      </div>
    </AdminShell>
  )
}
