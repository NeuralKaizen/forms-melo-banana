import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'

const KEY = process.env.DROPBOX_APP_KEY
const SECRET = process.env.DROPBOX_APP_SECRET
const REFRESH = process.env.DROPBOX_REFRESH_TOKEN
const TOKEN = process.env.DROPBOX_ACCESS_TOKEN
const DEST = process.env.DROPBOX_DEST_FOLDER

// Dropbox caps files/upload at 150 MB; bigger needs the chunked session API.
const MAX_BYTES = 150 * 1024 * 1024

async function accessToken(): Promise<string> {
  if (KEY && SECRET && REFRESH) {
    const res = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${KEY}:${SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: REFRESH }),
    })
    if (!res.ok) throw new Error(`Dropbox token refresh ${res.status}: ${await res.text()}`)
    return (await res.json()).access_token
  }
  if (TOKEN) return TOKEN
  throw new Error(
    'Faltan credenciales. Poné DROPBOX_APP_KEY + DROPBOX_APP_SECRET + DROPBOX_REFRESH_TOKEN en .env\n' +
      '(o, para una prueba puntual, DROPBOX_ACCESS_TOKEN — expira a las ~4 h).',
  )
}

async function whoami(token: string) {
  const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Dropbox auth ${res.status}: ${await res.text()}`)
  const me = await res.json()
  return `${me.name.display_name} <${me.email}>`
}

async function upload(token: string, file: string, dest: string) {
  const size = (await stat(file)).size
  if (size > MAX_BYTES)
    throw new Error(`${file} pesa ${(size / 1e6).toFixed(1)} MB; el tope de este endpoint es 150 MB.`)

  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: dest,
        mode: 'add',
        autorename: true, // nunca pisa un entregable anterior
        mute: false,
      }),
    },
    body: await readFile(file),
  })
  if (!res.ok) throw new Error(`Dropbox upload ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const files = args.filter((a) => !a.startsWith('--'))

  if (!check && files.length === 0) {
    console.error('Uso: npm run upload:dropbox -- <archivo…>')
    console.error('     npm run upload:dropbox -- --check    (valida credenciales, no sube nada)')
    process.exit(1)
  }
  if (!DEST) throw new Error('Falta DROPBOX_DEST_FOLDER en .env (ej: /Entregables/Lucianos)')

  const token = await accessToken()
  console.log(`Autenticado como ${await whoami(token)}`)
  if (check) {
    console.log(`Destino: ${DEST}  — credenciales OK, listo para subir.`)
    return
  }

  for (const file of files) {
    const dest = `${DEST.replace(/\/$/, '')}/${basename(file)}`
    process.stdout.write(`→ ${dest}… `)
    const r = await upload(token, file, dest)
    console.log(`ok (${r.path_display})`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
