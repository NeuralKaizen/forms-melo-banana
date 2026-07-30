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
  it('excludes the 4 identity questions, leaving 20', () => {
    const qs = interviewQuestions()
    expect(qs).toHaveLength(20)
    for (const id of ['nombre', 'empresa', 'cargo', 'email']) {
      expect(qs.find(q => q.id === id)).toBeUndefined()
    }
  })
})

describe('visibleQuestions', () => {
  it('muestra la pregunta edad una sola vez, sin depender del género (total 20)', () => {
    const qs = visibleQuestions({})
    expect(qs).toHaveLength(20)
    expect(qs.filter(q => q.id === 'edad')).toHaveLength(1)
  })
  it('con género mujer la pregunta edad se sigue mostrando una sola vez (total 20)', () => {
    const answers: Answers = { genero: { rawText: '', imageChoice: 'mujer' } }
    const qs = visibleQuestions(answers)
    expect(qs).toHaveLength(20)
    expect(qs.filter(q => q.id === 'edad')).toHaveLength(1)
    expect(qs.find(q => q.id === 'genero')).toBeDefined()
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

  it('la sección proyectiva no rama por género: edad aparece una sola vez', () => {
    const secs = visibleSections({ genero: { rawText: '', imageChoice: 'mujer' } })
    const projective = secs.find(s => s.key === 'projective')!
    const ids = projective.questions.map(q => q.question.id)
    expect(ids).toEqual(['animal', 'color', 'genero', 'edad', 'olor', 'ciudad'])
    expect(projective.questions.map(q => q.localNumber)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
