import { describe, it, expect } from 'vitest'
import { destinoSeguro } from './page'

const ORIGIN = 'https://app.example'

describe('destinoSeguro', () => {
  it('deja pasar una ruta interna', () => {
    expect(destinoSeguro('/admin/projects/abc', ORIGIN)).toBe('/admin/projects/abc')
  })

  it('preserva query y hash de una ruta interna', () => {
    expect(destinoSeguro('/admin/projects/abc?x=1#y', ORIGIN)).toBe('/admin/projects/abc?x=1#y')
  })

  it('cae a /admin con una barra invertida (normalización de navegador → otro origen)', () => {
    expect(destinoSeguro('/\\evil.com', ORIGIN)).toBe('/admin')
  })

  it('cae a /admin con una URL protocol-relative', () => {
    expect(destinoSeguro('//evil.com', ORIGIN)).toBe('/admin')
  })

  it('cae a /admin con una URL absoluta a otro dominio', () => {
    expect(destinoSeguro('https://evil.com', ORIGIN)).toBe('/admin')
  })

  it('cae a /admin con un esquema javascript:', () => {
    expect(destinoSeguro('javascript:alert(1)', ORIGIN)).toBe('/admin')
  })

  it('cae a /admin sin next', () => {
    expect(destinoSeguro('', ORIGIN)).toBe('/admin')
  })
})
