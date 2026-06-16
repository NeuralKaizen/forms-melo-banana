/**
 * Baja fotos para el ejercicio proyectivo desde Wikimedia Commons (sin API key).
 * Descarga thumbnails a tmp/projective-raw/<cat>/<id>.jpg y guarda créditos en
 * tmp/projective-credits.json. NO toca public/ (eso lo hace el paso de recorte).
 *
 *   npx tsx scripts/fetch-projective-images.ts            # baja todo
 *   npx tsx scripts/fetch-projective-images.ts ciudad     # solo una categoría
 *   npx tsx scripts/fetch-projective-images.ts ciudad/ny  # solo un item
 *
 * Overrides puntuales en tmp/overrides.json:
 *   { "ciudad/ny": "Manhattan skyline sunset",        // re-buscar con otra query
 *     "animal/leon": "File:Lion waiting in Namibia.jpg" } // forzar un archivo exacto
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const API = 'https://commons.wikimedia.org/w/api.php'
const WIDTH = 900

// Query curada por item. La idea: imágenes icónicas, limpias y aspiracionales.
const QUERIES: Record<string, Record<string, string>> = {
  animal: {
    conejo: 'cute european rabbit',
    caballo: 'brown horse portrait',
    leon: 'male lion mane',
    delfin: 'bottlenose dolphin ocean',
    aguila: 'bald eagle head',
    iguana: 'green iguana',
    perro: 'golden retriever dog',
    gato: 'domestic cat portrait',
    flamenco: 'flamingo bird',
  },
  olor: {
    cerezo: 'cherry blossom pink flowers',
    pina: 'pineapple fruit',
    cesped: 'green lawn grass field',
    rio: 'river landscape forest',
    caramelos: 'colorful candy sweets',
    madera: 'wooden planks texture',
    hierba: 'fresh basil herbs',
    naranjas: 'fresh oranges fruit',
    rosas: 'red roses bouquet',
  },
  ciudad: {
    bali: 'Bali rice terraces temple',
    ny: 'Manhattan skyline New York',
    barcelona: 'Sagrada Familia Barcelona',
    delhi: 'India Gate New Delhi',
    lasvegas: 'Las Vegas Strip night',
    berlin: 'Brandenburg Gate Berlin',
    paris: 'Eiffel Tower Paris',
    dubai: 'Dubai skyline Burj Khalifa',
    marrakech: 'Marrakech medina Koutoubia',
  },
  // edad-hombre / edad-mujer NO se bajan de Commons: son tiles tipográficos
  // generados con ImageMagick (ver README de assets) por falta de retratos limpios.
}

type Credit = { cat: string; id: string; query: string; title: string; artist: string; license: string; descUrl: string }

function stripHtml(s = '') {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

const UA = 'melo-banana-demo/1.0 (projective images; contact neuralkaizen@gmail.com)'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** GET con reintentos: Commons devuelve HTML de error ("You are making too many requests") al rate-limitear. */
async function getJSON(url: string, tries = 5): Promise<any> {
  for (let i = 0; i < tries; i++) {
    await sleep(400 + i * 600) // throttle + backoff
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const text = await res.text()
    try { return JSON.parse(text) } catch { /* HTML de error → reintentar */ }
  }
  throw new Error(`sin JSON tras ${tries} intentos: ${url}`)
}

async function searchThumb(query: string) {
  const url = `${API}?${new URLSearchParams({
    action: 'query', format: 'json', generator: 'search',
    gsrsearch: query, gsrnamespace: '6', gsrlimit: '12',
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: String(WIDTH),
    iiextmetadatafilter: 'Artist|LicenseShortName|Credit',
  })}`
  const json: any = await getJSON(url)
  const pages: any[] = Object.values(json?.query?.pages ?? {})
  // ordenar por el índice de búsqueda; quedarnos con jpeg/png de buen tamaño
  pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    if (!ii) continue
    if (!/image\/(jpeg|png)/.test(ii.mime ?? '')) continue
    if ((ii.width ?? 0) < 600 || (ii.height ?? 0) < 600) continue
    const md = ii.extmetadata ?? {}
    return {
      title: p.title as string,
      thumb: ii.thumburl as string,
      artist: stripHtml(md.Artist?.value) || 'desconocido',
      license: stripHtml(md.LicenseShortName?.value) || '—',
      descUrl: ii.descriptionurl as string,
    }
  }
  return null
}

async function forceFile(title: string) {
  const url = `${API}?${new URLSearchParams({
    action: 'query', format: 'json', titles: title,
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: String(WIDTH),
    iiextmetadatafilter: 'Artist|LicenseShortName',
  })}`
  const json: any = await getJSON(url)
  const p: any = Object.values(json?.query?.pages ?? {})[0]
  const ii = p?.imageinfo?.[0]
  if (!ii) return null
  const md = ii.extmetadata ?? {}
  return {
    title: p.title as string, thumb: ii.thumburl as string,
    artist: stripHtml(md.Artist?.value) || 'desconocido',
    license: stripHtml(md.LicenseShortName?.value) || '—',
    descUrl: ii.descriptionurl as string,
  }
}

async function main() {
  const filter = process.argv[2] // "ciudad" o "ciudad/ny"
  let overrides: Record<string, string> = {}
  try { overrides = JSON.parse(await readFile(resolve('tmp/overrides.json'), 'utf8')) } catch {}

  const credits: Credit[] = []
  for (const [cat, items] of Object.entries(QUERIES)) {
    for (const [id, baseQuery] of Object.entries(items)) {
      const key = `${cat}/${id}`
      if (filter && key !== filter && cat !== filter) continue

      const override = overrides[key]
      const query = override && !override.startsWith('File:') ? override : baseQuery
      let hit = override?.startsWith('File:') ? await forceFile(override) : await searchThumb(query)
      if (!hit) { console.log(`✗ ${key}  (sin resultado para "${query}")`); continue }

      const dir = resolve('tmp/projective-raw', cat)
      await mkdir(dir, { recursive: true })
      await sleep(300)
      const buf = Buffer.from(await (await fetch(hit.thumb, { headers: { 'User-Agent': UA } })).arrayBuffer())
      await writeFile(resolve(dir, `${id}.jpg`), buf)
      credits.push({ cat, id, query, title: hit.title, artist: hit.artist, license: hit.license, descUrl: hit.descUrl })
      console.log(`✓ ${key}  ←  ${hit.title}  [${hit.license}]`)
    }
  }

  await mkdir(resolve('tmp'), { recursive: true })
  await writeFile(resolve('tmp/projective-credits.json'), JSON.stringify(credits, null, 2))
  console.log(`\n${credits.length} imágenes en tmp/projective-raw/. Créditos en tmp/projective-credits.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
