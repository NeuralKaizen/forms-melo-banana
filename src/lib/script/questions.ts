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
        id: 'animal', type: 'image-grid', highlight: 'animal', audio: '/audio/animal.mp3',
        prompt: 'Si la compañía fuera un animal, ¿cuál sería?',
        followUp: '¿Por qué ese animal? ¿Qué refleja de la marca?',
        options: [
          { id: 'conejo', label: 'Conejo', src: '/projective/animal/conejo.jpg' },
          { id: 'caballo', label: 'Caballo', src: '/projective/animal/caballo.jpg' },
          { id: 'leon', label: 'León', src: '/projective/animal/leon.jpg' },
          { id: 'delfin', label: 'Delfín', src: '/projective/animal/delfin.jpg' },
          { id: 'aguila', label: 'Águila', src: '/projective/animal/aguila.jpg' },
          { id: 'iguana', label: 'Iguana', src: '/projective/animal/iguana.jpg' },
          { id: 'perro', label: 'Perro', src: '/projective/animal/perro.jpg' },
          { id: 'gato', label: 'Gato', src: '/projective/animal/gato.jpg' },
          { id: 'flamenco', label: 'Flamenco', src: '/projective/animal/flamenco.jpg' },
        ],
      },
      {
        id: 'color', type: 'color-grid', highlight: 'color', audio: '/audio/color.mp3',
        prompt: 'Si la compañía fuera un color, ¿cuál sería?',
        followUp: '¿Por qué ese color?',
        options: [
          { id: 'amarillo', label: 'Amarillo', colors: ['#FEF9C3', '#FDE047', '#EAB308', '#CA8A04', '#854D0E'] },
          { id: 'violeta', label: 'Violeta', colors: ['#F3E8FF', '#D8B4FE', '#A855F7', '#7E22CE', '#581C87'] },
          { id: 'naranja', label: 'Naranja', colors: ['#FFEDD5', '#FDBA74', '#F97316', '#EA580C', '#9A3412'] },
          { id: 'rojo', label: 'Rojo', colors: ['#FEE2E2', '#FCA5A5', '#EF4444', '#DC2626', '#7F1D1D'] },
          { id: 'marron', label: 'Marrón', colors: ['#EFE2D2', '#C9A27A', '#92633B', '#5C3A1E', '#3B2412'] },
          { id: 'verde', label: 'Verde', colors: ['#ECFCCB', '#BEF264', '#84CC16', '#4D7C0F', '#365314'] },
          { id: 'azul', label: 'Azul', colors: ['#DBEAFE', '#60A5FA', '#2563EB', '#1D4ED8', '#0C2A66'] },
          { id: 'gris', label: 'Gris', colors: ['#F3F4F6', '#9CA3AF', '#4B5563', '#1F2937', '#030712'] },
          { id: 'teal', label: 'Teal', colors: ['#CCFBF1', '#5EEAD4', '#14B8A6', '#0F766E', '#134E4A'] },
        ],
      },
      {
        id: 'genero', type: 'gender', highlight: 'género', audio: '/audio/genero.mp3',
        prompt: 'Si la compañía tuviera un género, ¿cuál sería?',
        followUp: '¿Por qué ese género?',
        options: [
          { id: 'hombre', label: 'Hombre' },
          { id: 'mujer', label: 'Mujer' },
        ],
      },
      {
        id: 'edad_hombre', type: 'image-grid', highlight: 'edad', audio: '/audio/edad_hombre.mp3',
        prompt: 'Si la compañía tuviera una edad, ¿cuál sería?',
        followUp: '¿Por qué esa edad?',
        showIf: (a) => a['genero']?.imageChoice !== 'mujer',
        options: [
          { id: '20s', label: "20's", src: '/projective/edad-hombre/20s.jpg' },
          { id: '30s', label: "30's", src: '/projective/edad-hombre/30s.jpg' },
          { id: '40s', label: "40's", src: '/projective/edad-hombre/40s.jpg' },
          { id: '50s', label: "50's", src: '/projective/edad-hombre/50s.jpg' },
          { id: '60s', label: "60's", src: '/projective/edad-hombre/60s.jpg' },
        ],
      },
      {
        id: 'edad_mujer', type: 'image-grid', highlight: 'edad', audio: '/audio/edad_mujer.mp3',
        prompt: 'Si la compañía tuviera una edad, ¿cuál sería?',
        followUp: '¿Por qué esa edad?',
        showIf: (a) => a['genero']?.imageChoice === 'mujer',
        options: [
          { id: '20s', label: "20's", src: '/projective/edad-mujer/20s.jpg' },
          { id: '30s', label: "30's", src: '/projective/edad-mujer/30s.jpg' },
          { id: '40s', label: "40's", src: '/projective/edad-mujer/40s.jpg' },
          { id: '50s', label: "50's", src: '/projective/edad-mujer/50s.jpg' },
          { id: '60s', label: "60's", src: '/projective/edad-mujer/60s.jpg' },
        ],
      },
      {
        id: 'olor', type: 'image-grid', highlight: 'olor', audio: '/audio/olor.mp3',
        prompt: 'Si la compañía tuviera un olor, ¿cuál sería?',
        followUp: '¿Por qué ese olor?',
        options: [
          { id: 'cerezo', label: 'Cerezo', src: '/projective/olor/cerezo.jpg' },
          { id: 'pina', label: 'Piña', src: '/projective/olor/pina.jpg' },
          { id: 'cesped', label: 'Césped', src: '/projective/olor/cesped.jpg' },
          { id: 'rio', label: 'Río', src: '/projective/olor/rio.jpg' },
          { id: 'caramelos', label: 'Caramelos', src: '/projective/olor/caramelos.jpg' },
          { id: 'madera', label: 'Madera', src: '/projective/olor/madera.jpg' },
          { id: 'hierba', label: 'Hierba', src: '/projective/olor/hierba.jpg' },
          { id: 'naranjas', label: 'Naranjas', src: '/projective/olor/naranjas.jpg' },
          { id: 'rosas', label: 'Rosas', src: '/projective/olor/rosas.jpg' },
        ],
      },
      {
        id: 'ciudad', type: 'image-grid', highlight: 'ciudad', audio: '/audio/ciudad.mp3',
        prompt: 'Si la compañía fuera una ciudad, ¿cuál sería?',
        followUp: '¿Por qué esa ciudad? ¿Qué refleja de la marca?',
        options: [
          { id: 'bali', label: 'Bali', src: '/projective/ciudad/bali.jpg' },
          { id: 'ny', label: 'New York', src: '/projective/ciudad/ny.jpg' },
          { id: 'barcelona', label: 'Barcelona', src: '/projective/ciudad/barcelona.jpg' },
          { id: 'delhi', label: 'Delhi', src: '/projective/ciudad/delhi.jpg' },
          { id: 'lasvegas', label: 'Las Vegas', src: '/projective/ciudad/lasvegas.jpg' },
          { id: 'berlin', label: 'Berlín', src: '/projective/ciudad/berlin.jpg' },
          { id: 'paris', label: 'París', src: '/projective/ciudad/paris.jpg' },
          { id: 'dubai', label: 'Dubai', src: '/projective/ciudad/dubai.jpg' },
          { id: 'marrakech', label: 'Marrakech', src: '/projective/ciudad/marrakech.jpg' },
        ],
      },
    ],
  },
]
