// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { BriefDocument } from './BriefDocument'
import type { BriefView } from './answers-view'

const view: BriefView = {
  company: 'Frutaria', contact: 'Lucía · CMO', date: '11 jun 2026',
  sections: [{ title: 'Contexto del proyecto', items: [
    { prompt: '¿Historia?', answer: 'Desde 2018' },
    { prompt: '¿KPIs?', answer: '—' },
  ] }],
  projective: [
    { label: 'Animal', value: 'León' },
    { label: 'Color', value: 'Amarillo', swatch: '#EAB308' },
  ],
}

describe('BriefDocument', () => {
  it('renderiza un PDF válido (empieza con %PDF)', async () => {
    const buf = await renderToBuffer(<BriefDocument view={view} />)
    expect(buf.length).toBeGreaterThan(0)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
})
