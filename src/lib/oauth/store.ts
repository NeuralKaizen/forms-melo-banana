import { and, eq, isNull } from 'drizzle-orm'
import type { AnyDb } from '@/lib/db/store'
import { oauthClients, oauthCodes, oauthTokens } from '@/lib/db/schema'
import { hashear, nuevoToken, verificarPkceS256 } from './crypto'

/** El `codigo` es el de RFC 6749: la ruta lo devuelve tal cual en el JSON de error. */
export class ErrorOAuth extends Error {
  constructor(public codigo: string, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorOAuth'
  }
}

const VIDA_CODIGO_MS = 10 * 60_000
const VIDA_ACCESS_S = 3600

export async function registrarCliente(
  db: AnyDb, d: { redirectUris: string[]; name?: string },
): Promise<{ id: string; redirectUris: string[] }> {
  if (!d.redirectUris?.length)
    throw new ErrorOAuth('invalid_redirect_uri', 'Hace falta al menos un redirect_uri')
  // Solo https: un redirect_uri en texto plano deja el código de autorización expuesto
  // en tránsito, y el código es lo único que separa a un atacante de un token.
  for (const uri of d.redirectUris)
    if (!uri.startsWith('https://'))
      throw new ErrorOAuth('invalid_redirect_uri', `El redirect_uri tiene que ser https: ${uri}`)

  const id = `cli_${nuevoToken()}`
  await db.insert(oauthClients).values({ id, redirectUris: d.redirectUris, name: d.name ?? null })
  return { id, redirectUris: d.redirectUris }
}

export async function crearCodigo(db: AnyDb, d: {
  clientId: string; redirectUri: string; codeChallenge: string; scope: string; ahora?: Date
}): Promise<string> {
  const ahora = d.ahora ?? new Date()
  const codigo = nuevoToken()
  await db.insert(oauthCodes).values({
    code: hashear(codigo),
    clientId: d.clientId,
    redirectUri: d.redirectUri,
    codeChallenge: d.codeChallenge,
    scope: d.scope,
    expiresAt: new Date(ahora.getTime() + VIDA_CODIGO_MS),
  })
  return codigo
}

export async function canjearCodigo(db: AnyDb, codigo: string, d: {
  clientId: string; redirectUri: string; codeVerifier: string; ahora?: Date
}): Promise<{ scope: string }> {
  const ahora = d.ahora ?? new Date()
  const [fila] = await db.select().from(oauthCodes).where(eq(oauthCodes.code, hashear(codigo)))

  // Un solo mensaje para todos los rechazos del código: distinguir "no existe" de
  // "es de otro cliente" le diría a quien prueba a ciegas cuándo acertó la mitad.
  const malo = () => new ErrorOAuth('invalid_grant', 'El código no es válido, ya se usó o venció')

  if (!fila) throw malo()
  if (fila.usedAt) throw malo()
  if (fila.expiresAt <= ahora) throw malo()
  if (fila.clientId !== d.clientId) throw malo()
  if (fila.redirectUri !== d.redirectUri) throw malo()
  if (!verificarPkceS256(d.codeVerifier, fila.codeChallenge)) throw malo()

  // Marcar usado con `usedAt is null` en el WHERE: si dos pedidos llegan juntos, solo
  // uno actualiza una fila y el otro se va con las manos vacías.
  const sellado = await db.update(oauthCodes)
    .set({ usedAt: ahora })
    .where(and(eq(oauthCodes.code, fila.code), isNull(oauthCodes.usedAt)))
    .returning()
  if (!sellado.length) throw malo()

  return { scope: fila.scope }
}

export async function emitirTokens(db: AnyDb, d: {
  clientId: string; scope: string; ahora?: Date
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const ahora = d.ahora ?? new Date()
  const accessToken = nuevoToken()
  const refreshToken = nuevoToken()
  await db.insert(oauthTokens).values({
    accessHash: hashear(accessToken),
    refreshHash: hashear(refreshToken),
    clientId: d.clientId,
    scope: d.scope,
    accessExpiresAt: new Date(ahora.getTime() + VIDA_ACCESS_S * 1000),
  })
  return { accessToken, refreshToken, expiresIn: VIDA_ACCESS_S }
}

export async function rotarRefresh(db: AnyDb, refreshToken: string, d: {
  clientId: string; ahora?: Date
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string }> {
  const ahora = d.ahora ?? new Date()
  const [fila] = await db.select().from(oauthTokens)
    .where(eq(oauthTokens.refreshHash, hashear(refreshToken)))

  const malo = () => new ErrorOAuth('invalid_grant', 'El refresh token no es válido o ya se usó')
  if (!fila || fila.revokedAt || fila.clientId !== d.clientId) throw malo()

  // Revocar con `revoked_at is null` en el WHERE, por lo mismo que el código: dos
  // refresh simultáneos con el mismo token no pueden emitir dos pares de tokens.
  const revocado = await db.update(oauthTokens)
    .set({ revokedAt: ahora })
    .where(and(eq(oauthTokens.id, fila.id), isNull(oauthTokens.revokedAt)))
    .returning()
  if (!revocado.length) throw malo()

  const nuevos = await emitirTokens(db, { clientId: fila.clientId, scope: fila.scope, ahora })
  return { ...nuevos, scope: fila.scope }
}

export async function verificarAccessToken(
  db: AnyDb, token: string, ahora: Date = new Date(),
): Promise<{ clientId: string; scope: string } | null> {
  const [fila] = await db.select().from(oauthTokens)
    .where(eq(oauthTokens.accessHash, hashear(token)))
  if (!fila || fila.revokedAt || fila.accessExpiresAt <= ahora) return null
  return { clientId: fila.clientId, scope: fila.scope }
}
