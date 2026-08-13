/**
 * De dónde viene una versión de etapa, en palabras. Lo consumen el pie de decisión del
 * documento y la cabecera de cada columna del comparador, en las dos fases —landscape y
 * estrategia guardan versiones con la misma forma—.
 *
 * Vive acá y no en las páginas porque es la única frase del panel que dice si algo está
 * aprobado o no, y una ruta de Next no se puede testear. Se llama desde el servidor: los
 * dos textos comparan contra un “ahora”, y el del render y el de la hidratación no serían
 * el mismo.
 */

import { haceCuanto } from '@/lib/landscape/stages'

/** Lo que se necesita de una fila de `landscape_versions` o `strategy_versions`. */
export interface VersionDeEtapa {
  author: string
  authorLabel?: string | null
  createdAt: Date
  approvedAt?: Date | null
}

/**
 * Quién la escribió, para nombrarlo. Claude escribe por MCP y se llama Claude; una
 * escritura humana trae su nombre cuando se sabe, y cuando no, es el equipo.
 */
export function autorDeVersion(v: VersionDeEtapa): string {
  if (v.author === 'claude') return 'Claude'
  return v.authorLabel?.trim() || 'el equipo'
}

/** “Escrito por Claude · hace 2 h · sin aprobar”. */
export function procedenciaDeVersion(v: VersionDeEtapa, ahora: Date = new Date()): string {
  const estado = v.approvedAt ? 'aprobada' : 'sin aprobar'
  return `Escrito por ${autorDeVersion(v)} · ${haceCuanto(v.createdAt, ahora)} · ${estado}`
}
