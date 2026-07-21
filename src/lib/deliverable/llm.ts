import type Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'anthropic/claude-sonnet-4.6'

function extractJson(text: string): unknown {
  const start = text.indexOf('{'); const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON en la respuesta')
  return JSON.parse(text.slice(start, end + 1))
}

export async function callJson<T>(
  client: Anthropic,
  prompt: string,
  maxTokens: number,
  validate: (o: unknown) => T,
): Promise<T> {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [{ role: 'user', content: prompt }]
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({ model: MODEL, max_tokens: maxTokens, messages })
    // Truncado por límite de tokens: el JSON queda cortado a la mitad. Reintentar con el
    // mismo tope volvería a truncar, así que fallamos claro en vez de tirar un SyntaxError.
    if (res.stop_reason === 'max_tokens')
      throw new Error(`salida truncada por max_tokens (${maxTokens}); subí max_tokens para este paso`)
    const text = res.content.map((b: any) => (b.type === 'text' ? b.text : '')).join('')
    try {
      return validate(extractJson(text))
    } catch (e) {
      if (attempt === 1) throw new Error(`respuesta inválida tras reintento: ${String(e)}`)
      messages.push({ role: 'assistant', content: text })
      messages.push({ role: 'user', content: 'Esa respuesta no era JSON válido con la forma pedida. Devolvé SOLO el JSON, sin texto alrededor.' })
    }
  }
  throw new Error('unreachable')
}
