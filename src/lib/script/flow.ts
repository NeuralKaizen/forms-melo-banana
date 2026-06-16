import { SCRIPT } from './questions'
import type { Question, Answers, Section } from './types'

export function allQuestions(): Question[] {
  return SCRIPT.flatMap(s => s.questions)
}

const IDENTITY_IDS = new Set(['nombre', 'empresa', 'cargo', 'email'])

/** Preguntas que se hacen en el flujo de voz (sin las de identidad). */
export function interviewQuestions(): Question[] {
  return allQuestions().filter(q => !IDENTITY_IDS.has(q.id))
}

export function firstQuestionId(): string {
  return allQuestions()[0].id
}

export function getQuestion(id: string): Question | undefined {
  return allQuestions().find(q => q.id === id)
}

export function nextQuestionId(id: string): string | null {
  const qs = allQuestions()
  const i = qs.findIndex(q => q.id === id)
  if (i === -1 || i === qs.length - 1) return null
  return qs[i + 1].id
}

export function progress(id: string): { index: number; total: number } {
  const qs = allQuestions()
  return { index: qs.findIndex(q => q.id === id) + 1, total: qs.length }
}

/** Preguntas visibles según las respuestas (aplica branching vía showIf). */
export function visibleQuestions(answers: Answers): Question[] {
  return interviewQuestions().filter(q => !q.showIf || q.showIf(answers))
}

export interface SectionView {
  key: Section['key']
  title: string
  questions: { question: Question; index: number; localNumber: number }[]
}

/** Preguntas visibles agrupadas por sección del flujo de voz (identity excluida). */
export function visibleSections(answers: Answers): SectionView[] {
  let globalIndex = 0
  const views: SectionView[] = []
  for (const section of SCRIPT) {
    if (section.key === 'identity') continue
    const visible = section.questions.filter(q => !q.showIf || q.showIf(answers))
    if (visible.length === 0) continue
    views.push({
      key: section.key,
      title: section.title,
      questions: visible.map((question, i) => ({
        question,
        index: globalIndex++,
        localNumber: i + 1,
      })),
    })
  }
  return views
}
