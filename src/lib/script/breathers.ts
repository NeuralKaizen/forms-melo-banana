export interface BreatherStep { message: string; closing: boolean; emoji?: string; cta?: string }

/**
 * Pantalla de transición antes de la PRIMERA pregunta de cada sección del flujo de voz.
 * Va indexada por el id de esa primera pregunta para ser robusta al branching.
 */
const SECTION_INTROS: Record<string, BreatherStep> = {
  // Contexto del proyecto
  empresa_historia: {
    emoji: '🏢', closing: false, cta: 'Empezar',
    message: 'En primer lugar, nos gustaría conocer información relevante de tu compañía o proyecto.',
  },
  // Contexto del consumidor
  problema: {
    emoji: '👥', closing: false,
    message: '¡Bien! Ahora nos parece clave entender bien a tus clientes.',
  },
  // Contexto de diseño
  objetivos: {
    emoji: '🎨', closing: false,
    message: 'Ahora queremos comprender tu visión y lo que buscas lograr a través del diseño.',
  },
  // Ejercicio proyectivo
  animal: {
    emoji: '✨', closing: false,
    message: 'Aunque parezcan simples, las siguientes preguntas nos dan pistas valiosas para entender el ideal imaginario que tienes de tu marca. Elige la opción que más se ajuste, de manera intuitiva, a cómo la visualizas.',
  },
}

/** Intro de la sección que arranca con `questionId`, o null si esa pregunta no abre sección. */
export function sectionIntro(questionId: string): BreatherStep | null {
  return SECTION_INTROS[questionId] ?? null
}
