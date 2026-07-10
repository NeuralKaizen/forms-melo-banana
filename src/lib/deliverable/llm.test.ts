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
})
