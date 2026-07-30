/**
 * Las fases por las que pasa un proyecto, de punta a punta.
 *
 * Es la columna vertebral del panel: cada pantalla es una fase, y el estado de cada una
 * se deriva de lo que hay guardado — no se marca a mano. Ver
 * docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md
 */

export type PhaseKey = 'entrevistas' | 'propuesta' | 'taller' | 'landscape' | 'entrega'

export type PhaseStatus =
  | 'pendiente'  // todavía no le toca, o le toca y nadie la empezó
  | 'en_curso'   // empezada
  | 'espera'     // hecha por fuera de la plataforma, esperando que vuelva
  | 'completa'

export interface Phase {
  key: PhaseKey
  label: string
  status: PhaseStatus
  /** Una línea que explica por qué está en ese estado. */
  detalle: string
  /** Dónde se trabaja. Toda fase tiene pantalla: el recorrido se navega entero. */
  href: string
  /** Algo que esta fase necesita de otra y que aún no llegó. */
  dependencia?: string
}

export interface ProjectSignals {
  sessionsTotal: number
  sessionsCompleted: number
  tieneEntregable: boolean
  /** La propuesta de valor refinada en el taller, transcrita de vuelta. */
  tienePostTaller: boolean
  landscapeEtapasAprobadas: number
  landscapeEtapasTotal: number
}

export const PHASE_LABEL: Record<PhaseKey, string> = {
  entrevistas: 'Entrevistas',
  propuesta: 'Propuesta de valor',
  taller: 'Taller',
  landscape: 'Landscape',
  entrega: 'Entrega',
}

export function derivePhases(projectId: string, s: ProjectSignals): Phase[] {
  const href = (key: PhaseKey) => `/admin/projects/${projectId}/${key}`
  const entrevistasHref = href('entrevistas')
  const propuestaHref = href('propuesta')
  const tallerHref = href('taller')
  const landscapeHref = href('landscape')

  const entrevistas: Phase =
    s.sessionsTotal === 0
      ? { key: 'entrevistas', label: PHASE_LABEL.entrevistas, status: 'pendiente', detalle: 'Sin respondientes', href: entrevistasHref }
      : s.sessionsCompleted < s.sessionsTotal
        ? { key: 'entrevistas', label: PHASE_LABEL.entrevistas, status: 'en_curso', detalle: `${s.sessionsCompleted} de ${s.sessionsTotal} completadas`, href: entrevistasHref }
        : { key: 'entrevistas', label: PHASE_LABEL.entrevistas, status: 'completa', detalle: `${s.sessionsTotal} completadas`, href: entrevistasHref }

  const propuesta: Phase = s.tieneEntregable
    ? { key: 'propuesta', label: PHASE_LABEL.propuesta, status: 'completa', detalle: 'Generada', href: propuestaHref }
    : s.sessionsCompleted > 0
      ? { key: 'propuesta', label: PHASE_LABEL.propuesta, status: 'pendiente', detalle: 'Lista para generar', href: propuestaHref }
      : { key: 'propuesta', label: PHASE_LABEL.propuesta, status: 'pendiente', detalle: 'Necesita entrevistas completas', href: propuestaHref }

  // El taller ocurre en Miro, fuera de la plataforma. Lo que importa acá es si las
  // conclusiones volvieron: el landscape depende de ellas.
  const taller: Phase = !s.tieneEntregable
    ? { key: 'taller', label: PHASE_LABEL.taller, status: 'pendiente', detalle: 'Necesita la propuesta de valor', href: tallerHref }
    : s.tienePostTaller
      ? { key: 'taller', label: PHASE_LABEL.taller, status: 'completa', detalle: 'Conclusiones transcritas', href: tallerHref }
      : { key: 'taller', label: PHASE_LABEL.taller, status: 'espera', detalle: 'Se trabaja en Miro · faltan las conclusiones', href: tallerHref }

  const landscapeCompleto = s.landscapeEtapasTotal > 0 && s.landscapeEtapasAprobadas === s.landscapeEtapasTotal
  const landscape: Phase = {
    key: 'landscape',
    label: PHASE_LABEL.landscape,
    href: landscapeHref,
    ...(landscapeCompleto
      ? { status: 'completa' as const, detalle: 'Todas las etapas aprobadas' }
      : s.landscapeEtapasAprobadas > 0
        ? { status: 'en_curso' as const, detalle: `${s.landscapeEtapasAprobadas} de ${s.landscapeEtapasTotal} etapas aprobadas` }
        : { status: 'pendiente' as const, detalle: 'Sin empezar' }),
    // Dependencia real del proceso: el cuadro de brand assets se arma sobre los 4
    // competidores que se definen en el taller.
    ...(s.tienePostTaller ? {} : { dependencia: 'El panorama de categoría necesita los competidores del taller' }),
  }

  const entrega: Phase = landscapeCompleto
    ? { key: 'entrega', label: PHASE_LABEL.entrega, status: 'pendiente', detalle: 'Lista para presentar', href: href('entrega') }
    : { key: 'entrega', label: PHASE_LABEL.entrega, status: 'pendiente', detalle: 'Espera el landscape', href: href('entrega') }

  return [entrevistas, propuesta, taller, landscape, entrega]
}

/** La fase donde está parado el proyecto: la primera que no está completa. */
export function currentPhase(phases: Phase[]): Phase {
  return phases.find(p => p.status !== 'completa') ?? phases[phases.length - 1]
}

/** La anterior y la siguiente, para moverse por el recorrido sin volver al listado. */
export function neighbours(phases: Phase[], key: PhaseKey): { prev: Phase | null; next: Phase | null } {
  const i = phases.findIndex(p => p.key === key)
  return {
    prev: i > 0 ? phases[i - 1] : null,
    next: i >= 0 && i < phases.length - 1 ? phases[i + 1] : null,
  }
}
