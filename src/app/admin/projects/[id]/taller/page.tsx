import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable } from '@/lib/db/store'
import { derivePhases } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectHeader } from '@/components/ProjectHeader'
import { PhaseNote } from '@/components/PhaseNote'

export const dynamic = 'force-dynamic'

export default async function TallerView({ params }: { params: Promise<{ id: string }> }) {
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
  const taller = phases.find(p => p.key === 'taller')!

  return (
    <AdminShell activeProjectId={id}>
      <div className="space-y-8">
      <ProjectHeader name={project.name} phases={phases} active="taller" />
      <PhaseNote
        titulo="Taller"
        estado={taller.status}
        bajada={taller.detalle}
      >
        <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-[#8a8170]">
          El taller se hace en Miro, con el equipo y el cliente en la misma mesa. Lo que importa acá es lo
          que vuelve de esa sesión: la propuesta de valor refinada y los cuatro competidores definidos, que
          es de lo que depende el panorama de categoría del landscape.
        </p>
        <p className="mt-4 max-w-xl rounded-xl border border-[#f0e3bc] bg-[#fffdf0] px-4 py-3 text-[13px] leading-relaxed text-[#6b5a2a]">
          Todavía no se pueden transcribir las conclusiones desde el panel. Es la próxima pieza de esta
          fase: sin ella, lo que el taller decide no vuelve al proyecto.
        </p>
      </PhaseNote>
      </div>
    </AdminShell>
  )
}
