/**
 * Modelo de las etapas del Landscape (fase 2).
 * Ver docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md
 *
 * Por ahora el contenido es de demostración: la escritura real llega desde Claude
 * por MCP (`guardar_etapa`). Los tipos ya son los definitivos.
 */

export type StageKey = 'setup' | 'contexto' | 'tendencias' | 'panorama' | 'diagnostico' | 'entrega'

export type StageStatus = 'pendiente' | 'en_curso' | 'aprobada' | 'no_aplica'

/** El orden del proceso, de docs/fase2/fase-2-investigacion-landscape.md. */
export const STAGE_ORDER: StageKey[] = ['setup', 'contexto', 'tendencias', 'panorama', 'diagnostico', 'entrega']

export interface Stage {
  key: StageKey
  label: string
  /** Nota chica bajo el nombre, para condicionales. */
  hint?: string
  status: StageStatus
}

export interface Fuente {
  /** Nombre del documento en el archivo del estudio. */
  doc: string
  pagina?: number
}

export type Eje = 'Marca' | 'Estrategia' | 'Comunicación'

export interface TendenciaCandidata {
  id: string
  eje: Eje
  titulo: string
  descripcion: string
  fuentes: Fuente[]
}

/** Cuántas tendencias exige el proceso antes de dejar avanzar la etapa. */
export const MIN_TENDENCIAS = 4
export const MAX_TENDENCIAS = 5

export const EJES: Eje[] = ['Marca', 'Estrategia', 'Comunicación']

export const STAGE_LABEL: Record<StageKey, string> = {
  setup: 'Setup',
  contexto: 'Contexto del sector',
  tendencias: 'Tendencias',
  panorama: 'Panorama de categoría',
  diagnostico: 'Diagnóstico',
  entrega: 'Entrega',
}

export const STAGE_HINT: Partial<Record<StageKey, string>> = {
  diagnostico: 'solo rebranding',
}

/** Las seis etapas siempre, aunque el proyecto todavía no tenga ninguna fila. */
export function buildStages(estado: { stage: StageKey; status: StageStatus }[]): Stage[] {
  const porEtapa = new Map(estado.map(e => [e.stage, e.status]))
  return STAGE_ORDER.map(key => ({
    key,
    label: STAGE_LABEL[key],
    hint: STAGE_HINT[key],
    status: porEtapa.get(key) ?? 'pendiente',
  }))
}

export function textoActividad(e: { tipo: 'guardado' | 'aprobado'; stage: StageKey }): string {
  return e.tipo === 'aprobado'
    ? `Aprobó ${STAGE_LABEL[e.stage]}`
    : `Guardó un borrador de ${STAGE_LABEL[e.stage]}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** El estudio trabaja en Colombia: la fecha corta se rinde ahí, no en la zona del proceso (Vercel = UTC). */
const ZONA_ESTUDIO = 'America/Bogota'

/** Parte día/mes/año de `fecha`, tal como se ve desde `ZONA_ESTUDIO`. */
function partesEnBogota(fecha: Date): { dia: number; mes: number; anio: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_ESTUDIO,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(fecha)
  const valor = (tipo: string) => Number(partes.find(p => p.type === tipo)!.value)
  return { dia: valor('day'), mes: valor('month') - 1, anio: valor('year') }
}

/** Tiempo relativo corto, para la columna de actividad. */
export function haceCuanto(fecha: Date, ahora: Date = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - fecha.getTime()) / 60_000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  const { dia, mes, anio } = partesEnBogota(fecha)
  const { anio: anioActual } = partesEnBogota(ahora)
  const fechaCorta = `${dia} ${MESES[mes]}`
  return anio === anioActual ? fechaCorta : `${fechaCorta} ${anio}`
}
