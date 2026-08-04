import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { ErrorOAuth, registrarCliente } from '@/lib/oauth/store'

// RFC 7591: el cuerpo del registro va en JSON. Ojo que el de /token va form-urlencoded.
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_client_metadata' }, { status: 400 })
  }

  const uris = body.redirect_uris
  if (!Array.isArray(uris) || uris.some(u => typeof u !== 'string'))
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 })

  try {
    const cliente = await registrarCliente(db, {
      redirectUris: uris as string[],
      name: typeof body.client_name === 'string' ? body.client_name : undefined,
    })
    return NextResponse.json({
      client_id: cliente.id,
      redirect_uris: cliente.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }, { status: 201 })
  } catch (e) {
    if (e instanceof ErrorOAuth)
      return NextResponse.json({ error: e.codigo, error_description: e.message }, { status: 400 })
    throw e
  }
}
