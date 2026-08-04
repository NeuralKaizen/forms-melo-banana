/**
 * Todo sale de una sola variable para que mudar de dominio sea configuración y no
 * cirugía. El `resource` tiene que coincidir *exacto* con la URL que se pega en
 * claude.ai, path incluido: si difiere en una barra, el descubrimiento falla.
 */
export function baseUrl(): string {
  const v = process.env.MCP_PUBLIC_URL
  if (!v) throw new Error('Falta MCP_PUBLIC_URL')
  return v.replace(/\/+$/, '')
}

export function urlDelMcp(): string {
  return `${baseUrl()}/api/mcp`
}

export function docRecursoProtegido() {
  return {
    resource: urlDelMcp(),
    authorization_servers: [baseUrl()],
    scopes_supported: ['landscape'],
    bearer_methods_supported: ['header'],
  }
}

export function docServidorAutorizacion() {
  const base = baseUrl()
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['landscape'],
  }
}
