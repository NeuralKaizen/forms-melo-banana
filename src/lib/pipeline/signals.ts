import type { ProjectSignals } from './phases'
import { STAGE_ORDER } from '@/lib/landscape/stages'
import { ETAPA_ORDER } from '@/lib/estrategia/stages'

/**
 * Adapta lo que hay guardado al modelo de grupos.
 *
 * Una señal todavía no vive en la base: la versión post-taller. El estado real del
 * landscape y el de estrategia sí — los trae quien llama, con
 * `summarizeLandscape(landscapeState(db, id))` y el equivalente de estrategia, porque
 * esta función no toca la base (la usan tanto server components con `id` como el
 * listado, que arma la señal por proyecto). Sin `landscape` o sin `estrategia`, cada
 * una cae a "nada aprobado" en vez de inventar un conteo — mejor un cero verdadero que
 * un número que no es de nadie.
 */
export function projectSignals(input: {
  sessions: { status?: string | null }[]
  tieneEntregable: boolean
  landscape?: { aprobadas: number; total: number }
  estrategia?: { aprobadas: number; total: number }
}): ProjectSignals {
  return {
    sessionsTotal: input.sessions.length,
    sessionsCompleted: input.sessions.filter(s => s.status === 'completed').length,
    tieneEntregable: input.tieneEntregable,
    tienePostTaller: false,
    landscapeEtapasAprobadas: input.landscape?.aprobadas ?? 0,
    landscapeEtapasTotal: input.landscape?.total ?? STAGE_ORDER.length,
    estrategiaEtapasAprobadas: input.estrategia?.aprobadas ?? 0,
    estrategiaEtapasTotal: input.estrategia?.total ?? ETAPA_ORDER.length,
  }
}
