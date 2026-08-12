/**
 * El árbol navegable del índice de un proyecto: qué entradas se listan, en qué orden,
 * con qué estado y qué se colapsa cuando una fase tiene demasiadas etapas.
 *
 * Se separa de `phases.ts` porque son dos responsabilidades distintas: `phases.ts` dice
 * en qué estado está cada fase; acá se arma la lista que el índice va a rendir. Ver
 * .superpowers/sdd/2026-08-12-rediseno-panel-interno/task-2-brief.md
 */

import type { Fase, FaseKey, Pantallas } from './phases'
import type { Stage } from '@/lib/landscape/stages'
import type { EtapaEstrategia } from '@/lib/estrategia/stages'
import { BLOQUES } from '@/lib/estrategia/stages'

export type EstadoEtapa = 'aprobada' | 'actual' | 'pendiente' | 'no_aplica'

export interface EntradaIndice {
  key: string // 'entrevistas' | 'landscape:tendencias' | 'estrategia:personalidad'
  label: string
  href: string
  estado: EstadoEtapa
  /** Sub-rótulo del bloque, sólo en Estrategia y sólo en la primera etapa de cada bloque. */
  bloque?: string
  /** Esta etapa espera una decisión del equipo. */
  espera: boolean
}

export interface FaseIndice {
  key: FaseKey
  label: string
  /** '6/6', '4/11', '0/1' — o el detalle de la fase cuando no tiene etapas propias. */
  avance: string
  entradas: EntradaIndice[]
  /** Cuántas quedaron ocultas por el colapso. 0 si no se colapsó nada. */
  ocultas: number
}

const VENTANA = 6

/** La ventana de etapas visibles cuando una fase tiene más de seis. */
function colapsar<T>(entradas: T[], iActiva: number): { visibles: T[]; ocultas: number } {
  if (entradas.length <= VENTANA) return { visibles: entradas, ocultas: 0 }
  const desde = iActiva < 0
    ? 0
    : Math.min(Math.max(0, iActiva - 3), entradas.length - VENTANA)
  return { visibles: entradas.slice(desde, desde + VENTANA), ocultas: entradas.length - VENTANA }
}

/** Primera etapa de cada bloque de estrategia: ahí va el sub-rótulo del bloque. */
const PRIMERA_ETAPA_DE_BLOQUE = new Map(BLOQUES.map(b => [b.etapas[0], b.titulo]))

/** El estado de una entrada de landscape/estrategia: la activa manda, si no, el status de la etapa. */
function estadoDeEtapa(key: string, etapaActiva: string, status: string): EstadoEtapa {
  if (key === etapaActiva) return 'actual'
  if (status === 'aprobada') return 'aprobada'
  if (status === 'no_aplica') return 'no_aplica'
  return 'pendiente'
}

/** El estado de una de las tres entradas de la fase 1: la activa manda, si no, sale de la Pantalla. */
function estadoDePantalla(key: string, etapaActiva: string, completa: boolean): EstadoEtapa {
  if (key === etapaActiva) return 'actual'
  return completa ? 'aprobada' : 'pendiente'
}

