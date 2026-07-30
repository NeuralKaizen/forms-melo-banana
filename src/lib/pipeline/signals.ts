import { STAGES } from '@/lib/landscape/stages'
import type { ProjectSignals } from './phases'

/**
 * Adapta lo que hay guardado al modelo de fases.
 *
 * Dos señales todavía no viven en la base: la versión post-taller y el estado real de las
 * etapas del landscape. Llegan cuando exista el MCP (`guardar_etapa`). Hasta entonces salen
 * del contenido de demostración, que es el mismo que muestra la pantalla de Landscape — así
 * la cabecera y la pantalla nunca se contradicen.
 */
export function projectSignals(input: {
  sessions: { status?: string | null }[]
  tieneEntregable: boolean
}): ProjectSignals {
  const aplicables = STAGES.filter(s => s.status !== 'no_aplica')

  return {
    sessionsTotal: input.sessions.length,
    sessionsCompleted: input.sessions.filter(s => s.status === 'completed').length,
    tieneEntregable: input.tieneEntregable,
    tienePostTaller: false,
    landscapeEtapasAprobadas: aplicables.filter(s => s.status === 'aprobada').length,
    landscapeEtapasTotal: aplicables.length,
  }
}
