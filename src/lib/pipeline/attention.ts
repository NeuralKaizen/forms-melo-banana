import type { Pantalla, EtapaKey } from './phases'

/**
 * Qué está esperando a alguien del equipo.
 *
 * La grilla dice en qué fase está cada proyecto; esto dice qué hacer al respecto y dónde.
 * La diferencia importa: "21 entrevistas" no es información accionable, "Fruta Viva tiene
 * la propuesta lista para generar" sí.
 */
export interface AttentionItem {
  projectId: string
  projectName: string
  /** La acción, en imperativo o en estado. Corta: se lee de un vistazo. */
  accion: string
  /** Dónde se resuelve. */
  href: string
  fase: Exclude<EtapaKey, 'estrategia'>
  /** Quién destraba: el equipo acá, o algo de afuera. */
  bloqueo: 'equipo' | 'externo'
}

export interface AttentionInput {
  id: string
  name: string
  pantallas: Record<Exclude<EtapaKey, 'estrategia'>, Pantalla>
  sessionsTotal: number
  sessionsCompleted: number
  tieneEntregable: boolean
  ultimaActividad?: Date | null
}

/** Primero lo que el equipo puede resolver hoy sin depender de nadie. */
const RANGO: Record<Exclude<EtapaKey, 'estrategia'>, number> = {
  propuesta: 0,
  entrevistas: 1,
  landscape: 2,
  taller: 3,
}

export function attentionItems(projects: AttentionInput[]): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const p of projects) {
    const push = (pantalla: Pantalla, accion: string, bloqueo: AttentionItem['bloqueo']) =>
      items.push({ projectId: p.id, projectName: p.name, accion, href: pantalla.href, fase: pantalla.key, bloqueo })

    const { entrevistas, propuesta, taller, landscape } = p.pantallas

    // Lo que se puede hacer acá mismo, en orden de lo más directo.
    if (propuesta.status !== 'completa' && p.sessionsCompleted > 0) {
      push(propuesta, 'Propuesta de valor lista para generar', 'equipo')
    } else if (p.sessionsTotal === 0) {
      push(entrevistas, 'Sin entrevistas todavía', 'equipo')
    } else if (entrevistas.status === 'en_curso') {
      const faltan = p.sessionsTotal - p.sessionsCompleted
      push(entrevistas, `${faltan} ${faltan === 1 ? 'entrevista sin completar' : 'entrevistas sin completar'}`, 'externo')
    } else if (taller.status === 'espera') {
      push(taller, 'Faltan las conclusiones del taller', 'externo')
    } else if (landscape.status === 'pendiente') {
      push(landscape, 'Landscape sin empezar', 'equipo')
    } else if (landscape.status === 'en_curso') {
      push(landscape, landscape.detalle, 'equipo')
    }
  }

  // Mismo rango: primero el proyecto más quieto, que es el que se está enfriando.
  const quietud = (p: AttentionInput) => p.ultimaActividad?.getTime() ?? 0
  const porId = new Map(projects.map(p => [p.id, p]))

  return items.sort((a, b) =>
    RANGO[a.fase] - RANGO[b.fase] ||
    quietud(porId.get(a.projectId)!) - quietud(porId.get(b.projectId)!),
  )
}

/** "hace 3 días", en corto, para la columna de actividad. */
export function haceCuanto(fecha: Date | null | undefined, ahora: Date): string {
  if (!fecha) return '—'
  const dias = Math.floor((ahora.getTime() - fecha.getTime()) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`
}
