/**
 * La mesa de trabajo: lo que la portada del proyecto pone adelante. No consulta nada —
 * recibe lo que las otras capas ya derivan (el índice, la cola de atención, la actividad)
 * y lo ordena según la pregunta de la pantalla: ¿qué me toca, y qué cambió mientras no
 * estaba? Ver la decisión "El proyecto abre con el trabajo, no con la estructura".
 */

import type { FaseIndice } from './indice'
import type { AttentionItem } from './attention'
import type { ActivityEntry } from '@/lib/db/store'
import { STAGE_LABEL, type StageKey } from '@/lib/landscape/stages'
import { ETAPA_LABEL, type EstrategiaKey } from '@/lib/estrategia/stages'

export interface PendienteMesa {
  titulo: string
  sub?: string
  href: string
}

/**
 * Las decisiones que esperan al equipo, con su link directo. Dos fuentes:
 * las etapas con una versión sin aprobar (lo fino), y la cola de atención del
 * proyecto (lo grueso: "sin entrevistas", "propuesta lista para generar").
 * Cuando lo grueso apunta a una fase que ya tiene esperas finas, se calla:
 * "Landscape en curso" no agrega nada al lado de "Revisar Tendencias".
 */
export function armarNosToca(indice: FaseIndice[], atencion: AttentionItem[]): PendienteMesa[] {
  const esperas: PendienteMesa[] = indice.flatMap(f =>
    f.entradas.filter(e => e.espera).map(e => ({
      titulo: `Revisar «${e.label}»`,
      sub: `${f.label} · hay una versión sin aprobar`,
      href: e.href,
    })),
  )

  const gruesas: PendienteMesa[] = atencion
    .filter(a => a.bloqueo === 'equipo')
    .filter(a => !esperas.some(e => e.href.startsWith(a.href)))
    .map(a => ({ titulo: a.accion, href: a.href }))

  return [...gruesas, ...esperas]
}

export interface Movimiento {
  id: string
  cuando: Date
  /** Quién lo movió: 'Claude', un nombre, o 'Equipo' cuando no se sabe quién. */
  quien: string
  /** El resto de la oración, sin el sujeto: "aprobó Tendencias". */
  texto: string
  href: string
}

/**
 * Un solo hilo con todo lo que se movió: versiones de landscape y estrategia, y
 * entrevistas completadas. Cada fuente ya viene ordenada; acá solo se mezclan,
 * se les pone oración y destino, y se corta.
 */
export function armarMovimientos(x: {
  projectId: string
  landscape: ActivityEntry<StageKey>[]
  estrategia: ActivityEntry<EstrategiaKey>[]
  sesiones: { id: string; name?: string | null; completedAt?: Date | string | null }[]
  limite?: number
}): Movimiento[] {
  const base = `/admin/projects/${x.projectId}`
  const verbo = (tipo: 'guardado' | 'aprobado') => (tipo === 'aprobado' ? 'aprobó' : 'guardó')
  const sujeto = (a: ActivityEntry<string>) => (a.autor === 'claude' ? 'Claude' : a.quien ?? 'Equipo')

  const deLandscape: Movimiento[] = x.landscape.map(a => ({
    id: `landscape:${a.id}`,
    cuando: a.cuando,
    quien: sujeto(a),
    texto: `${verbo(a.tipo)} ${STAGE_LABEL[a.stage]}`,
    href: `${base}/landscape?etapa=${a.stage}`,
  }))

  const deEstrategia: Movimiento[] = x.estrategia.map(a => ({
    id: `estrategia:${a.id}`,
    cuando: a.cuando,
    quien: sujeto(a),
    texto: `${verbo(a.tipo)} ${ETAPA_LABEL[a.stage]}`,
    href: `${base}/estrategia?etapa=${a.stage}`,
  }))

  const deSesiones: Movimiento[] = x.sesiones
    .filter(s => s.completedAt)
    .map(s => ({
      id: `sesion:${s.id}`,
      cuando: new Date(s.completedAt as Date | string),
      quien: s.name?.trim() || 'Alguien',
      texto: 'completó su entrevista',
      href: `/admin/${s.id}`,
    }))

  return [...deLandscape, ...deEstrategia, ...deSesiones]
    .sort((a, b) => b.cuando.getTime() - a.cuando.getTime())
    .slice(0, x.limite ?? 8)
}
