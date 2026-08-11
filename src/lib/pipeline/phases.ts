/**
 * Los grupos por los que pasa un proyecto, de punta a punta.
 *
 * Es la columna vertebral del panel: cada grupo es un tramo del recorrido, y el estado de
 * cada uno se deriva de lo que hay guardado — no se marca a mano. Adentro de
 * 'propuesta-valor' viven las pantallas de entrevistas, propuesta y taller, que se navegan
 * como tabs sin salir del grupo. Ver
 * docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md
 */

export type PantallaKey = 'entrevistas' | 'propuesta' | 'taller' | 'landscape' | 'estrategia'
export type GrupoKey = 'propuesta-valor' | 'landscape' | 'estrategia'

export type PhaseStatus =
  | 'pendiente'  // todavía no le toca, o le toca y nadie la empezó
  | 'en_curso'   // empezada
  | 'espera'     // hecha por fuera de la plataforma, esperando que vuelva
  | 'completa'

export interface Tab {
  key: PantallaKey
  label: string
  href: string
}

export interface Grupo {
  key: GrupoKey
  label: string
  status: PhaseStatus
  /** Una línea que explica por qué está en ese estado. */
  detalle: string
  /** Dónde va el clic en el grupo. */
  href: string
  /** Solo el grupo 'propuesta-valor' las tiene: entrevistas, propuesta y taller. */
  tabs?: Tab[]
  /** Algo que este grupo necesita de otro y que aún no llegó. */
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
  estrategiaEtapasAprobadas: number
  estrategiaEtapasTotal: number
}

const GRUPO_LABEL: Record<GrupoKey, string> = {
  'propuesta-valor': 'Entrevistas / Propuesta de valor',
  landscape: 'Landscape',
  estrategia: 'Estrategia',
}

const GRUPO_DE_PANTALLA: Record<PantallaKey, GrupoKey> = {
  entrevistas: 'propuesta-valor',
  propuesta: 'propuesta-valor',
  taller: 'propuesta-valor',
  landscape: 'landscape',
  estrategia: 'estrategia',
}

/** A qué grupo del recorrido pertenece una pantalla. */
export function grupoDePantalla(p: PantallaKey): GrupoKey {
  return GRUPO_DE_PANTALLA[p]
}

export function deriveGrupos(projectId: string, s: ProjectSignals): Grupo[] {
  const href = (key: PantallaKey) => `/admin/projects/${projectId}/${key}`
  const entrevistasHref = href('entrevistas')
  const propuestaHref = href('propuesta')
  const tallerHref = href('taller')
  const landscapeHref = href('landscape')
  const estrategiaHref = href('estrategia')

  // Detalle de cada sub-fase, para saber cuál está frenando al grupo. La lógica es la
  // misma que tenían las fases sueltas: entrevistas cuenta completadas, propuesta se
  // habilita con la primera entrevista completa, y el taller —que ocurre en Miro, fuera
  // de la plataforma— espera que sus conclusiones vuelvan transcritas.
  const haySesiones = s.sessionsCompleted > 0
  const detalleEntrevistas =
    s.sessionsTotal === 0
      ? 'Sin respondientes'
      : s.sessionsCompleted < s.sessionsTotal
        ? `${s.sessionsCompleted} de ${s.sessionsTotal} completadas`
        : `${s.sessionsTotal} completadas`
  const detallePropuesta = s.tieneEntregable ? 'Generada' : haySesiones ? 'Lista para generar' : 'Necesita entrevistas completas'
  const detalleTaller = !s.tieneEntregable
    ? 'Necesita la propuesta de valor'
    : s.tienePostTaller
      ? 'Conclusiones transcritas'
      : 'Se trabaja en Miro · faltan las conclusiones'

  const propuestaValor: Grupo = {
    key: 'propuesta-valor',
    label: GRUPO_LABEL['propuesta-valor'],
    href: entrevistasHref,
    status: s.tienePostTaller
      ? 'completa'
      : s.tieneEntregable
        ? 'espera'
        : haySesiones
          ? 'en_curso'
          : 'pendiente',
    detalle: s.tieneEntregable ? detalleTaller : haySesiones ? detallePropuesta : detalleEntrevistas,
    tabs: [
      { key: 'entrevistas', label: 'Entrevistas', href: entrevistasHref },
      { key: 'propuesta', label: 'Propuesta de valor', href: propuestaHref },
      { key: 'taller', label: 'Taller', href: tallerHref },
    ],
  }

  const landscapeCompleto = s.landscapeEtapasTotal > 0 && s.landscapeEtapasAprobadas === s.landscapeEtapasTotal
  const landscape: Grupo = {
    key: 'landscape',
    label: GRUPO_LABEL.landscape,
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

  const estrategiaCompleta = s.estrategiaEtapasTotal > 0 && s.estrategiaEtapasAprobadas === s.estrategiaEtapasTotal
  const estrategia: Grupo = {
    key: 'estrategia',
    label: GRUPO_LABEL.estrategia,
    href: estrategiaHref,
    ...(estrategiaCompleta
      ? { status: 'completa' as const, detalle: 'Todas las etapas aprobadas' }
      : s.estrategiaEtapasAprobadas > 0
        ? { status: 'en_curso' as const, detalle: `${s.estrategiaEtapasAprobadas} de ${s.estrategiaEtapasTotal} aprobadas` }
        : { status: 'pendiente' as const, detalle: 'Sin empezar' }),
  }

  return [propuestaValor, landscape, estrategia]
}

/** El grupo donde está parado el proyecto: el primero que no está completo. */
export function grupoActual(grupos: Grupo[]): Grupo {
  return grupos.find(g => g.status !== 'completa') ?? grupos[grupos.length - 1]
}
