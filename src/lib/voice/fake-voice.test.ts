import { describe, it, expect } from 'vitest'
import { FakeVoice } from './fake-voice'

describe('FakeVoice', () => {
  it('records played urls and returns scripted transcripts', async () => {
    const v = new FakeVoice(['hola', 'mundo'])
    await v.play('/audio/nombre.mp3')
    expect(v.played).toEqual(['/audio/nombre.mp3'])
    expect(await v.listen()).toBe('hola')
    expect(await v.listen()).toBe('mundo')
  })
  it('reports STT supported', () => {
    expect(new FakeVoice([]).isSTTSupported()).toBe(true)
  })
})
