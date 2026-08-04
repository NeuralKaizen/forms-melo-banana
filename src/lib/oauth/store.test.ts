import { describe, it, expect } from 'vitest'
import { makeTestDb } from '@/lib/db/testdb'
import { createHash } from 'node:crypto'
import { nuevoToken } from './crypto'
import {
  ErrorOAuth, registrarCliente, crearCodigo, canjearCodigo,
  emitirTokens, rotarRefresh, verificarAccessToken,
} from './store'

const CALLBACK = 'https://claude.ai/api/mcp/auth_callback'

async function clienteConCodigo(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
  const verifier = nuevoToken()
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const codigo = await crearCodigo(db, {
    clientId: cliente.id, redirectUri: CALLBACK, codeChallenge: challenge, scope: 'landscape',
  })
  return { cliente, verifier, codigo }
}

describe('oauth · store', () => {
  it('canjea un código válido una vez', async () => {
    const db = await makeTestDb()
    const { cliente, verifier, codigo } = await clienteConCodigo(db)
    const { scope } = await canjearCodigo(db, codigo, {
      clientId: cliente.id, redirectUri: CALLBACK, codeVerifier: verifier,
    })
    expect(scope).toBe('landscape')
  })

  it('un código usado no se puede volver a usar', async () => {
    const db = await makeTestDb()
    const { cliente, verifier, codigo } = await clienteConCodigo(db)
    const d = { clientId: cliente.id, redirectUri: CALLBACK, codeVerifier: verifier }
    await canjearCodigo(db, codigo, d)
    await expect(canjearCodigo(db, codigo, d)).rejects.toThrow(ErrorOAuth)
  })

  it('rechaza un code_verifier que no corresponde', async () => {
    const db = await makeTestDb()
    const { cliente, codigo } = await clienteConCodigo(db)
    await expect(canjearCodigo(db, codigo, {
      clientId: cliente.id, redirectUri: CALLBACK, codeVerifier: nuevoToken(),
    })).rejects.toThrow(ErrorOAuth)
  })

  it('rechaza un redirect_uri distinto del que pidió el código', async () => {
    const db = await makeTestDb()
    const { cliente, verifier, codigo } = await clienteConCodigo(db)
    await expect(canjearCodigo(db, codigo, {
      clientId: cliente.id, redirectUri: 'https://otro.example/cb', codeVerifier: verifier,
    })).rejects.toThrow(ErrorOAuth)
  })

  it('rechaza un código vencido', async () => {
    const db = await makeTestDb()
    const { cliente, verifier, codigo } = await clienteConCodigo(db)
    const enUnRato = new Date(Date.now() + 20 * 60_000)
    await expect(canjearCodigo(db, codigo, {
      clientId: cliente.id, redirectUri: CALLBACK, codeVerifier: verifier, ahora: enUnRato,
    })).rejects.toThrow(ErrorOAuth)
  })

  it('un access token recién emitido verifica', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const { accessToken } = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    expect(await verificarAccessToken(db, accessToken)).toEqual({
      clientId: cliente.id, scope: 'landscape',
    })
  })

  it('un access token vencido no verifica', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const { accessToken } = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    const enDosHoras = new Date(Date.now() + 2 * 3600_000)
    expect(await verificarAccessToken(db, accessToken, enDosHoras)).toBeNull()
  })

  it('un token inventado no verifica', async () => {
    const db = await makeTestDb()
    expect(await verificarAccessToken(db, nuevoToken())).toBeNull()
  })

  it('el refresh rota: el viejo muere y el nuevo sirve', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const primero = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    const segundo = await rotarRefresh(db, primero.refreshToken, { clientId: cliente.id })

    expect(segundo.refreshToken).not.toBe(primero.refreshToken)
    expect(await verificarAccessToken(db, segundo.accessToken)).not.toBeNull()
    await expect(rotarRefresh(db, primero.refreshToken, { clientId: cliente.id }))
      .rejects.toThrow(ErrorOAuth)
  })

  it('el access token viejo deja de servir después de rotar', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const primero = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    await rotarRefresh(db, primero.refreshToken, { clientId: cliente.id })
    expect(await verificarAccessToken(db, primero.accessToken)).toBeNull()
  })

  it('un cliente no puede usar el refresh de otro', async () => {
    const db = await makeTestDb()
    const a = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const b = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const tokens = await emitirTokens(db, { clientId: a.id, scope: 'landscape' })
    await expect(rotarRefresh(db, tokens.refreshToken, { clientId: b.id }))
      .rejects.toThrow(ErrorOAuth)
  })

  it('rechaza registrar un redirect_uri que no es https', async () => {
    const db = await makeTestDb()
    await expect(registrarCliente(db, { redirectUris: ['http://evil.example/cb'] }))
      .rejects.toThrow(ErrorOAuth)
  })

  it('rechaza crear un código con un redirect_uri no registrado para el cliente', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    await expect(crearCodigo(db, {
      clientId: cliente.id, redirectUri: 'https://atacante.example/cb',
      codeChallenge: 'x', scope: 'landscape',
    })).rejects.toThrow(ErrorOAuth)
  })

  it('rechaza crear un código para un client_id que no existe', async () => {
    const db = await makeTestDb()
    await expect(crearCodigo(db, {
      clientId: 'cli_inventado', redirectUri: CALLBACK, codeChallenge: 'x', scope: 'landscape',
    })).rejects.toThrow(ErrorOAuth)
  })

  it('un cliente no puede canjear el código de otro', async () => {
    const db = await makeTestDb()
    const { verifier, codigo } = await clienteConCodigo(db)
    const otro = await registrarCliente(db, { redirectUris: [CALLBACK] })
    await expect(canjearCodigo(db, codigo, {
      clientId: otro.id, redirectUri: CALLBACK, codeVerifier: verifier,
    })).rejects.toThrow(ErrorOAuth)
  })

  it('de dos canjes concurrentes del mismo código, exactamente uno gana', async () => {
    const db = await makeTestDb()
    const { cliente, verifier, codigo } = await clienteConCodigo(db)
    const d = { clientId: cliente.id, redirectUri: CALLBACK, codeVerifier: verifier }
    const resultados = await Promise.allSettled([
      canjearCodigo(db, codigo, d),
      canjearCodigo(db, codigo, d),
    ])
    const ganadores = resultados.filter((r) => r.status === 'fulfilled')
    const perdedores = resultados.filter((r) => r.status === 'rejected')
    expect(ganadores).toHaveLength(1)
    expect(perdedores).toHaveLength(1)
  })

  it('de dos rotaciones concurrentes del mismo refresh, exactamente una gana', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const primero = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    const resultados = await Promise.allSettled([
      rotarRefresh(db, primero.refreshToken, { clientId: cliente.id }),
      rotarRefresh(db, primero.refreshToken, { clientId: cliente.id }),
    ])
    const ganadores = resultados.filter((r) => r.status === 'fulfilled')
    const perdedores = resultados.filter((r) => r.status === 'rejected')
    expect(ganadores).toHaveLength(1)
    expect(perdedores).toHaveLength(1)
  })

  it('reusar un refresh ya rotado revoca toda la familia del cliente', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const primero = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    const segundo = await rotarRefresh(db, primero.refreshToken, { clientId: cliente.id })
    expect(await verificarAccessToken(db, segundo.accessToken)).not.toBeNull()

    // Reuso del refresh ya rotado: alguien —el dueño legítimo perdiendo la carrera, o
    // quien lo robó— presenta un token que ya murió al rotar.
    await expect(rotarRefresh(db, primero.refreshToken, { clientId: cliente.id }))
      .rejects.toThrow(ErrorOAuth)

    // La familia entera queda muerta, incluido el access token que había salido de la
    // rotación legítima: no alcanza con matar solo el refresh reusado.
    expect(await verificarAccessToken(db, segundo.accessToken)).toBeNull()
    await expect(rotarRefresh(db, segundo.refreshToken, { clientId: cliente.id }))
      .rejects.toThrow(ErrorOAuth)
  })

  it('rechaza un refresh vencido', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const primero = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    const en31Dias = new Date(Date.now() + 31 * 24 * 3600_000)
    await expect(rotarRefresh(db, primero.refreshToken, { clientId: cliente.id, ahora: en31Dias }))
      .rejects.toThrow(ErrorOAuth)
  })
})
