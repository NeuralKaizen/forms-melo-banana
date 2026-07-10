import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, listProjects } from '@/lib/db/store'
import type { Deliverable } from '@/lib/deliverable/schema'
import { DeliverablePanel } from './DeliverablePanel'

export const dynamic = 'force-dynamic'

export default async function ProjectView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return <main className="p-8">Proyecto no encontrado.</main>
  const deliverable = (await getDeliverable(db, id))?.content as Deliverable | null
  const allProjects = await listProjects(db) as { id: string; name: string }[]
  const sessions = (project.sessions as { id: string; name?: string | null; role?: string | null }[])
    .map(s => ({ id: s.id, name: s.name ?? '—', role: s.role ?? '—' }))

  return <main className="mx-auto max-w-3xl space-y-8 p-8">
    <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
    <DeliverablePanel
      projectId={id}
      initial={deliverable ?? null}
      sessions={sessions}
      projects={allProjects}
    />
  </main>
}
