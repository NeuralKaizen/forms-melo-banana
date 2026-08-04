import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { nuevoToken, hashear, verificarPkceS256 } from './crypto'

describe('oauth · crypto', () => {
  it('cada token es distinto y no trae relleno de base64', () => {
    const a = nuevoToken()
    const b = nuevoToken()
    expect(a).not.toBe(b)
    expect(a).not.toContain('=')
    expect(a.length).toBeGreaterThan(32)
  })

  it('hashear es estable y no devuelve el valor original', () => {
    expect(hashear('hola')).toBe(hashear('hola'))
    expect(hashear('hola')).not.toBe('hola')
    expect(hashear('hola')).not.toBe(hashear('chau'))
  })

  it('acepta el verifier que produjo el challenge', () => {
    const verifier = nuevoToken()
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    expect(verificarPkceS256(verifier, challenge)).toBe(true)
  })

  it('rechaza un verifier que no corresponde', () => {
    const challenge = createHash('sha256').update(nuevoToken()).digest('base64url')
    expect(verificarPkceS256(nuevoToken(), challenge)).toBe(false)
  })

  it('rechaza un challenge vacío en vez de aceptarlo por descuido', () => {
    expect(verificarPkceS256(nuevoToken(), '')).toBe(false)
  })
})
