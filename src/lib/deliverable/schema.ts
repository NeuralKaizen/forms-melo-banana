export type Origen = 'cliente' | 'equipo' | 'pendiente'

export interface Item {
  texto: string
  origen: Origen
  cita?: string | null
}

export interface Personalidad {
  arquetipo: string
  atributos: string[]
  queNoQuiereSer: string[]
  tensiones: string[]
}

export interface Problema {
  problemaMundo: string
  problemaMarca: string
  problemaConsumidor: Item[]
  comoLoHacemos: Item[]
  porQueRelevante: Item[]
}

export interface Eje {
  nombre: string
  extremoIzquierdo: string
  extremoDerecho: string
  origen: Origen
}

export interface Referente {
  marca: string
  tipo: string
  origen: Origen
}

export interface Competencia {
  competidores: Item[]
  otrosReferentes: Referente[]
  ejes: Eje[]
  posicionActual: Item
  posicionIdeal: Item
}

export interface Perfil {
  jobs: Item[]
  gains: Item[]
  pains: Item[]
}

export interface FilaValor {
  job: string
  solucion: string
  comoSeResuelve: string
  origen: Origen
}

export interface PropuestaValor {
  formula: {
    marca: string
    verbo: string
    razonDeSer: string
    beneficioCentral: string
  }
  filas: FilaValor[]
}

export type PartKey = 'personalidad' | 'problema' | 'competencia' | 'perfil' | 'propuestaValor'

export interface PartMeta {
  generatedAt: string
  error?: string | null
}

export interface Part<T> {
  data: T | null
  meta: PartMeta
}

export interface Deliverable {
  personalidad?: Part<Personalidad>
  problema?: Part<Problema>
  competencia?: Part<Competencia>
  perfil?: Part<Perfil>
  propuestaValor?: Part<PropuestaValor>
}

export interface RespondentInput {
  respondentName: string
  role: string
  answers: {
    questionId: string
    text: string
    imageChoice?: string | null
  }[]
}
