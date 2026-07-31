export type QuestionType = 'open' | 'image-grid' | 'color-grid' | 'gender' | 'age-grid'

export interface Option {
  id: string
  label: string
  src?: string       // image-grid: ruta bajo /public
  colors?: string[]  // color-grid: rampa de shades CSS (claro→oscuro)
}

export type Answers = Record<string, { rawText: string; imageChoice?: string }>

export interface Question {
  id: string
  type: QuestionType
  prompt: string
  /** key idea to underline in the UI (substring of prompt) */
  highlight?: string
  audio: string // /audio/<id>.mp3
  options?: Option[]
  /** Proyectivas: pregunta guía que aparece al elegir una opción ("¿por qué?"). */
  followUp?: string
  /** Si está y devuelve false, la pregunta se omite del flujo (branching). */
  showIf?: (answers: Answers) => boolean
}

export interface Section {
  key: 'identity' | 'project' | 'consumer' | 'design' | 'projective'
  title: string
  questions: Question[]
}
