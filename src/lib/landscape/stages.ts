/**
 * Modelo de las etapas del Landscape (fase 2).
 * Ver docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md
 *
 * Por ahora el contenido es de demostración: la escritura real llega desde Claude
 * por MCP (`guardar_etapa`). Los tipos ya son los definitivos.
 */

export type StageKey = 'setup' | 'contexto' | 'tendencias' | 'panorama' | 'diagnostico' | 'entrega'

export type StageStatus = 'pendiente' | 'en_curso' | 'aprobada' | 'no_aplica'

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

/** Una escritura hecha por Claude a través del MCP, o por una persona en el panel. */
export interface Actividad {
  id: string
  autor: 'claude' | 'humano'
  quien?: string
  texto: string
  cuando: string
}

export const STAGES: Stage[] = [
  { key: 'setup', label: 'Setup', status: 'aprobada' },
  { key: 'contexto', label: 'Contexto del sector', status: 'aprobada' },
  { key: 'tendencias', label: 'Tendencias', status: 'en_curso' },
  { key: 'panorama', label: 'Panorama de categoría', status: 'pendiente' },
  { key: 'diagnostico', label: 'Diagnóstico', hint: 'solo rebranding', status: 'no_aplica' },
  { key: 'entrega', label: 'Entrega', status: 'pendiente' },
]

/** Cuántas tendencias exige el proceso antes de dejar avanzar la etapa. */
export const MIN_TENDENCIAS = 4
export const MAX_TENDENCIAS = 5

export const TENDENCIAS_DEMO: TendenciaCandidata[] = [
  {
    id: 't1',
    eje: 'Marca',
    titulo: 'Longevidad como aspiración, no como miedo',
    descripcion:
      'La alimentación saludable deja de venderse como prevención del deterioro y pasa a venderse como ampliación de la vida activa.',
    fuentes: [
      { doc: 'Mintel 2026 Global Food and Drink Predictions', pagina: 31 },
      { doc: 'WGSN Generation Cheat Sheet', pagina: 12 },
    ],
  },
  {
    id: 't2',
    eje: 'Marca',
    titulo: 'El origen como identidad, no como sello',
    descripcion:
      'La procedencia deja de ser un ícono en el empaque y se convierte en el relato central de la marca: quién lo cultiva y dónde.',
    fuentes: [{ doc: 'Whole Foods Market Trends 2026' }, { doc: 'RADDAR Reports octubre 2025', pagina: 9 }],
  },
  {
    id: 't3',
    eje: 'Estrategia',
    titulo: 'Transparencia radical de la cadena',
    descripcion:
      'Publicar precios, márgenes y condiciones del productor como diferencial competitivo y no como obligación regulatoria.',
    fuentes: [{ doc: 'Good Deed Economy · TrendWatching', pagina: 24 }],
  },
  {
    id: 't4',
    eje: 'Estrategia',
    titulo: 'Conveniencia sin renunciar a lo fresco',
    descripcion:
      'El formato listo para consumir deja de asociarse a lo procesado; gana quien resuelve la fricción sin perder la percepción de fresco.',
    fuentes: [
      { doc: 'VML The Future Shopper Report 2025', pagina: 44 },
      { doc: 'Mintel 2026 Global Consumer Predictions', pagina: 18 },
    ],
  },
  {
    id: 't5',
    eje: 'Comunicación',
    titulo: 'El productor como creador',
    descripcion:
      'La autoridad de la marca se construye en formato corto y en primera persona, desde el campo y no desde el estudio.',
    fuentes: [{ doc: 'Social Media Study 2026', pagina: 37 }, { doc: '2026 Social Trends Report' }],
  },
  {
    id: 't6',
    eje: 'Comunicación',
    titulo: 'Vocabulario sin promesa',
    descripcion:
      'Retirada del lenguaje de milagro nutricional por presión regulatoria y por fatiga del consumidor.',
    fuentes: [{ doc: 'RADDAR Reports octubre 2025', pagina: 22 }],
  },
]

export const ACTIVIDAD_DEMO: Actividad[] = [
  { id: 'a1', autor: 'claude', texto: 'Guardó un borrador de Tendencias — 6 candidatas sobre 3 ejes', cuando: 'hace 2 h' },
  { id: 'a2', autor: 'claude', texto: 'Consultó el archivo del estudio: 6 informes, 2 landscapes previos', cuando: 'hace 2 h' },
  { id: 'a3', autor: 'humano', quien: 'Isa', texto: 'Aprobó Contexto del sector', cuando: 'ayer' },
  { id: 'a4', autor: 'claude', texto: 'Guardó Contexto del sector — cifras con fuente y año', cuando: 'ayer' },
]

export const EJES: Eje[] = ['Marca', 'Estrategia', 'Comunicación']
