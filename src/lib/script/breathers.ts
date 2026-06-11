export interface BreatherStep { message: string; closing: boolean; emoji?: string; cta?: string }

/** Cierre tras la última pregunta del flujo, o null. */
export function closingAfter(humanIndex: number, total: number): BreatherStep | null {
  if (humanIndex === total) {
    return { message: '¡Eso es todo! Gracias por compartir tu visión con nosotros.', closing: true }
  }
  return null
}

/**
 * Pantalla de transición antes de la PRIMERA pregunta de cada sección del flujo de voz.
 * Va indexada por el id de esa primera pregunta para ser robusta al branching.
 */
const SECTION_INTROS: Record<string, BreatherStep> = {
  // Contexto del proyecto
  empresa_historia: {
    emoji: '🏢', closing: false, cta: 'Empezar',
    message: 'En primer lugar, nos gustaría conocer información relevante de tu compañía para asegurarnos de estar en la misma página.',
  },
  // Contexto del consumidor
  problema: {
    emoji: '👥', closing: false,
    message: '¡Bien! Ahora nos parece clave entender bien a tus clientes.',
  },
  // Contexto de diseño
  objetivos: {
    emoji: '🎨', closing: false,
    message: 'Listo. Para comprender tu visión, te haremos algunas preguntas sobre el diseño que manejan.',
  },
  // Ejercicio proyectivo
  animal: {
    emoji: '✨', closing: false,
    message: 'Aunque no lo creas, las siguientes preguntas pueden parecer simples, pero nos dan insumos increíbles para entender el ideal imaginario que tienes de tu marca. Elige la opción que más se ajuste, de manera intuitiva, a lo que proyectas.',
  },
}

/** Intro de la sección que arranca con `questionId`, o null si esa pregunta no abre sección. */
export function sectionIntro(questionId: string): BreatherStep | null {
  return SECTION_INTROS[questionId] ?? null
}
