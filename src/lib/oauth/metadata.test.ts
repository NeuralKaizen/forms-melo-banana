import { describe, it, expect, beforeEach } from 'vitest'
import { baseUrl, urlDelMcp, docRecursoProtegido, docServidorAutorizacion } from './metadata'

beforeEach(() => { process.env.MCP_PUBLIC_URL = 'https://ejemplo.test/' })

describe('oauth · metadata', () => {
  it('saca la barra final para que el resource compare exacto', () => {
    expect(baseUrl()).toBe('https://ejemplo.test')
    expect(urlDelMcp()).toBe('https://ejemplo.test/api/mcp')
  })

  it('el resource apunta al endpoint MCP, no a la raíz', () => {
    expect(docRecursoProtegido()).toMatchObject({
      resource: 'https://ejemplo.test/api/mcp',
      authorization_servers: ['https://ejemplo.test'],
    })
  })

  it('el servidor de autorización anuncia PKCE S256 y los tres endpoints', () => {
    const doc = docServidorAutorizacion() as Record<string, unknown>
    expect(doc.code_challenge_methods_supported).toEqual(['S256'])
    expect(doc.authorization_endpoint).toBe('https://ejemplo.test/api/oauth/authorize')
    expect(doc.token_endpoint).toBe('https://ejemplo.test/api/oauth/token')
    expect(doc.registration_endpoint).toBe('https://ejemplo.test/api/oauth/register')
    expect(doc.grant_types_supported).toEqual(['authorization_code', 'refresh_token'])
  })

  it('explota si falta la variable, en vez de anunciar una URL vacía', () => {
    delete process.env.MCP_PUBLIC_URL
    expect(() => baseUrl()).toThrow(/MCP_PUBLIC_URL/)
  })
})
