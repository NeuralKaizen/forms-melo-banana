import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testdb'
import { createSession, saveAnswer, getSessionWithAnswers, completeSession } from './store'
import { answers } from './schema'

type AnswerRow = typeof answers.$inferSelect

describe('store', () => {
  it('creates a session and reads it back', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, { name: 'Ana', company: 'Acme', role: 'CMO', email: 'a@x.com' })
    expect(s.id).toBeTruthy()
    expect(s.status).toBe('in_progress')
  })

  it('saves answers and completeSession flips status', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'Ana' })
    await saveAnswer(db, s.id, { questionId: 'animal', rawText: 'ágil', imageChoice: 'dolphin' })
    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.answers).toHaveLength(2)
    expect(full!.answers.find((a: AnswerRow) => a.questionId === 'animal')!.imageChoice).toBe('dolphin')

    const done = await completeSession(db, s.id)
    expect(done.status).toBe('completed')
    expect(done.completedAt).toBeTruthy()
  })

  it('re-answering the same question updates in place (no duplicate)', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'primera' })
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'corregida' })
    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.answers).toHaveLength(1)
    expect(full!.answers[0].rawText).toBe('corregida')
  })
})
