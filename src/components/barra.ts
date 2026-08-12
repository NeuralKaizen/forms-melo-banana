/**
 * Las dos funciones puras de la barra amarilla.
 *
 * Viven acá y no en `AdminShell.tsx` porque ese módulo importa `@/lib/db/client`, que
 * ejecuta `neon(process.env.DATABASE_URL!)` en el momento del import: cualquier test que
 * lo importe explota antes de la primera aserción. Este archivo no importa nada de base.
 */

/** Ancha cuando elegís proyecto, riel cuando estás adentro de uno. Sale de la ruta, no de estado. */
export const estadoBarra = (activeProjectId?: string): 'ancha' | 'riel' =>
  activeProjectId ? 'riel' : 'ancha'

/** “Café Lunar” → “CL”. Con una sola palabra, sus dos primeras letras. */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/)
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  return (palabras[0][0] + palabras[1][0]).toUpperCase()
}
