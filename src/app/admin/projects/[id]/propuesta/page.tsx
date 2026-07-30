import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable } from '@/lib/db/store'
import type { Deliverable } from '@/lib/deliverable/schema'
import { buildProjectDeckView } from '@/lib/deck/service'
import { derivePhases } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectHeader } from '@/components/ProjectHeader'
import { DeliverablePanel } from '../DeliverablePanel'

export const dynamic = 'force-dynamic'

export default async function PropuestaView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return (
    <AdminShell activeProjectId={id}>
      <p className="pt-16 text-center text-[15px] text-[#8a8170]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = (await getDeliverable(db, id))?.content as Deliverable | null
  const deckView = await buildProjectDeckView(id)
  const rawSessions = project.sessions as { status?: string | null }[]
  const phases = derivePhases(id, projectSignals({ sessions: rawSessions, tieneEntregable: !!deliverable }))

  return (
    <AdminShell activeProjectId={id}>
      <div className="space-y-8">
      <ProjectHeader name={project.name} phases={phases} active="propuesta" />
      <DeliverablePanel
        projectId={id}
        view={deckView}
        personalidad={deliverable?.personalidad ?? null}
        sessionsCount={rawSessions.length}
      />
      </div>
    </AdminShell>
  )
}
