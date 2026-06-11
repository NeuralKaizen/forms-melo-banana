import type Anthropic from '@anthropic-ai/sdk'
import { buildBriefPrompt } from './prompt'

export interface Brief {
  resumen: string
  secciones: { titulo: string; puntos: string[] }[]
  alertas: string[]
}

export async function generateBrief(
  client: Anthropic,
  session: { name?: string; company?: string },
  answers: { questionId: string; rawText: string; imageChoice: string | null }[],
): Promise<Brief> {
  const res = await client.messages.create({
    model: 'anthropic/claude-sonnet-4.6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildBriefPrompt(session, answers) }],
  })
  const text = res.content.map((b: any) => (b.type === 'text' ? b.text : '')).join('')
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(json) as Brief
}
