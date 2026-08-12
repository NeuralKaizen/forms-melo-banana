import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, './globals.css'), 'utf8')

describe('tokens del panel', () => {
  it('define los tokens del rediseño con los valores del spec', () => {
    for (const [token, valor] of [
      ['--banana', '#FFD400'],
      ['--ink', '#15120C'],
      ['--line', '#EDEAE1'],
      ['--aprobado', '#FFF3B8'],
      ['--superficie', '#F8F6F0'],
    ]) {
      expect(css).toContain(`${token}: ${valor}`)
    }
  })

  it('conserva --cream, que sigue usando la entrevista pública', () => {
    expect(css).toContain('--cream')
  })

  it('conserva el bloque de prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
