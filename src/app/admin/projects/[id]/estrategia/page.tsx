import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectHeader } from '@/components/ProjectHeader'
import { buildEtapasEstrategia } from '@/lib/estrategia/stages'
import { EstrategiaWorkspace } from './EstrategiaWorkspace'

export const dynamic = 'force-dynamic'

export default async function EstrategiaView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return (
    <AdminShell activeProjectId={id}>
      <p className="pt-16 text-center text-[15px] text-[#8a8170]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = await getDeliverable(db, id)
  const rawSessions = project.sessions as { status?: string | null }[]
  const landscapeEstado = await landscapeState(db, id)
  const estado = await strategyState(db, id)
  const etapas = buildEtapasEstrategia(estado)
  const resumen = summarizeStrategy(estado)
  // La cabecera muestra el mismo recorrido por fases que el resto del proyecto — acá ya
  // no arma su propio link a estrategia, es una fase más de `deriveFases`.
  const fases = deriveFases(id, projectSignals({
    sessions: rawSessions, tieneEntregable: !!deliverable, landscape: summarizeLandscape(landscapeEstado), estrategia: resumen,
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
      <ProjectHeader name={project.name} fases={fases} active="estrategia" />
      <EstrategiaWorkspace
        projectId={id}
        etapas={etapas}
        resumen={resumen}
        contenidoPorEtapa={contenidoPorEtapa}
      />
      </div>
    </AdminShell>
  )
}