export function construirIndice(input: {
  projectId: string
  fases: Fase[]
  /** De `derivePantallas`: el estado fino de entrevistas, propuesta, taller y landscape. */
  pantallas: Pantallas
  /** Namespaceada: 'entrevistas' | 'landscape:tendencias' | 'estrategia:personalidad'. */
  etapaActiva: string
  stagesLandscape: Stage[]
  etapasEstrategia: EtapaEstrategia[]
  /** Keys namespaceadas de las etapas que esperan una decisión del equipo. */
  esperanDecision: string[]
}): FaseIndice[] {
  const { projectId, fases, pantallas, etapaActiva, stagesLandscape, etapasEstrategia } = input
  const espera = new Set(input.esperanDecision)

  const faseUno = fases.find(f => f.key === 'propuesta-valor')!
  const faseLandscape = fases.find(f => f.key === 'landscape')!
  const faseEstrategia = fases.find(f => f.key === 'estrategia')!

  // Fase 1: entrevistas, propuesta y taller son tres entradas, no una fase con hijos.
  const entradasUno: EntradaIndice[] = [
    {
      key: 'entrevistas',
      label: 'Entrevistas',
      href: pantallas.entrevistas.href,
      estado: estadoDePantalla('entrevistas', etapaActiva, pantallas.entrevistas.status === 'completa'),
      espera: espera.has('entrevistas'),
    },
    {
      key: 'propuesta',
      label: 'Propuesta de valor',
      href: pantallas.propuesta.href,
      estado: estadoDePantalla('propuesta', etapaActiva, pantallas.propuesta.status === 'completa'),
      espera: espera.has('propuesta'),
    },
    {
      key: 'taller',
      label: 'Taller',
      href: pantallas.taller.href,
      estado: estadoDePantalla('taller', etapaActiva, pantallas.taller.status === 'completa'),
      espera: espera.has('taller'),
    },
  ]

  // Landscape: sus seis etapas, con href propio a la fase con query de etapa.
  const entradasLandscape: EntradaIndice[] = stagesLandscape.map(s => {
    const key = `landscape:${s.key}`
    return {
      key,
      label: s.label,
      href: `/admin/projects/${projectId}/landscape?etapa=${s.key}`,
      estado: estadoDeEtapa(key, etapaActiva, s.status),
      espera: espera.has(key),
    }
  })
  const iActivaLandscape = entradasLandscape.findIndex(e => e.key === etapaActiva)
  const { visibles: landscapeVisibles, ocultas: landscapeOcultas } = colapsar(entradasLandscape, iActivaLandscape)

  // Estrategia: sus catorce etapas, con el sub-rótulo del bloque en la primera de cada uno.
  const entradasEstrategia: EntradaIndice[] = etapasEstrategia.map(e => {
    const key = `estrategia:${e.key}`
    const bloque = PRIMERA_ETAPA_DE_BLOQUE.get(e.key)
    return {
      key,
      label: e.label,
      href: `/admin/projects/${projectId}/estrategia?etapa=${e.key}`,
      estado: estadoDeEtapa(key, etapaActiva, e.status),
      ...(bloque ? { bloque } : {}),
      espera: espera.has(key),
    }
  })
  const iActivaEstrategia = entradasEstrategia.findIndex(e => e.key === etapaActiva)
  const { visibles: estrategiaVisibles, ocultas: estrategiaOcultas } = colapsar(entradasEstrategia, iActivaEstrategia)

  // El contador va siempre con barra, incluso con la fase completa ('6/6', nunca '✓'):
  // “X de Y etapas” es del subtítulo del proyecto, no de acá.
  const aprobadasLandscape = stagesLandscape.filter(s => s.status === 'aprobada').length
  const avanceLandscape = `${aprobadasLandscape}/${stagesLandscape.length}`

  const aprobadasEstrategia = etapasEstrategia.filter(e => e.status === 'aprobada').length
  const avanceEstrategia = `${aprobadasEstrategia}/${etapasEstrategia.length}`

  return [
    {
      key: faseUno.key,
      label: faseUno.label,
      // La fase 1 no tiene un avance propio en conteo de etapas: sale del detalle de la fase.
      avance: faseUno.detalle,
      entradas: entradasUno,
      ocultas: 0,
    },
    {
      key: faseLandscape.key,
      label: faseLandscape.label,
      avance: avanceLandscape,
      entradas: landscapeVisibles,
      ocultas: landscapeOcultas,
    },
    {
      key: faseEstrategia.key,
      label: faseEstrategia.label,
      avance: avanceEstrategia,
      entradas: estrategiaVisibles,
      ocultas: estrategiaOcultas,
    },
  ]
}

/**
 * Qué etapas tienen una versión guardada sin aprobar — es decir, esperan al equipo.
 * Se exporta acá y no en el store porque es criterio de presentación: el store no sabe
 * de “esperar”.
 */
export function esperanDecision(
  fase: 'landscape' | 'estrategia',
  estado: { stage: string; actual?: { approvedAt?: Date | null } | null; borradorNuevo?: unknown }[],
): string[] {
  return estado
    .filter(e => (e.actual != null && !e.actual.approvedAt) || e.borradorNuevo != null)
    .map(e => `${fase}:${e.stage}`)
}
