import { eq, asc } from 'drizzle-orm'
import { sessions, answers, briefs } from './schema'

type AnyDb = any // drizzle db (neon-http or pglite); kept loose for the adapter seam

export async function createSession(db: AnyDb, info: {
  name?: string; company?: string; role?: string; email?: string
}) {
  const [row] = await db.insert(sessions).values(info).returning()
  return row
}

export async function saveAnswer(db: AnyDb, sessionId: string, a: {
  questionId: string; rawText: string; imageChoice?: string
}) {
  // Upsert on (session_id, question_id) so revisiting/editing a question updates
  // the same row instead of creating a duplicate.
  const [row] = await db.insert(answers)
    .values({ sessionId, questionId: a.questionId, rawText: a.rawText, imageChoice: a.imageChoice ?? null })
    .onConflictDoUpdate({
      target: [answers.sessionId, answers.questionId],
      set: { rawText: a.rawText, imageChoice: a.imageChoice ?? null },
    })
    .returning()
  return row
}

export async function setNormalized(db: AnyDb, answerId: string, text: string) {
  await db.update(answers).set({ normalizedText: text }).where(eq(answers.id, answerId))
}

export async function getSessionWithAnswers(db: AnyDb, id: string) {
  const [s] = await db.select().from(sessions).where(eq(sessions.id, id))
  if (!s) return null
  const a = await db.select().from(answers).where(eq(answers.sessionId, id)).orderBy(asc(answers.createdAt))
  return { ...s, answers: a }
}

export async function completeSession(db: AnyDb, id: string) {
  const [row] = await db.update(sessions)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(sessions.id, id)).returning()
  return row
}

export async function saveBrief(db: AnyDb, sessionId: string, content: unknown) {
  await db.insert(briefs).values({ sessionId, content })
    .onConflictDoUpdate({ target: briefs.sessionId, set: { content, createdAt: new Date() } })
}

export async function listCompleted(db: AnyDb) {
  return db.select().from(sessions).where(eq(sessions.status, 'completed')).orderBy(asc(sessions.completedAt))
}

export async function getBrief(db: AnyDb, sessionId: string) {
  const [b] = await db.select().from(briefs).where(eq(briefs.sessionId, sessionId))
  return b ?? null
}
