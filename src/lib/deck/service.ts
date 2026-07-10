import { db } from '@/lib/db/client'
import { getProjectWithSessions, getSessionWithAnswers, getDeliverable } from '@/lib/db/store'
import type { Deliverable } from '@/lib/deliverable/schema'
import { buildDeckView, type DeckView } from './view-model'

export async function buildProjectDeckView(projectId: string): Promise<DeckView | null> {
  const project = await getProjectWithSessions(db, projectId)
  if (!project) return null

  const saved = await getDeliverable(db, projectId)
  if (!saved) return null

  const sessions = project.sessions as { id: string }[]
  const corpus: string[] = []
  for (const sesion of sessions) {
    const full = await getSessionWithAnswers(db, sesion.id)
    if (!full) continue
    for (const a of full.answers as { rawText: string; normalizedText?: string | null }[]) {
      if (a.rawText) corpus.push(a.rawText)
      if (a.normalizedText) corpus.push(a.normalizedText)
    }
  }

  return buildDeckView({
    projectName: project.name,
    deliverable: saved.content as Deliverable,
    corpus,
    now: new Date(),
  })
}
