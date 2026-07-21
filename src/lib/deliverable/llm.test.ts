import { describe, it, expect } from 'vitest'
import { callJson } from './llm'

function fakeClient(responses: string[]) {
  let i = 0
  return { messages: { create: async () => ({ content: [{ type: 'text', text: responses[i++] }] }) } } as any
}
const validate = (o: any) => { if (typeof o?.ok !== 'boolean') throw new Error('shape'); return o as { ok: boolean } }

describe('callJson', () => {
  it('parsea JSON envuelto en texto', async () => {
    const c = fakeClient(['claro:\n{"ok": true}\ngracias'])
    expect(await callJson(c, 'p', 100, validate)).toEqual({ ok: true })
  })
  it('reintenta una vez ante JSON inválido y luego resuelve', async () => {
    const c = fakeClient(['no es json', '{"ok": false}'])
    expect(await callJson(c, 'p', 100, validate)).toEqual({ ok: false })
  })
  it('tira si falla dos veces', async () => {
    const c = fakeClient(['nope', 'tampoco'])
    await expect(callJson(c, 'p', 100, validate)).rejects.toThrow()
  })
  it('ante truncado por max_tokens falla claro y sin reintentar', async () => {
    let calls = 0
    const c = { messages: { create: async () => { calls++; return { content: [{ type: 'text', text: '{"ok": tr' }], stop_reason: 'max_tokens' } } } } as any
    await expect(callJson(c, 'p', 100, validate)).rejects.toThrow(/trunc|max_tokens/i)
    expect(calls).toBe(1) // reintentar con el mismo tope volvería a truncar: no tiene sentido
  })
})
