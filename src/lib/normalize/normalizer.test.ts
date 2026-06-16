import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeText } from './normalizer'

const okResponse = (content: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
})

describe('normalizeText', () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = 'test-key' })
  afterEach(() => { delete process.env.OPENROUTER_API_KEY })

  it('devuelve el texto corregido del modelo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('Hola, me llamo Ana.'))
    const out = await normalizeText('hola me llamo ana', { fetchImpl: fetchImpl as any })
    expect(out).toBe('Hola, me llamo Ana.')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('google/gemini-2.5-flash-lite')
    expect(body.temperature).toBe(0)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].content).toBe('hola me llamo ana')
    expect(init.headers.Authorization).toBe('Bearer test-key')
  })

  it('devuelve null sin OPENROUTER_API_KEY y no llama al fetch', async () => {
    delete process.env.OPENROUTER_API_KEY
    const fetchImpl = vi.fn()
    const out = await normalizeText('algo', { fetchImpl: fetchImpl as any })
    expect(out).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('devuelve null si la respuesta no es ok (no lanza)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    const out = await normalizeText('algo', { fetchImpl: fetchImpl as any })
    expect(out).toBeNull()
  })

  it('devuelve null si el fetch lanza', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'))
    const out = await normalizeText('algo', { fetchImpl: fetchImpl as any })
    expect(out).toBeNull()
  })
})
