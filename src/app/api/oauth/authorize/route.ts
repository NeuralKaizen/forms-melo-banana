import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { oauthClients } from '@/lib/db/schema'
import { isValidAdminToken } from '@/lib/admin/auth'
import { crearCodigo } from '@/lib/oauth/store'

interface Pedido {
  clientId: string; redirectUri: string; state: string
  codeChallenge: string; scope: string
}

// Lo único que esta app sabe otorgar. Si mañana se suma un scope nuevo, se agrega acá
// y en `scopes_supported` de metadata.ts — las dos listas tienen que coincidir.
const SCOPES_PERMITIDOS = ['landscape']

/**
 * Lee y valida el pedido. El redirect_uri se compara contra los registrados *antes*
 * de redirigir a ningún lado: sin eso, cualquiera podría llevarse el código a un
 * dominio propio pasando su URL por query string.
 */
async function leerPedido(url: URL): Promise<Pedido | { error: string }> {
  const clientId = url.searchParams.get('client_id') ?? ''
  const redirectUri = url.searchParams.get('redirect_uri') ?? ''
  const codeChallenge = url.searchParams.get('code_challenge') ?? ''
  const metodo = url.searchParams.get('code_challenge_method') ?? ''

  if (!clientId || !redirectUri) return { error: 'Faltan client_id o redirect_uri' }
  if (metodo !== 'S256') return { error: 'Solo se admite code_challenge_method=S256' }
  if (!codeChallenge) return { error: 'Falta code_challenge' }

  const [cliente] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId))
  // Un solo mensaje para “no existe” y “existe pero el redirect_uri no es suyo”:
  // distinguirlos es un oráculo que deja probar client_id a ciegas sin autenticarse —
  // el mismo motivo por el que `canjearCodigo` en store.ts unifica sus rechazos.
  const clienteORedirectInvalidos = { error: 'El client_id o el redirect_uri no son válidos' }
  if (!cliente) return clienteORedirectInvalidos
  if (!(cliente.redirectUris as string[]).includes(redirectUri))
    return clienteORedirectInvalidos

  // El scope pedido se filtra contra lo permitido y se queda con la intersección — no
  // se rechaza el pedido entero por pedir de más. Lo que importa es que lo que se
  // otorga sea siempre lo que la pantalla de consentimiento describe.
  const pedidos = (url.searchParams.get('scope') ?? '').split(' ').filter(Boolean)
  const otorgados = pedidos.filter(s => SCOPES_PERMITIDOS.includes(s))

  return {
    clientId, redirectUri, codeChallenge,
    state: url.searchParams.get('state') ?? '',
    scope: otorgados.length ? otorgados.join(' ') : 'landscape',
  }
}

function pantalla(url: URL): Response {
  // La app no tiene identidad de usuario: quien pasó el login del panel es quien
  // consiente. Por eso alcanza con un botón.
  const html = `<!doctype html><html lang="es"><meta charset="utf-8">
<title>Conectar con Claude</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 32rem;
         margin: 6rem auto; padding: 0 1.5rem; line-height: 1.6; color: #1a1a1a }
  h1 { font-size: 1.35rem; margin-bottom: .5rem }
  p { color: #555 }
  ul { color: #555 }
  button { font: inherit; padding: .7rem 1.4rem; border: 0; border-radius: .5rem;
           background: #1a1a1a; color: #fff; cursor: pointer; margin-top: 1.5rem }
</style>
<h1>Conectar Claude con la plataforma</h1>
<p>Claude va a poder:</p>
<ul>
  <li>leer los proyectos, las entrevistas y el estado del landscape;</li>
  <li>escribir <strong>borradores</strong> de etapas.</li>
</ul>
<p>No va a poder aprobar nada — aprobar sigue siendo un acto humano, desde el panel.</p>
<form method="post"><button type="submit">Conectar</button></form>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const pedido = await leerPedido(url)
  if ('error' in pedido) return NextResponse.json({ error: pedido.error }, { status: 400 })

  const cookie = (await cookies()).get('admin')?.value
  if (!isValidAdminToken(cookie)) {
    // Sin sesión: al login de siempre, y de vuelta acá con los mismos parámetros.
    const destino = new URL('/admin/login', url.origin)
    destino.searchParams.set('next', url.pathname + url.search)
    return NextResponse.redirect(destino)
  }
  return pantalla(url)
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const pedido = await leerPedido(url)
  if ('error' in pedido) return NextResponse.json({ error: pedido.error }, { status: 400 })

  const cookie = (await cookies()).get('admin')?.value
  if (!isValidAdminToken(cookie)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const codigo = await crearCodigo(db, {
    clientId: pedido.clientId,
    redirectUri: pedido.redirectUri,
    codeChallenge: pedido.codeChallenge,
    scope: pedido.scope,
  })

  const destino = new URL(pedido.redirectUri)
  destino.searchParams.set('code', codigo)
  if (pedido.state) destino.searchParams.set('state', pedido.state)
  return NextResponse.redirect(destino, { status: 303 })
}
