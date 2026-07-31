import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const REFRESH = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
const FOLDER = process.env.GOOGLE_DRIVE_FOLDER_ID

async function accessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH)
    throw new Error(
      'Faltan credenciales. Poné GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_OAUTH_REFRESH_TOKEN en .env\n' +
        '(el refresh token se genera una sola vez con: npm run auth:drive)',
    )
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh ${res.status}: ${await res.text()}`)
  return (await res.json()).access_token
}

async function whoami(token: string) {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Google auth ${res.status}: ${await res.text()}`)
  const { user } = await res.json()
  return `${user.displayName} <${user.emailAddress}>`
}

async function checkFolder(token: string, folderId: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  if (res.status === 404)
    throw new Error(
      `No veo la carpeta ${folderId}. Pedile al cliente que la comparta con tu cuenta como Editor.`,
    )
  if (!res.ok) throw new Error(`Google Drive ${res.status}: ${await res.text()}`)
  const meta = await res.json()
  if (meta.mimeType !== 'application/vnd.google-apps.folder')
    throw new Error(`${folderId} existe pero no es una carpeta (${meta.mimeType}).`)
  return meta.name as string
}

// Subida "resumable" en dos pasos: banca cualquier tamaño sin trocear a mano
// (la subida multipart simple de Drive corta en 5 MB).
async function upload(token: string, file: string, folderId: string) {
  const size = (await stat(file)).size
  const init = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: basename(file), parents: [folderId] }),
    },
  )
  if (!init.ok) throw new Error(`Drive upload init ${init.status}: ${await init.text()}`)
  const session = init.headers.get('location')
  if (!session) throw new Error('Drive no devolvió la URL de sesión de subida.')

  // Drive admite nombres repetidos: una nueva subida nunca pisa un entregable anterior.
  const res = await fetch(session, {
    method: 'PUT',
    headers: { 'content-length': String(size) },
    body: await readFile(file),
  })
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const files = args.filter((a) => !a.startsWith('--'))

  if (!check && files.length === 0) {
    console.error('Uso: npm run upload:drive -- <archivo…>')
    console.error('     npm run upload:drive -- --check    (valida credenciales y carpeta, no sube nada)')
    process.exit(1)
  }
  if (!FOLDER) throw new Error('Falta GOOGLE_DRIVE_FOLDER_ID en .env (el ID que aparece en la URL de la carpeta)')

  const token = await accessToken()
  console.log(`Autenticado como ${await whoami(token)}`)
  const folderName = await checkFolder(token, FOLDER)
  if (check) {
    console.log(`Destino: "${folderName}" (${FOLDER}) — credenciales OK, listo para subir.`)
    return
  }

  for (const file of files) {
    process.stdout.write(`→ ${folderName}/${basename(file)}… `)
    const r = await upload(token, file, FOLDER)
    console.log(`ok (https://drive.google.com/file/d/${r.id})`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
