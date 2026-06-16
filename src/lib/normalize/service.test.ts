import { describe, it, expect, vi } from 'vitest'
import { makeTestDb } from '../db/testdb'
import { createSession, saveAnswer, getSessionWithAnswers } from '../db/store'
import { ensureNormalized } from './service'
import * as normalizer from './normalizer'

describe('ensureNormalized', () => {
  it('rellena normalized_text en las respuestas pendientes', async () => {
    const spy = vi.spyOn(normalizer, 'normalizeText')
      .mockImplementation(async (t: string) => t.toUpperCase())
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'ana' })
    await saveAnswer(db, s.id, { questionId: 'empresa', rawText: 'acme' })

    await ensureNormalized(db, s.id)

    const full = await getSessionWithAnswers(db, s.id)
    const texts = full!.answers.map((a: any) => a.normalizedText).sort()
    expect(texts).toEqual(['ACME', 'ANA'])
    spy.mockRestore()
  })

  it('es idempotente: no re-normaliza lo ya hecho', async () => {
    const spy = vi.spyOn(normalizer, 'normalizeText')
      .mockImplementation(async (t: string) => t.toUpperCase())
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'ana' })

    await ensureNormalized(db, s.id)
    await ensureNormalized(db, s.id)

    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('saltea respuestas vacías o placeholder', async () => {
    const spy = vi.spyOn(normalizer, 'normalizeText')
      .mockImplementation(async (t: string) => t.toUpperCase())
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'a', rawText: '—' })
    await saveAnswer(db, s.id, { questionId: 'b', rawText: '   ' })

    await ensureNormalized(db, s.id)

    expect(spy).not.toHaveBeenCalled()
    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.answers.every((a: any) => a.normalizedText == null)).toBe(true)
    spy.mockRestore()
  })

  it('si normalizeText devuelve null, no persiste (reintenta luego)', async () => {
    const spy = vi.spyOn(normalizer, 'normalizeText').mockResolvedValue(null)
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'ana' })

    await ensureNormalized(db, s.id)

    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.answers[0].normalizedText).toBeNull()
    spy.mockRestore()
  })
})
