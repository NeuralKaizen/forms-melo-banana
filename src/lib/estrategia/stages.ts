/**
 * Modelo de las etapas del Proceso de Estrategia (fase 3).
 * Ver valkyria/specs/2026-08-11-fase3-pipeline-estrategia-design.md y
 * docs/fase3/Procesos Estrategia y Naming.pdf (bloques 1–4).
 */
import type { StageStatus } from '@/lib/landscape/stages'

export type EstrategiaKey =
  | 'diagnostico' | 'consumidor'
  | 'rtbs' | 'concepto' | 'beneficios' | 'arquetipo' | 'personalidad' | 'valores'
  | 'territorio' | 'brand_ideal' | 'ingredients' | 'tagline' | 'manifiesto'
  | 'cuadros'

/**
 * El orden es de referencia, como en el PDF: la plataforma muestra estado pero no
 * encadena etapas — la esencia se trabaja en el orden que pida el proyecto.
 */
export const ETAPA_ORDER: EstrategiaKey[] = [
  'diagnostico', 'consumidor',
  'rtbs', 'concepto', 'beneficios', 'arquetipo', 'personalidad', 'valores',
  'territorio', 'brand_ideal', 'ingredients', 'tagline', 'manifiesto',
  'cuadros',
]

/** Las etapas del bloque 3 (esencia): las que `cuadros` resume y de las que avisa. */
export const ESENCIA: EstrategiaKey[] = ETAPA_ORDER.slice(2, 13)

/**
 * Los bloques del proceso (PDF, bloques 1–4). El índice del proyecto los usa como
 * sub-rótulo dentro de la fase Estrategia: 14 etapas planas no se leen.
 */
export interface Bloque {
  titulo: string
  etapas: EstrategiaKey[]
}

export const BLOQUES: Bloque[] = [
  { titulo: 'Diagnóstico y consumidor', etapas: ['diagnostico', 'consumidor'] },
  { titulo: 'Esencia de marca', etapas: ESENCIA },
  { titulo: 'Cierre', etapas: ['cuadros'] },
]

export const ETAPA_LABEL: Record<EstrategiaKey, string> = {
  diagnostico: 'Diagnóstico',
  consumidor: 'Consumidor',
  rtbs: 'RTBs',
  concepto: 'Concepto estratégico',
  beneficios: 'Beneficios',
  arquetipo: 'Arquetipo',
  personalidad: 'Personalidad',
  valores: 'Valores',
  territorio: 'Territorio',
  brand_ideal: 'Brand Ideal',
  ingredients: 'Brand ingredients',
  tagline: 'Tagline / CCI',
  manifiesto: 'Manifiesto',
  cuadros: 'Cuadros finales',
}

export const ETAPA_HINT: Partial<Record<EstrategiaKey, string>> = {
  cuadros: 'se llena desde lo aprobado',
}

export interface EtapaEstrategia {
  key: EstrategiaKey
  label: string
  hint?: string
  status: StageStatus
}

/** Las 14 etapas siempre, aunque el proyecto todavía no tenga ninguna fila. */
export function buildEtapasEstrategia(estado: { stage: EstrategiaKey; status: StageStatus }[]): EtapaEstrategia[] {
  const porEtapa = new Map(estado.map(e => [e.stage, e.status]))
  return ETAPA_ORDER.map(key => ({
    key,
    label: ETAPA_LABEL[key],
    hint: ETAPA_HINT[key],
    status: porEtapa.get(key) ?? 'pendiente',
  }))
}
