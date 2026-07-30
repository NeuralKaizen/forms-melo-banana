import type { ProjectSignals } from './phases'

/**
 * Adapta lo que hay guardado al modelo de fases.
 *
 * Dos señales todavía no viven en la base: la versión post-taller y el estado real de las
 * etapas del landscape. La pantalla /landscape ya lee `landscapeState` directamente (fase 2,
 * columna vertebral); esta cabecera —que se muestra en todas las pantallas del proyecto, no
 * solo en esa— todavía no, así que por ahora repite el mismo conteo fijo (2 de 5 etapas
 * aplicables aprobadas) que antes venía del contenido de demostración. Conectarla a
 * `landscapeState` es trabajo de otra tarea, no de esta.
 */
export function projectSignals(input: {
  sessions: { status?: string | null }[]
  tieneEntregable: boolean
}): ProjectSignals {
  return {
    sessionsTotal: input.sessions.length,
    sessionsCompleted: input.sessions.filter(s => s.status === 'completed').length,
    tieneEntregable: input.tieneEntregable,
    tienePostTaller: false,
    landscapeEtapasAprobadas: 2,
    landscapeEtapasTotal: 5,
  }
}
