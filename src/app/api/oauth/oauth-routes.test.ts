import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { nuevoToken } from '@/lib/oauth/crypto'

// Las rutas importan `db` desde `@/lib/db/client`, que en producción abre una conexión
// Neon real (necesita DATABASE_URL). Acá lo reemplazamos por una PGlite en memoria —
// la misma base de test que usa `store.test.ts` — para no tocar nada real.
vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

// `/authorize` lee la cookie `admin` con `cookies()` de `next/headers`, que fuera del
// runtime de un pedido real de Next explota con "called outside a request scope".
// La reemplazamos por un mapa que los tests controlan directamente.
const cookieJar = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const valor = cookieJar.get(name)
      return valor === undefined ? undefined : { name, value: valor }
    },
  }),
}))

import { POST as registerPOST } from './register/route'
import { GET as authorizeGET, POST as authorizePOST } from './authorize/route'
import { POST as tokenPOST } from './token/route'

const CALLBACK = 'https://claude.ai/api/mcp/auth_callback'
const ADMIN_PW = 'contraseña-de-prueba'

function pkce() {
  const verifier = nuevoToken()
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function req(url: string, init?: RequestInit): Request {
  return new Request(url, init)
}

async function registrarViaRuta(redirectUris: string[] = [CALLBACK]) {
  const res = await registerPOST(req('http://localhost/api/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ redirect_uris: redirectUris, client_name: 'prueba' }),
  }))
  const body = await res.json()
  return { res, body }
}

beforeAll(() => { process.env.ADMIN_PASSWORD = ADMIN_PW })
afterAll(() => { delete process.env.ADMIN_PASSWORD })

