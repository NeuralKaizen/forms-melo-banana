import type { Section } from './types'

const open = (id: string, prompt: string, highlight?: string) =>
  ({ id, type: 'open' as const, prompt, highlight, audio: `/audio/${id}.mp3` })

export const SCRIPT: Section[] = [
  {
    key: 'identity', title: 'Quién eres',
    questions: [
      open('nombre', 'Para empezar, ¿cómo te llamas?', 'cómo te llamas'),
      open('empresa', '¿En qué empresa trabajas?', 'empresa'),
      open('cargo', '¿Y cuál es tu cargo?', 'cargo'),
      open('email', '¿A qué email te escribimos?', 'email'),
    ],
  },
  {
    key: 'project', title: 'Contexto del proyecto',
    questions: [
      open('empresa_historia', 'Haz una breve descripción de la compañía o proyecto, incluyendo su historia.', 'compañía o proyecto'),
      open('productos', '¿Qué productos o servicios ofrece?', 'productos o servicios'),
      open('porque_ahora', '¿Por qué es importante evolucionar la marca justo ahora, y qué pasaría si no se hace nada?', 'evolucionar la marca'),
      open('estrategia', '¿Cuál es la estrategia de negocio detrás del brief?', 'estrategia de negocio'),
      open('competencia_hace', '¿Qué está o qué no está haciendo la competencia?', 'la competencia'),
      open('kpis', '¿Cuáles son los KPI del proyecto?', 'KPI'),
      open('competidores', '¿Cuáles son los competidores directos e indirectos?', 'competidores'),
    ],
  },
  {
    key: 'consumer', title: 'Contexto del consumidor',
    questions: [
      open('problema', '¿Cuál es el problema clave que se resuelve para el consumidor?', 'problema clave'),
      open('target', '¿Quién es el target?', 'target'),
      open('percepcion', '¿Qué piensan hoy los consumidores de la marca y cómo se relacionan con ella o la usan? (si aplica)', 'piensan hoy'),
      open('cambio', '¿Cuál es el cambio clave que se busca en el consumidor?', 'cambio clave'),
    ],
  },
  {
    key: 'design', title: 'Contexto de diseño',
    questions: [
      open('objetivos', '¿Cuáles son los objetivos principales del diseño?', 'objetivos'),
      open('donde_vive', '¿Dónde vivirá el diseño? (tiendas, online, eventos…)', 'Dónde vivirá'),
      open('marketing_mix', '¿Cómo encajará en el marketing mix cuando se lance?', 'marketing mix'),
    ],
  },
  {
    key: 'projective', title: 'Ejercicio proyectivo',
    questions: [
      {
        id: 'animal', type: 'image-grid',
        prompt: 'Si la marca fuera un animal, ¿cuál sería?', highlight: 'animal',
        audio: '/audio/animal.mp3',
        options: [
          { id: 'lion', label: 'León', src: '/projective/animal/lion.jpg' },
          { id: 'eagle', label: 'Águila', src: '/projective/animal/eagle.jpg' },
          { id: 'dolphin', label: 'Delfín', src: '/projective/animal/dolphin.jpg' },
          { id: 'fox', label: 'Zorro', src: '/projective/animal/fox.jpg' },
          { id: 'elephant', label: 'Elefante', src: '/projective/animal/elephant.jpg' },
          { id: 'wolf', label: 'Lobo', src: '/projective/animal/wolf.jpg' },
          { id: 'deer', label: 'Ciervo', src: '/projective/animal/deer.jpg' },
          { id: 'bee', label: 'Abeja', src: '/projective/animal/bee.jpg' },
          { id: 'turtle', label: 'Tortuga', src: '/projective/animal/turtle.jpg' },
        ],
      },
    ],
  },
]
