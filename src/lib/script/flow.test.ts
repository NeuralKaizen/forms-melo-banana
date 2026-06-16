import { describe, it, expect } from 'vitest'
import { allQuestions, firstQuestionId, nextQuestionId, progress, interviewQuestions, visibleQuestions, visibleSections } from './flow'
import type { Answers } from './types'

describe('flow', () => {
  it('flattens questions in section order', () => {
    const ids = allQuestions().map(q => q.id)
    expect(ids[0]).toBe('nombre')
    expect(ids).toContain('animal')
  })
  it('firstQuestionId is nombre', () => {
    expect(firstQuestionId()).toBe('nombre')
  })
  it('nextQuestionId returns the following id, then null at the end', () => {
    expect(nextQuestionId('nombre')).toBe('empresa')
    const last = allQuestions().at(-1)!.id
    expect(nextQuestionId(last)).toBeNull()
  })
  it('progress is 1-based index and total', () => {
    expect(progress('nombre')).toEqual({ index: 1, total: allQuestions().length })
  })
})

describe('interviewQuestions', () => {
  it('excludes the 4 identity questions, leaving 21', () => {
    const qs = interviewQuestions()
    expect(qs).toHaveLength(21)
    for (const id of ['nombre', 'empresa', 'cargo', 'email']) {
      expect(qs.find(q => q.id === id)).toBeUndefined()
    }
  })
})

describe('visibleQuestions', () => {
  it('muestra edad_hombre por defecto y oculta edad_mujer (total 20)', () => {
    const qs = visibleQuestions({})
    expect(qs).toHaveLength(20)
    expect(qs.find(q => q.id === 'edad_hombre')).toBeDefined()
    expect(qs.find(q => q.id === 'edad_mujer')).toBeUndefined()
  })
  it('con género mujer muestra edad_mujer y oculta edad_hombre (total 20)', () => {
    const answers: Answers = { genero: { rawText: '', imageChoice: 'mujer' } }
    const qs = visibleQuestions(answers)
    expect(qs).toHaveLength(20)
    expect(qs.find(q => q.id === 'edad_mujer')).toBeDefined()
    expect(qs.find(q => q.id === 'edad_hombre')).toBeUndefined()
  })
})

describe('visibleSections', () => {
  it('agrupa por sección (excluye identity) con numeración local y global', () => {
    const secs = visibleSections({})
    expect(secs.map(s => s.key)).toEqual(['project', 'consumer', 'design', 'projective'])
    expect(secs[0].title).toBe('Contexto del proyecto')
    expect(secs[0].questions[0]).toMatchObject({ index: 0, localNumber: 1 })
    expect(secs[0].questions[0].question.id).toBe('empresa_historia')
    expect(secs[0].questions.map(q => q.localNumber)).toEqual([1, 2, 3, 4, 5, 6, 7])
    const allIdx = secs.flatMap(s => s.questions.map(q => q.index))
    expect(allIdx).toEqual([...Array(20).keys()])
  })

  it('respeta el branching de género en la numeración', () => {
    const secs = visibleSections({ genero: { rawText: '', imageChoice: 'mujer' } })
    const projective = secs.find(s => s.key === 'projective')!
    const ids = projective.questions.map(q => q.question.id)
    expect(ids).toContain('edad_mujer')
    expect(ids).not.toContain('edad_hombre')
    expect(projective.questions.map(q => q.localNumber)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