describe('POST /api/oauth/register', () => {
  it('con redirect_uris válido devuelve 201 y un client_id', async () => {
    const { res, body } = await registrarViaRuta()
    expect(res.status).toBe(201)
    expect(typeof body.client_id).toBe('string')
    expect(body.client_id.length).toBeGreaterThan(0)
    expect(body.redirect_uris).toEqual([CALLBACK])
  })

  it('con body que no es JSON válido devuelve 400', async () => {
    const res = await registerPOST(req('http://localhost/api/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'esto no es json',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_client_metadata')
  })

  it('sin redirect_uris devuelve 400', async () => {
    const res = await registerPOST(req('http://localhost/api/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'sin uris' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_redirect_uri')
  })

  it('con un redirect_uri que no es https devuelve 400 (rama ErrorOAuth)', async () => {
    const res = await registerPOST(req('http://localhost/api/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: ['http://evil.example/cb'] }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_redirect_uri')
  })
})

describe('POST /api/oauth/token', () => {
  it('con grant_type desconocido devuelve 400 unsupported_grant_type', async () => {
    const res = await tokenPOST(req('http://localhost/api/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'algo_raro' }).toString(),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('unsupported_grant_type')
  })

  it('con un código inválido devuelve 400 invalid_grant, no 500', async () => {
    const res = await tokenPOST(req('http://localhost/api/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'codigo_inventado',
        redirect_uri: CALLBACK,
        client_id: 'cli_inventado',
        code_verifier: nuevoToken(),
      }).toString(),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_grant')
  })

  it('acepta el cuerpo form-urlencoded (no JSON) — el bug clásico da 415', async () => {
    // Mismo pedido que el anterior, pero lo que importa acá es que el content-type sea
    // el que manda el cliente real (form-urlencoded) y la ruta no intente parsear JSON.
    const res = await tokenPOST(req('http://localhost/api/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=inventado&client_id=cli_inventado',
    }))
    expect(res.status).not.toBe(415)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_grant')
  })
})

describe('GET/POST /api/oauth/authorize — validaciones', () => {
  it('sin code_challenge_method=S256 devuelve 400', async () => {
    const { body: cliente } = await registrarViaRuta()
    const url = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=xyz`
    const res = await authorizeGET(req(url))
    expect(res.status).toBe(400)
  })

  it('con un redirect_uri no registrado devuelve 400 y no redirige', async () => {
    const { body: cliente } = await registrarViaRuta()
    const otra = 'https://atacante.example/cb'
    const url = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent(otra)}&code_challenge=xyz&code_challenge_method=S256`
    const res = await authorizeGET(req(url))
    expect(res.status).toBe(400)
    expect(res.headers.get('location')).toBeNull()
  })

  it('un client_id inexistente y un redirect_uri no registrado dan la misma respuesta ' +
    '(sin eso, alguien sin sesión podría probar qué client_id existe)', async () => {
    const { body: cliente } = await registrarViaRuta()

    const urlClienteInexistente = `http://localhost/api/oauth/authorize?client_id=cli_no_existe` +
      `&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=xyz&code_challenge_method=S256`
    const resClienteInexistente = await authorizeGET(req(urlClienteInexistente))

    const urlRedirectNoRegistrado = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent('https://atacante.example/cb')}` +
      `&code_challenge=xyz&code_challenge_method=S256`
    const resRedirectNoRegistrado = await authorizeGET(req(urlRedirectNoRegistrado))

    expect(resClienteInexistente.status).toBe(resRedirectNoRegistrado.status)
    const [bodyA, bodyB] = await Promise.all([resClienteInexistente.json(), resRedirectNoRegistrado.json()])
    expect(bodyA.error).toBe(bodyB.error)
  })

  it('un POST con Origin ajeno devuelve 403 y no emite código, aun con sesión válida ' +
    '(CSRF: una página ajena no puede autoenviar el formulario de consentimiento)', async () => {
    const { body: cliente } = await registrarViaRuta()
    const { challenge } = pkce()
    cookieJar.set('admin', ADMIN_PW)

    const url = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=${challenge}` +
      `&code_challenge_method=S256`
    const res = await authorizePOST(req(url, { method: 'POST', headers: { origin: 'https://atacante.example' } }))
    expect(res.status).toBe(403)
    expect(res.headers.get('location')).toBeNull()
  })

  it('un POST sin Origin devuelve 403 (los navegadores siempre lo mandan en POST; ' +
    'su ausencia no es el formulario de consentimiento)', async () => {
    const { body: cliente } = await registrarViaRuta()
    const { challenge } = pkce()
    cookieJar.set('admin', ADMIN_PW)

    const url = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=${challenge}` +
      `&code_challenge_method=S256`
    const res = await authorizePOST(req(url, { method: 'POST' }))
    expect(res.status).toBe(403)
  })

  it('con scope=landscape%20admin otorga solo landscape (no rechaza, filtra)', async () => {
    const { body: cliente } = await registrarViaRuta()
    const { verifier, challenge } = pkce()
    cookieJar.set('admin', ADMIN_PW)

    const url = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=${challenge}` +
      `&code_challenge_method=S256&scope=${encodeURIComponent('landscape admin')}`
    const autorizado = await authorizePOST(req(url, { method: 'POST', headers: { origin: 'http://localhost' } }))
    expect(autorizado.status).toBe(303)
    const codigo = new URL(autorizado.headers.get('location')!).searchParams.get('code')

    const canje = await tokenPOST(req('http://localhost/api/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code: codigo!, redirect_uri: CALLBACK,
        client_id: cliente.client_id, code_verifier: verifier,
      }).toString(),
    }))
    expect(canje.status).toBe(200)
    const tokens = await canje.json()
    expect(tokens.scope).toBe('landscape')
  })
})

describe('GET /api/oauth/authorize — pantalla de consentimiento', () => {
  it('muestra el nombre del cliente registrado y el host del redirect_uri', async () => {
    const { body: cliente } = await registrarViaRuta()
    cookieJar.set('admin', ADMIN_PW)

    const url = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=xyz&code_challenge_method=S256`
    const res = await authorizeGET(req(url))
    expect(res.status).toBe(200)
    const html = await res.text()
    // `registrarViaRuta` registra el cliente con client_name: 'prueba'.
    expect(html).toContain('prueba')
    expect(html).toContain(new URL(CALLBACK).host)
  })

  it('sin client_name declarado, muestra un texto neutro pero igual el host', async () => {
    const res = await registerPOST(req('http://localhost/api/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: [CALLBACK] }),
    }))
    const cliente = await res.json()
    cookieJar.set('admin', ADMIN_PW)

    const url = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=xyz&code_challenge_method=S256`
    const html = await (await authorizeGET(req(url))).text()
    expect(html).toContain(new URL(CALLBACK).host)
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('null')
  })

  it('un client_name con HTML no se inyecta sin escapar (queda como texto)', async () => {
    const res = await registerPOST(req('http://localhost/api/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: [CALLBACK], client_name: '<script>alert(1)</script>' }),
    }))
    const cliente = await res.json()
    cookieJar.set('admin', ADMIN_PW)

    const url = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=xyz&code_challenge_method=S256`
    const html = await (await authorizeGET(req(url))).text()
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('flujo completo: registrar → autorizar → canjear', () => {
  it('registra, crea código con la cookie admin puesta, lo canjea y obtiene tokens; ' +
    'canjear el mismo código dos veces falla la segunda', async () => {
    const { body: cliente } = await registrarViaRuta()
    const { verifier, challenge } = pkce()
    const state = 'estado-123'

    const urlAutorizar = `http://localhost/api/oauth/authorize?client_id=${cliente.client_id}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge=${challenge}` +
      `&code_challenge_method=S256&state=${state}`

    // Sin cookie: la ruta no debe emitir código.
    cookieJar.clear()
    const sinSesion = await authorizePOST(req(urlAutorizar, { method: 'POST' }))
    expect(sinSesion.status).toBe(401)

    // Con la cookie admin puesta, consiente y emite el código.
    cookieJar.set('admin', ADMIN_PW)
    const autorizado = await authorizePOST(req(urlAutorizar, { method: 'POST', headers: { origin: 'http://localhost' } }))
    expect(autorizado.status).toBe(303)
    const location = autorizado.headers.get('location')
    expect(location).toBeTruthy()
    const destino = new URL(location!)
    expect(destino.origin + destino.pathname).toBe(CALLBACK)
    expect(destino.searchParams.get('state')).toBe(state)
    const codigo = destino.searchParams.get('code')
    expect(codigo).toBeTruthy()

    // Canje del código: form-urlencoded, como manda RFC 6749.
    const cuerpoCanje = new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo!,
      redirect_uri: CALLBACK,
      client_id: cliente.client_id,
      code_verifier: verifier,
    }).toString()

    const primerCanje = await tokenPOST(req('http://localhost/api/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: cuerpoCanje,
    }))
    expect(primerCanje.status).toBe(200)
    const tokens = await primerCanje.json()
    expect(typeof tokens.access_token).toBe('string')
    expect(typeof tokens.refresh_token).toBe('string')
    expect(tokens.expires_in).toBe(3600)
    expect(tokens.token_type).toBe('Bearer')

    // El mismo código no se puede volver a canjear.
    const segundoCanje = await tokenPOST(req('http://localhost/api/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: cuerpoCanje,
    }))
    expect(segundoCanje.status).toBe(400)
    const errorBody = await segundoCanje.json()
    expect(errorBody.error).toBe('invalid_grant')
  })
})
