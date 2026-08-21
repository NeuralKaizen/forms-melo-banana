import { db } from '@/lib/db/client'
import {
  getProjectWithSessions, getDeliverable, listProjects, answerCountsByProject,
  landscapeState, summarizeLandscape,
} from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { construirIndice, esperanDecision } from '@/lib/pipeline/indice'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectIndex } from '@/components/ProjectIndex'
import { buildStages } from '@/lib/landscape/stages'
import { buildEtapasEstrategia } from '@/lib/estrategia/stages'
import { RespondentsList, type Respondent } from './RespondentsList'
import { CopiarLinkEntrevista } from './CopiarLinkEntrevista'

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
      <p className="pt-16 text-center text-[15px] text-[var(--secundario)]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = await getDeliverable(db, id)
  const allProjects = await listProjects(db) as { id: string; name: string }[]
  const counts = await answerCountsByProject(db, id)
  const rawSessions = project.sessions as SessionRow[]
  const estadoLandscape = await landscapeState(db, id)
  const estrategiaEstado = await strategyState(db, id)
  const señales = projectSignals({
    sessions: rawSessions,
    tieneEntregable: !!deliverable,
    landscape: summarizeLandscape(estadoLandscape),
    estrategia: summarizeStrategy(estrategiaEstado),
  })

  // Esta pantalla no tiene etapas propias, así que no lee `?etapa=`: es una entrada sola
  // del índice, y su key va sin namespace.
  const fases = deriveFases(id, señales)
  const pantallas = derivePantallas(id, señales)
  const indice = construirIndice({
    projectId: id,
    fases,
    pantallas,
    etapaActiva: 'entrevistas',
    stagesLandscape: buildStages(estadoLandscape),
    etapasEstrategia: buildEtapasEstrategia(estrategiaEstado),
    esperanDecision: [
      ...esperanDecision('landscape', estadoLandscape),
      ...esperanDecision('estrategia', estrategiaEstado),
    ],
  })
  const actual = pantallaActual(fases, pantallas)

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
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">
              Entrevistas / Propuesta de valor
            </p>
            <h1 className="mt-2 font-serif text-[30px] font-normal tracking-[-.02em] text-[var(--ink)]">Entrevistas</h1>
            <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.66] text-[var(--secundario)]">
              Lo que dijo cada persona, en sus palabras. Es la materia prima de todo lo que viene después.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {respondents.length > 0 && (
              <p className="text-[13px] tabular-nums text-[var(--rotulo)]">
                {completas} de {respondents.length} completas
              </p>
            )}
            <CopiarLinkEntrevista projectId={id} />
          </div>
        </div>

        <div className="mt-8">
          <RespondentsList projectId={id} respondents={respondents} projects={allProjects} />
        </div>
      </section>
    </AdminShell>
  )
}
