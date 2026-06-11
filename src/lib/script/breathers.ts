export interface BreatherStep { message: string; closing: boolean }

/** Respiro anti-fatiga después de la pregunta `humanIndex` (1-based), o null. */
export function breatherAfter(humanIndex: number, total: number): BreatherStep | null {
  if (humanIndex === total) {
    return { message: '¡Eso es todo! Gracias por compartir tu visión con nosotros.', closing: true }
  }
  if (humanIndex === 7) {
    return { message: 'Vamos por la mitad de camino. Recuerda tomarte el tiempo que necesites.', closing: false }
  }
  if (humanIndex === 12) {
    return { message: 'Doce preguntas y contando. Ya casi lo tenemos.', closing: false }
  }
  return null
}
