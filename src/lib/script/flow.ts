import { SCRIPT } from './questions'
import type { Question } from './types'

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
