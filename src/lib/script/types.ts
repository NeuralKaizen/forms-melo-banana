export type QuestionType = 'open' | 'image-grid'

export interface ImageOption {
  id: string
  label: string
  src: string // path under /public, e.g. /projective/animal/lion.jpg
}

export interface Question {
  id: string
  type: QuestionType
  prompt: string
  /** key idea to underline in the UI (substring of prompt) */
  highlight?: string
  audio: string // /audio/<id>.mp3
  options?: ImageOption[] // only for image-grid
}

export interface Section {
  key: 'identity' | 'project' | 'consumer' | 'design' | 'projective'
  title: string
  questions: Question[]
}
