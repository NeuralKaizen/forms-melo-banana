import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, listProjects } from '@/lib/db/store'
import type { Deliverable } from '@/lib/deliverable/schema'
import { AdminBar } from '@/components/AdminBar'
import { DeliverablePanel } from './DeliverablePanel'

export const dynamic = 'force-dynamic'

export default async function ProjectView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return <>
    <AdminBar />
    <main className="mx-auto max-w-3xl p-8 pt-24 text-center text-[15px] text-[#8a8170]">Proyecto no encontrado.</main>
  </>
  const deliverable = (await getDeliverable(db, id))?.content as Deliverable | null
  const allProjects = await listProjects(db) as { id: string; name: string }[]
  const sessions = (project.sessions as { id: string; name?: string | null; role?: string | null }[])
    .map(s => ({ id: s.id, name: s.name ?? '—', role: s.role ?? '—' }))

  return <>
    <AdminBar />
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">Proyecto</p>
        <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">{project.name}</h1>
      </header>
      <DeliverablePanel
        projectId={id}
        initial={deliverable ?? null}
        sessions={sessions}
        projects={allProjects}
      />
    </main>
  </>
}
