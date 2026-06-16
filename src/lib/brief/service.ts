import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/client'
import { getSessionWithAnswers, saveBrief } from '@/lib/db/store'
import { ensureNormalized } from '@/lib/normalize/service'
import { generateBrief } from './generator'

export async function generateAndSaveBrief(sessionId: string) {
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) throw new Error('session not found')
  await ensureNormalized(db, sessionId)
  const refreshed = await getSessionWithAnswers(db, sessionId)
  // Routed through OpenRouter's Anthropic-compatible endpoint (Bearer auth, not x-api-key).
  const client = new Anthropic({
    authToken: process.env.OPENROUTER_API_KEY!,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: { 'X-Title': 'Melo & Banana' },
  })
  const brief = await generateBrief(client, refreshed!,
    refreshed!.answers.map((a: { questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }) =>
      ({ questionId: a.questionId, rawText: a.rawText, normalizedText: a.normalizedText, imageChoice: a.imageChoice })))
  await saveBrief(db, sessionId, brief)
  return brief
}
