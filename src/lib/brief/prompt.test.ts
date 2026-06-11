import { describe, it, expect } from 'vitest'
import { buildBriefPrompt } from './prompt'

describe('buildBriefPrompt', () => {
  it('includes section titles and each answer with its question prompt', () => {
    const p = buildBriefPrompt(
      { name: 'Ana', company: 'Acme' } as any,
      [{ questionId: 'porque_ahora', rawText: 'Para crecer', imageChoice: null } as any],
    )
    expect(p).toContain('Acme')
    expect(p).toContain('evolucionar la marca') // from the question prompt
    expect(p).toContain('Para crecer')
  })
})
