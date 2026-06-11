import { describe, it, expect } from 'vitest'
import { SCRIPT } from './questions'

describe('SCRIPT', () => {
  it('has unique question ids', () => {
    const ids = SCRIPT.flatMap(s => s.questions.map(q => q.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('covers the 5 sections from the form', () => {
    expect(SCRIPT.map(s => s.key)).toEqual([
      'identity', 'project', 'consumer', 'design', 'projective',
    ])
  })
  it('image-grid questions declare 2+ options, open questions declare none', () => {
    for (const s of SCRIPT) for (const q of s.questions) {
      if (q.type === 'image-grid') expect(q.options!.length).toBeGreaterThanOrEqual(2)
      else expect(q.options).toBeUndefined()
    }
  })
  it('every question has a non-empty prompt and audio path', () => {
    for (const s of SCRIPT) for (const q of s.questions) {
      expect(q.prompt.length).toBeGreaterThan(0)
      expect(q.audio).toMatch(/^\/audio\/.+\.mp3$/)
    }
  })
})
