import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { derivePhases } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectHeader } from '@/components/ProjectHeader'
import { PhaseNote } from '@/components/PhaseNote'

export const dynamic = 'force-dynamic'

export default async function EntregaView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return (
    <AdminShell activeProjectId={id}>
      <p className="pt-16 text-center text-[15px] text-[#8a8170]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = await getDeliverable(db, id)
  const rawSessions = project.sessions as { status?: string | null }[]
  const estadoLandscape = await landscapeState(db, id)
  const phases = derivePhases(id, projectSignals({
    sessions: rawSessions, tieneEntregable: !!deliverable, landscape: summarizeLandscape(estadoLandscape),
  }))
  const entrega = phases.find(p => p.key === 'entrega')!

  return (
    <AdminShell activeProjectId={id}>
      <div className="space-y-8">
      <ProjectHeader name={project.name} phases={phases} active="entrega" />
      <PhaseNote
        titulo="Entrega"
        estado={entrega.status}
        bajada={entrega.detalle}
      >
        <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-[#8a8170]">
          El cierre del proyecto: el landscape presentado al cliente. Acá va a vivir lo entregado, que es
          lo que después alimenta el archivo del estudio y queda disponible para los próximos proyectos.
        </p>
      </PhaseNote>
      </div>
    </AdminShell>
  )
}
