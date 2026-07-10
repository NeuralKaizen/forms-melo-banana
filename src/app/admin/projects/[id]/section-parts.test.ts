import { describe, it, expect } from 'vitest'
import { partsOfSection, type SectionNumber } from './section-parts'

describe('partsOfSection', () => {
  it('sección 1 regenera problema', () => {
    expect(partsOfSection(1)).toEqual([{ key: 'problema', label: 'Regenerar' }])
  })
  it('sección 2 regenera competencia', () => {
    expect(partsOfSection(2)).toEqual([{ key: 'competencia', label: 'Regenerar' }])
  })
  it('sección 3 regenera perfil y propuesta de valor por separado', () => {
    expect(partsOfSection(3)).toEqual([
      { key: 'perfil', label: 'Regenerar perfil' },
      { key: 'propuestaValor', label: 'Regenerar propuesta de valor' },
    ])
  })
  it('las tres secciones cubren exactamente las 4 partes imprimibles', () => {
    const keys = ([1, 2, 3] as SectionNumber[]).flatMap(n => partsOfSection(n).map(p => p.key))
    expect([...keys].sort()).toEqual(['competencia', 'perfil', 'problema', 'propuestaValor'])
  })
})
