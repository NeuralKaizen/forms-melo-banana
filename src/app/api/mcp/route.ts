import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { db } from '@/lib/db/client'
import { verificarAccessToken } from '@/lib/oauth/store'

const handler = createMcpHandler(
  () => {
    // Las herramientas llegan en la Tarea 11.
  },
  { serverInfo: { name: 'melo-banana', version: '1.0.0' } },
)

/**
 * Sin token válido la respuesta es 401 con `WWW-Authenticate` apuntando al documento
 * de recurso protegido — es lo único que le dice a Claude dónde descubrir el resto.
 * `withMcpAuth` arma ese header; nosotros solo decimos si el token sirve.
 */
async function verificar(_req: Request, bearer?: string) {
  if (!bearer) return undefined
  const info = await verificarAccessToken(db, bearer)
  if (!info) return undefined
  return { token: bearer, clientId: info.clientId, scopes: info.scope.split(' ') }
}

const protegido = withMcpAuth(handler, verificar, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { protegido as GET, protegido as POST }
