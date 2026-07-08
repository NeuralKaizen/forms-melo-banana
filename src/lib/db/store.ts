import { eq, asc } from 'drizzle-orm'
import { sessions, answers, projects, deliverables } from './schema'

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

export async function listCompleted(db: AnyDb) {
  return db.select().from(sessions).where(eq(sessions.status, 'completed')).orderBy(asc(sessions.completedAt))
}

export function normalizeCompanyName(name: string): string {
  return (name ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function findOrCreateProject(db: AnyDb, name: string) {
  const normalizedName = normalizeCompanyName(name)
  const [existing] = await db.select().from(projects).where(eq(projects.normalizedName, normalizedName))
  if (existing) return existing
  const [row] = await db.insert(projects)
    .values({ name: name.trim(), normalizedName })
    .onConflictDoNothing({ target: projects.normalizedName })
    .returning()
  if (row) return row
  const [after] = await db.select().from(projects).where(eq(projects.normalizedName, normalizedName))
  return after
}

export async function assignSessionToProject(db: AnyDb, sessionId: string, projectId: string) {
  await db.update(sessions).set({ projectId }).where(eq(sessions.id, sessionId))
}

export async function listProjects(db: AnyDb) {
  return db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name))
}

export async function getProjectWithSessions(db: AnyDb, projectId: string) {
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId))
  if (!p) return null
  const ss = await db.select().from(sessions)
    .where(eq(sessions.projectId, projectId)).orderBy(asc(sessions.createdAt))
  return { ...p, sessions: ss }
}

export async function saveDeliverable(db: AnyDb, projectId: string, content: unknown) {
  await db.insert(deliverables).values({ projectId, content })
    .onConflictDoUpdate({ target: deliverables.projectId, set: { content, updatedAt: new Date() } })
}

export async function getDeliverable(db: AnyDb, projectId: string) {
  const [d] = await db.select().from(deliverables).where(eq(deliverables.projectId, projectId))
  return d ?? null
}
