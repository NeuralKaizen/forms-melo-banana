import { describe, it, expect, vi } from 'vitest'
import { generateBrief } from './generator'

it('parses the model JSON into a Brief', async () => {
  const fakeClient = {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"resumen":"ok","secciones":[],"alertas":[]}' }],
      }),
    },
  } as any
  const brief = await generateBrief(fakeClient, { company: 'Acme' } as any, [])
  expect(brief.resumen).toBe('ok')
  expect(fakeClient.messages.create).toHaveBeenCalledOnce()
})
