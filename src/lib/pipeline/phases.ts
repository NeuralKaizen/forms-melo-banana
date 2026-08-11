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

/** El estado de una pantalla puntual — más fino que el de su grupo, que puede agrupar varias. */
export interface Pantalla {
  key: Exclude<PantallaKey, 'estrategia'>
  label: string
  status: PhaseStatus
  detalle: string
  href: string
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

const PANTALLA_LABEL: Record<Exclude<PantallaKey, 'estrategia'>, string> = {
  entrevistas: 'Entrevistas',
  propuesta: 'Propuesta de valor',
  taller: 'Taller',
  landscape: 'Landscape',
}

// El estado y el detalle de cada pantalla, aislados en una función por pantalla: los
// reusan tanto `deriveGrupos` (que solo necesita el detalle de la que esté frenando al
// grupo) como `derivePantallas` (que necesita las cuatro, una por una, para lo que
// espera al equipo).
function estadoEntrevistas(s: ProjectSignals): { status: PhaseStatus; detalle: string } {
  if (s.sessionsTotal === 0) return { status: 'pendiente', detalle: 'Sin respondientes' }
  if (s.sessionsCompleted < s.sessionsTotal) {
    return { status: 'en_curso', detalle: `${s.sessionsCompleted} de ${s.sessionsTotal} completadas` }
  }
  return { status: 'completa', detalle: `${s.sessionsTotal} completadas` }
}

function estadoPropuesta(s: ProjectSignals): { status: PhaseStatus; detalle: string } {
  if (s.tieneEntregable) return { status: 'completa', detalle: 'Generada' }
  if (s.sessionsCompleted > 0) return { status: 'pendiente', detalle: 'Lista para generar' }
  return { status: 'pendiente', detalle: 'Necesita entrevistas completas' }
}

function estadoTaller(s: ProjectSignals): { status: PhaseStatus; detalle: string } {
  if (!s.tieneEntregable) return { status: 'pendiente', detalle: 'Necesita la propuesta de valor' }
  if (s.tienePostTaller) return { status: 'completa', detalle: 'Conclusiones transcritas' }
  return { status: 'espera', detalle: 'Se trabaja en Miro · faltan las conclusiones' }
}

function estadoLandscape(s: ProjectSignals): { status: PhaseStatus; detalle: string } {
  const completo = s.landscapeEtapasTotal > 0 && s.landscapeEtapasAprobadas === s.landscapeEtapasTotal
  if (completo) return { status: 'completa', detalle: 'Todas las etapas aprobadas' }
  if (s.landscapeEtapasAprobadas > 0) {
    return { status: 'en_curso', detalle: `${s.landscapeEtapasAprobadas} de ${s.landscapeEtapasTotal} etapas aprobadas` }
  }
  return { status: 'pendiente', detalle: 'Sin empezar' }
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
    detalle: s.tieneEntregable ? estadoTaller(s).detalle : haySesiones ? estadoPropuesta(s).detalle : estadoEntrevistas(s).detalle,
    tabs: [
      { key: 'entrevistas', label: 'Entrevistas', href: entrevistasHref },
      { key: 'propuesta', label: 'Propuesta de valor', href: propuestaHref },
      { key: 'taller', label: 'Taller', href: tallerHref },
    ],
  }

  const landscape: Grupo = {
    key: 'landscape',
    label: GRUPO_LABEL.landscape,
    href: landscapeHref,
    ...estadoLandscape(s),
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

/** Lo que devuelve `derivePantallas`: las cuatro pantallas de fase 2, por key. */
export type Pantallas = Record<Exclude<PantallaKey, 'estrategia'>, Pantalla>

/**
 * El estado fino de cada pantalla, pantalla por pantalla — la granularidad que
 * `deriveGrupos` esconde adentro del grupo 'propuesta-valor'. La usa `attention.ts`
 * para decir con precisión qué le falta a cada proyecto y quién lo destraba; la
 * estrategia (pantalla de la fase 3) todavía no entra acá.
 */
export function derivePantallas(projectId: string, s: ProjectSignals): Pantallas {
  const href = (key: Exclude<PantallaKey, 'estrategia'>) => `/admin/projects/${projectId}/${key}`
  return {
    entrevistas: { key: 'entrevistas', label: PANTALLA_LABEL.entrevistas, href: href('entrevistas'), ...estadoEntrevistas(s) },
    propuesta: { key: 'propuesta', label: PANTALLA_LABEL.propuesta, href: href('propuesta'), ...estadoPropuesta(s) },
    taller: { key: 'taller', label: PANTALLA_LABEL.taller, href: href('taller'), ...estadoTaller(s) },
    landscape: { key: 'landscape', label: PANTALLA_LABEL.landscape, href: href('landscape'), ...estadoLandscape(s) },
  }
}

/**
 * Lo que devuelve `pantallaActual`: mismo shape que `Pantalla`, pero el `key` puede ser
 * también 'estrategia'. Decisión: no se ensancha `Pantalla.key` en sí, porque
 * `attention.ts` (fuera de este arreglo) tipa `AttentionItem.fase` asumiendo que una
 * `Pantalla` nunca es 'estrategia' — esa función todavía no maneja fase 3. En vez de tocar
 * ese contrato, este tipo hermano solo se usa acá, donde sí hace falta nombrar la
 * pantalla de estrategia.
 */
export type PantallaActual = Omit<Pantalla, 'key'> & { key: PantallaKey }

/**
 * La pantalla donde está parado el proyecto: dentro del grupo 1, la primera sub-pantalla
 * no completa (entrevistas → propuesta → taller, con fallback a taller si las tres están
 * completas — hoy imposible porque `tienePostTaller` está hardcodeada en `false`, pero la
 * función no depende de eso); en los otros grupos, su única pantalla. Landscape ya vive en
 * `derivePantallas`; estrategia no, así que se arma su `Pantalla` al vuelo a partir del
 * grupo — mismo status/detalle/href que ya calcula `deriveGrupos`.
 */
export function pantallaActual(grupos: Grupo[], pantallas: Pantallas): PantallaActual {
  const g = grupoActual(grupos)
  if (g.key === 'propuesta-valor') {
    const candidatas: Pantalla[] = [pantallas.entrevistas, pantallas.propuesta, pantallas.taller]
    return candidatas.find(p => p.status !== 'completa') ?? pantallas.taller
  }
  if (g.key === 'landscape') return pantallas.landscape
  return { key: 'estrategia', label: g.label, status: g.status, detalle: g.detalle, href: g.href }
}
