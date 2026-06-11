import { writeFile, mkdir } from 'node:fs/promises'
import { SCRIPT } from '../src/lib/script/questions'

const API = 'https://api.elevenlabs.io/v1/text-to-speech'
const KEY = process.env.ELEVENLABS_API_KEY!
const VOICE = process.env.ELEVENLABS_VOICE_ID!

async function tts(text: string): Promise<Buffer> {
  const res = await fetch(`${API}/${VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`)
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  await mkdir('public/audio', { recursive: true })
  for (const section of SCRIPT) {
    for (const q of section.questions) {
      const out = `public${q.audio}` // q.audio is /audio/<id>.mp3
      process.stdout.write(`→ ${q.id}… `)
      await writeFile(out, await tts(q.prompt))
      console.log('ok')
    }
  }
  console.log('Done. Audios in public/audio/')
}
main().catch((e) => { console.error(e); process.exit(1) })
