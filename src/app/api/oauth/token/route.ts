import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { ErrorOAuth, canjearCodigo, emitirTokens, rotarRefresh } from '@/lib/oauth/store'

// RFC 6749: form-urlencoded, no JSON. Con el parser de JSON esto devuelve 415 y el
// flujo muere sin explicación del lado del cliente.
export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text())
  const grant = form.get('grant_type')
  const clientId = form.get('client_id') ?? ''

  try {
    if (grant === 'authorization_code') {
      const { scope } = await canjearCodigo(db, form.get('code') ?? '', {
        clientId,
        redirectUri: form.get('redirect_uri') ?? '',
        codeVerifier: form.get('code_verifier') ?? '',
      })
      const t = await emitirTokens(db, { clientId, scope })
      return NextResponse.json({
        access_token: t.accessToken,
        refresh_token: t.refreshToken,
        token_type: 'Bearer',
        expires_in: t.expiresIn,
        scope,
      }, { headers: { 'cache-control': 'no-store' } })
    }

    if (grant === 'refresh_token') {
      const t = await rotarRefresh(db, form.get('refresh_token') ?? '', { clientId })
      return NextResponse.json({
        access_token: t.accessToken,
        refresh_token: t.refreshToken,
        token_type: 'Bearer',
        expires_in: t.expiresIn,
        scope: t.scope,
      }, { headers: { 'cache-control': 'no-store' } })
    }

    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 })
  } catch (e) {
    // El código RFC importa: Claude reintenta el flujo completo ante `invalid_grant`,
    // y se queda trabado ante cualquier otra cosa.
    if (e instanceof ErrorOAuth)
      return NextResponse.json({ error: e.codigo, error_description: e.message }, { status: 400 })
    throw e
  }
}
