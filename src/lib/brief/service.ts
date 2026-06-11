import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/client'
import { getSessionWithAnswers, saveBrief } from '@/lib/db/store'
import { generateBrief } from './generator'

export async function generateAndSaveBrief(sessionId: string) {
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) throw new Error('session not found')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const brief = await generateBrief(client, full,
    full.answers.map((a: { questionId: string; rawText: string; imageChoice?: string | null }) =>
      ({ questionId: a.questionId, rawText: a.rawText, imageChoice: a.imageChoice })))
  await saveBrief(db, sessionId, brief)
  return brief
}
