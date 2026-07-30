import { createServer } from 'node:http'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const PORT = 53682

// Alcance "drive" completo: "drive.file" solo deja escribir en carpetas creadas
// por la propia app, y acá el destino es una carpeta ajena compartida.
const SCOPE = 'https://www.googleapis.com/auth/drive'

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET)
    throw new Error(
      'Faltan GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en .env.\n' +
        'Se crean en Google Cloud Console → APIs & Services → Credentials → OAuth client ID (tipo "Desktop app"),\n' +
        'con la Drive API habilitada en ese proyecto.',
    )

  const redirect = `http://localhost:${PORT}`
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirect,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent', // fuerza a que Google devuelva refresh_token aunque ya hayas autorizado antes
    })

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', redirect)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(code ? 'Listo, ya podés cerrar esta pestaña.' : `Error: ${error}`)
      server.close()
      if (code) resolve(code)
      else reject(new Error(`Google devolvió: ${error}`))
    })
    server.listen(PORT, () => {
      console.log('Abrí esta URL en el navegador y autorizá con TU cuenta de Google')
      console.log('(la que tiene acceso de Editor a la carpeta del cliente):\n')
      console.log(authUrl + '\n')
    })
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange ${res.status}: ${await res.text()}`)
  const tokens = await res.json()
  if (!tokens.refresh_token)
    throw new Error('Google no devolvió refresh_token. Reintentá: el prompt=consent debería forzarlo.')

  console.log('Agregá esta línea a tu .env:\n')
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`)
  console.log('Después verificá con: npm run upload:drive -- --check')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
