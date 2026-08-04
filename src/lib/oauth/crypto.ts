import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** Token opaco para códigos, access y refresh. base64url: viaja en URLs y headers sin escapar. */
export function nuevoToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Lo que se guarda en la base. Un token robado de la base no sirve para nada porque
 * lo que hay guardado es el hash, no el token.
 */
export function hashear(valor: string): string {
  return createHash('sha256').update(valor).digest('hex')
}

/**
 * PKCE S256: el challenge es sha256(verifier) en base64url. La comparación va en tiempo
 * constante — comparar con === filtra por cuánto tarda en encontrar la primera diferencia.
 */
export function verificarPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  const esperado = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  const recibido = Buffer.from(challenge)
  if (esperado.length !== recibido.length) return false
  return timingSafeEqual(esperado, recibido)
}
