/** Longitud mínima (ya normalizada) para que una cita se considere significativa. */
const MIN_CITA = 12

/**
 * Puntuación que se descarta al comparar citas: los LLM omiten o mueven
 * comas, puntos y comillas constantemente, y eso no debería invalidar una
 * cita real del cliente. Incluye comillas rectas y tipográficas, y guiones.
 */
const PUNTUACION = /[,.;:!?¡¿"'“”‘’—–-]/g

/** minúsculas, sin tildes, sin puntuación, espacios colapsados. */
export function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(PUNTUACION, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Devuelve la cita TAL CUAL vino si aparece textualmente (módulo tildes, mayúsculas
 * y espacios) dentro de ALGUNA respuesta del corpus. Si no, devuelve null.
 *
 * Debe encontrarse dentro de una sola respuesta: una "cita" que abarque dos
 * respuestas distintas es una frase que nadie dijo.
 */
export function citaVerificada(cita: string | null | undefined, corpus: string[]): string | null {
  if (!cita) return null
  const aguja = normalizarTexto(cita)
  if (aguja.length < MIN_CITA) return null
  const ok = corpus.some(respuesta => normalizarTexto(respuesta).includes(aguja))
  return ok ? cita.trim() : null
}
