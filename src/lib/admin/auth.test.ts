import { describe, it, expect, beforeEach } from 'vitest'
import { isValidAdminToken } from './auth'

beforeEach(() => { process.env.ADMIN_PASSWORD = 'secret' })

describe('admin auth', () => {
  it('accepts the matching token, rejects others', () => {
    expect(isValidAdminToken('secret')).toBe(true)
    expect(isValidAdminToken('nope')).toBe(false)
    expect(isValidAdminToken(undefined)).toBe(false)
  })
})
