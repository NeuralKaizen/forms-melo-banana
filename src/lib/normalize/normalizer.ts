const SYSTEM = [
  'Recibís una transcripción de voz a texto en español.',
  'Tu única tarea es hacerla más legible: agregá puntuación y mayúsculas correctas,',
  'y corregí errores obvios de transcripción (homófonos, palabras mal separadas o pegadas).',
  'NO cambies el significado, NO agregues ni quites información, NO reformules ni resumas, NO traduzcas.',
  'Si el texto ya está bien, devolvelo igual.',
  'Devolvé SOLO el texto corregido, sin comillas ni comentarios.',
].join(' ')

// Best-effort: devuelve el texto normalizado, o null si no se pudo (sin key / error).
export async function normalizeText(
  text: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  try {
    const res = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'Melo & Banana',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const out = data?.choices?.[0]?.message?.content
    return typeof out === 'string' && out.trim() ? out.trim() : null
  } catch {
    return null
  }
}
