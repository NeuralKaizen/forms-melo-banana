import { describe, it, expect } from 'vitest'
import { esUuidValido } from './ids'

describe('esUuidValido', () => {
  it('acepta un UUID con guiones, en minúsculas o mayúsculas', () => {
    expect(esUuidValido('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(esUuidValido('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('acepta el UUID nulo (todo ceros): es forma válida aunque no sea un id real', () => {
    expect(esUuidValido('00000000-0000-0000-0000-000000000000')).toBe(true)
  })

  it('rechaza strings sin pinta de UUID', () => {
    expect(esUuidValido('no-es-un-uuid')).toBe(false)
    expect(esUuidValido('')).toBe(false)
    expect(esUuidValido('123')).toBe(false)
  })

  it('rechaza un UUID sin guiones o con la cantidad de caracteres incorrecta', () => {
    expect(esUuidValido('550e8400e29b41d4a716446655440000')).toBe(false)
    expect(esUuidValido('550e8400-e29b-41d4-a716-44665544000')).toBe(false)
  })

  it('rechaza un UUID con caracteres fuera de rango hexadecimal', () => {
    expect(esUuidValido('550e8400-e29b-41d4-a716-44665544000g')).toBe(false)
  })
})
