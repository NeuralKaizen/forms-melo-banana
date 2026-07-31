import type { ProjectSignals } from './phases'
import { STAGE_ORDER } from '@/lib/landscape/stages'

/**
 * Adapta lo que hay guardado al modelo de fases.
 *
 * Una señal todavía no vive en la base: la versión post-taller. El estado real del
 * landscape sí — lo trae quien llama, con `summarizeLandscape(landscapeState(db, id))`,
 * porque esta función no toca la base (la usan tanto server components con `id` como el
 * listado, que arma la señal por proyecto). Sin `landscape`, cae a "nada aprobado de las
 * seis etapas" en vez de inventar un conteo — mejor un cero verdadero que un número que
 * no es de nadie.
 */
export function projectSignals(input: {
  sessions: { status?: string | null }[]
  tieneEntregable: boolean
  landscape?: { aprobadas: number; total: number }
}): ProjectSignals {
  return {
    sessionsTotal: input.sessions.length,
    sessionsCompleted: input.sessions.filter(s => s.status === 'completed').length,
    tieneEntregable: input.tieneEntregable,
    tienePostTaller: false,
    landscapeEtapasAprobadas: input.landscape?.aprobadas ?? 0,
    landscapeEtapasTotal: input.landscape?.total ?? STAGE_ORDER.length,
  }
}
