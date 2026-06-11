import { describe, it, expect, vi } from 'vitest'
import { FakeVoice } from './fake-voice'

describe('FakeVoice', () => {
  it('emits partials on start and resolves the final on stop', async () => {
    const v = new FakeVoice('hola mundo', ['hola', 'hola mundo'])
    const onPartial = vi.fn()
    v.start(onPartial)
    expect(onPartial).toHaveBeenNthCalledWith(1, 'hola')
    expect(onPartial).toHaveBeenNthCalledWith(2, 'hola mundo')
    expect(await v.stop()).toBe('hola mundo')
  })

  it('reports STT supported', () => {
    expect(new FakeVoice('').isSTTSupported()).toBe(true)
  })
})
