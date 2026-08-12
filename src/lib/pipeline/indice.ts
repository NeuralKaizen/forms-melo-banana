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
  /**
   * El destino de “＋ n etapas más”. Lo arma acá y no el componente porque acá se sabe
   * qué etapa está activa: sin eso, revelar las ocultas descartaba la `?etapa=` de la URL
   * y la pantalla aterrizaba en otra etapa.
   */
  hrefTodas: string
}

const VENTANA = 6

/** La ventana de etapas visibles cuando una fase tiene más de seis. */
function colapsar<T>(entradas: T[], iActiva: number, todas: boolean): { visibles: T[]; ocultas: number } {
  if (todas || entradas.length <= VENTANA) return { visibles: entradas, ocultas: 0 }
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

/**
 * El link que revela las etapas ocultas de una fase. Se lleva la etapa activa puesta
 * cuando la activa es de esa fase; si estás parado en otra fase, no hay etapa que
 * preservar y la pantalla destino elige la suya.
 */
function linkTodas(base: string, etapaDeLaFase?: string): string {
  return etapaDeLaFase ? `${base}?etapa=${etapaDeLaFase}&todas=1` : `${base}?todas=1`
}

/** La etapa activa sin su namespace, sólo si pertenece a la fase que se pregunta. */
function etapaDeLaFase(etapaActiva: string, fase: 'landscape' | 'estrategia'): string | undefined {
  const prefijo = `${fase}:`
  return etapaActiva.startsWith(prefijo) ? etapaActiva.slice(prefijo.length) : undefined
}

/**
 * Qué etapa mira la pantalla. La query manda mientras nombre una etapa real —incluso una
 * `no_aplica`, si el equipo la pidió a propósito—; si no dice nada, se aterriza en la
 * primera que todavía se puede trabajar. Una `no_aplica` no es un aterrizaje: nadie la va
 * a mover nunca, y el índice la pinta apagada.
 */
export function resolverEtapaActiva<K extends string>(
  query: string | undefined,
  orden: readonly K[],
  etapas: { key: K; status: string }[],
): K {
  if (query && (orden as readonly string[]).includes(query)) return query as K
  return etapas.find(e => e.status !== 'aprobada' && e.status !== 'no_aplica')?.key ?? orden[0]
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
  /** De `?todas=1`: se muestran todas las etapas, sin colapsar. */
  todas?: boolean
}): FaseIndice[] {
  const { projectId, fases, pantallas, etapaActiva, stagesLandscape, etapasEstrategia } = input
  const espera = new Set(input.esperanDecision)
  const todas = input.todas ?? false

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
  const baseLandscape = `/admin/projects/${projectId}/landscape`
  const entradasLandscape: EntradaIndice[] = stagesLandscape.map(s => {
    const key = `landscape:${s.key}`
    return {
      key,
      label: s.label,
      href: `${baseLandscape}?etapa=${s.key}`,
      estado: estadoDeEtapa(key, etapaActiva, s.status),
      espera: espera.has(key),
    }
  })
  const iActivaLandscape = entradasLandscape.findIndex(e => e.key === etapaActiva)
  const { visibles: landscapeVisibles, ocultas: landscapeOcultas } = colapsar(entradasLandscape, iActivaLandscape, todas)

  // Estrategia: sus catorce etapas, con el sub-rótulo del bloque en la primera de cada uno.
  const baseEstrategia = `/admin/projects/${projectId}/estrategia`
  const entradasEstrategia: EntradaIndice[] = etapasEstrategia.map(e => {
    const key = `estrategia:${e.key}`
    const bloque = PRIMERA_ETAPA_DE_BLOQUE.get(e.key)
    return {
      key,
      label: e.label,
      href: `${baseEstrategia}?etapa=${e.key}`,
      estado: estadoDeEtapa(key, etapaActiva, e.status),
      ...(bloque ? { bloque } : {}),
      espera: espera.has(key),
    }
  })
  const iActivaEstrategia = entradasEstrategia.findIndex(e => e.key === etapaActiva)
  const { visibles: estrategiaVisibles, ocultas: estrategiaOcultas } = colapsar(entradasEstrategia, iActivaEstrategia, todas)

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
      // Sus tres entradas entran siempre en la ventana: no hay nada que revelar.
      ocultas: 0,
      hrefTodas: linkTodas(faseUno.href),
    },
    {
      key: faseLandscape.key,
      label: faseLandscape.label,
      avance: avanceLandscape,
      entradas: landscapeVisibles,
      ocultas: landscapeOcultas,
      hrefTodas: linkTodas(baseLandscape, etapaDeLaFase(etapaActiva, 'landscape')),
    },
    {
      key: faseEstrategia.key,
      label: faseEstrategia.label,
      avance: avanceEstrategia,
      entradas: estrategiaVisibles,
      ocultas: estrategiaOcultas,
      hrefTodas: linkTodas(baseEstrategia, etapaDeLaFase(etapaActiva, 'estrategia')),
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
