import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/client'
import { getSessionWithAnswers, saveBrief } from '@/lib/db/store'
import { generateBrief } from './generator'

export async function generateAndSaveBrief(sessionId: string) {
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) throw new Error('session not found')
  // Routed through OpenRouter's Anthropic-compatible endpoint (Bearer auth, not x-api-key).
  const client = new Anthropic({
    authToken: process.env.OPENROUTER_API_KEY!,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: { 'X-Title': 'Melo & Banana' },
  })
  const brief = await generateBrief(client, full,
    full.answers.map((a: { questionId: string; rawText: string; imageChoice?: string | null }) =>
      ({ questionId: a.questionId, rawText: a.rawText, imageChoice: a.imageChoice })))
  await saveBrief(db, sessionId, brief)
  return brief
}
