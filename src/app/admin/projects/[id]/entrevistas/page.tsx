import { db } from '@/lib/db/client'
import {
  getProjectWithSessions, getDeliverable, listProjects, answerCountsByProject,
  landscapeState, summarizeLandscape,
} from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectHeader } from '@/components/ProjectHeader'
import { RespondentsList, type Respondent } from './RespondentsList'

export const dynamic = 'force-dynamic'

type SessionRow = {
  id: string
  name?: string | null
  role?: string | null
  company?: string | null
  status?: string | null
  createdAt?: Date | string | null
  completedAt?: Date | string | null
}

const fmt = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default async function EntrevistasView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return (
    <AdminShell activeProjectId={id}>
      <p className="pt-16 text-center text-[15px] text-[#8a8170]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = await getDeliverable(db, id)
  const allProjects = await listProjects(db) as { id: string; name: string }[]
  const counts = await answerCountsByProject(db, id)
  const rawSessions = project.sessions as SessionRow[]
  const estadoLandscape = await landscapeState(db, id)
  const estrategia = summarizeStrategy(await strategyState(db, id))
  const fases = deriveFases(id, projectSignals({
    sessions: rawSessions, tieneEntregable: !!deliverable, landscape: summarizeLandscape(estadoLandscape), estrategia,
  }))

  const respondents: Respondent[] = rawSessions.map(s => ({
    id: s.id,
    name: s.name ?? 'Sin nombre',
    role: s.role ?? '—',
    company: s.company ?? '',
    completa: s.status === 'completed',
    fecha: fmt(s.completedAt ?? s.createdAt),
    respuestas: counts[s.id] ?? 0,
  }))

  const completas = respondents.filter(r => r.completa).length

  return (
    <AdminShell activeProjectId={id}>
      <div className="space-y-8">
      <ProjectHeader name={project.name} fases={fases} active="entrevistas" />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-medium text-ink">Entrevistas</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[#8a8170]">
              Lo que dijo cada persona, en sus palabras. Es la materia prima de todo lo que viene después.
            </p>
          </div>
          {respondents.length > 0 && (
            <p className="text-[13px] text-[#a59c89] tabular-nums">
              {completas} de {respondents.length} completas
            </p>
          )}
        </div>

        <RespondentsList projectId={id} respondents={respondents} projects={allProjects} />
      </section>
      </div>
    </AdminShell>
  )
}
