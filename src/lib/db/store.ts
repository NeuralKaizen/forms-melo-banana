import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { sessions, answers, projects, deliverables, landscapeStages, landscapeVersions } from './schema'
import type { StageKey, StageStatus, TendenciaCandidata } from '@/lib/landscape/stages'
import { MIN_TENDENCIAS, MAX_TENDENCIAS, STAGE_ORDER } from '@/lib/landscape/stages'

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

/** Igual que listProjects, más lo mínimo para saber en qué fase está cada proyecto. */
export async function listProjectsWithCounts(db: AnyDb) {
  const rows = await db.select({
    id: projects.id,
    name: projects.name,
    createdAt: projects.createdAt,
    sessionsTotal: sql<number>`count(${sessions.id})`,
    sessionsCompleted: sql<number>`count(*) filter (where ${sessions.status} = 'completed')`,
    tieneEntregable: sql<boolean>`bool_or(${deliverables.projectId} is not null)`,
    ultimaSesion: sql<string | null>`max(coalesce(${sessions.completedAt}, ${sessions.createdAt}))`,
    ultimoEntregable: sql<string | null>`max(${deliverables.updatedAt})`,
  })
    .from(projects)
    .leftJoin(sessions, eq(sessions.projectId, projects.id))
    .leftJoin(deliverables, eq(deliverables.projectId, projects.id))
    .groupBy(projects.id, projects.name, projects.createdAt)
    .orderBy(asc(projects.name))

  // pg devuelve los count como string según el driver.
  return (rows as Record<string, unknown>[]).map(r => {
    const fechas = [r.ultimaSesion, r.ultimoEntregable, r.createdAt]
      .filter(Boolean)
      .map(d => new Date(d as string | Date).getTime())

    return {
      id: String(r.id),
      name: String(r.name),
      sessionsTotal: Number(r.sessionsTotal ?? 0),
      sessionsCompleted: Number(r.sessionsCompleted ?? 0),
      tieneEntregable: Boolean(r.tieneEntregable),
      /** Lo último que se movió en el proyecto, de donde sea que haya venido. */
      ultimaActividad: fechas.length ? new Date(Math.max(...fechas)) : null,
    }
  })
}

/** Cuántas respuestas tiene cada entrevista del proyecto, por sessionId. */
export async function answerCountsByProject(db: AnyDb, projectId: string) {
  const rows = await db.select({
    sessionId: answers.sessionId,
    total: sql<number>`count(*)`,
  })
    .from(answers)
    .innerJoin(sessions, eq(sessions.id, answers.sessionId))
    .where(eq(sessions.projectId, projectId))
    .groupBy(answers.sessionId)

  const out: Record<string, number> = {}
  for (const r of rows as { sessionId: string; total: number | string }[]) {
    out[r.sessionId] = Number(r.total ?? 0)
  }
  return out
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

// ── Landscape (fase 2) ──────────────────────────────────────────────────────
// Ver docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md

export type LandscapeVersionRow = typeof landscapeVersions.$inferSelect

export async function setStageStatus(db: AnyDb, projectId: string, stage: StageKey, status: StageStatus) {
  await db.insert(landscapeStages)
    .values({ projectId, stage, status })
    .onConflictDoUpdate({
      target: [landscapeStages.projectId, landscapeStages.stage],
      set: { status, updatedAt: new Date() },
    })
}

/**
 * Escribe una versión nueva. Siempre borrador: aprobar es un acto humano aparte.
 * La etapa arranca a moverse con la primera versión, pero una etapa ya aprobada
 * o marcada como no aplica no se degrada sola.
 */
export async function saveLandscapeVersion(db: AnyDb, projectId: string, stage: StageKey, v: {
  content: unknown; author: 'claude' | 'humano'; authorLabel?: string
}): Promise<LandscapeVersionRow> {
  const [row] = await db.insert(landscapeVersions)
    .values({
      projectId, stage,
      content: v.content,
      author: v.author,
      authorLabel: v.authorLabel ?? null,
    })
    .returning()

  await db.insert(landscapeStages)
    .values({ projectId, stage, status: 'en_curso' })
    .onConflictDoUpdate({
      target: [landscapeStages.projectId, landscapeStages.stage],
      set: {
        status: sql`case when ${landscapeStages.status} = 'pendiente' then 'en_curso' else ${landscapeStages.status} end`,
        updatedAt: new Date(),
      },
    })

  return row
}

/** Historial de una etapa, o del proyecto entero. La más nueva primero. */
export async function listLandscapeVersions(db: AnyDb, projectId: string, stage?: StageKey): Promise<LandscapeVersionRow[]> {
  const where = stage
    ? and(eq(landscapeVersions.projectId, projectId), eq(landscapeVersions.stage, stage))
    : eq(landscapeVersions.projectId, projectId)
  return db.select().from(landscapeVersions).where(where).orderBy(desc(landscapeVersions.createdAt))
}

/**
 * Sella una versión como aprobada y cierra la etapa. Único punto donde una etapa
 * pasa a 'aprobada'. Claude nunca llega acá: aprobar es humano y vive en el panel.
 */
export async function approveLandscapeVersion(db: AnyDb, versionId: string): Promise<LandscapeVersionRow> {
  const [row] = await db.update(landscapeVersions)
    .set({ approvedAt: new Date() })
    .where(eq(landscapeVersions.id, versionId))
    .returning()
  if (!row) throw new Error(`No existe la versión ${versionId}`)
  await setStageStatus(db, row.projectId, row.stage as StageKey, 'aprobada')
  return row
}

/** Lo que hay que mostrar de una etapa: la aprobada manda; si no, el último borrador. */
export async function getCurrentVersion(db: AnyDb, projectId: string, stage: StageKey): Promise<LandscapeVersionRow | null> {
  const rows = await listLandscapeVersions(db, projectId, stage)
  return rows.find(r => r.approvedAt) ?? rows[0] ?? null
}

/** El `content` de la etapa `tendencias`: la long list, y la selección cuando ya se decidió. */
export interface TendenciasContent {
  candidatas: TendenciaCandidata[]
  seleccionadas?: string[]
}

/**
 * El gate humano del proceso: de la long list salen 4 o 5, y las elige el equipo.
 * Guardar y aprobar son un solo acto porque la selección *es* la decisión.
 */
export async function selectTendencias(
  db: AnyDb, projectId: string, seleccionadas: string[], authorLabel?: string,
): Promise<LandscapeVersionRow> {
  const actual = await getCurrentVersion(db, projectId, 'tendencias')
  const candidatas = (actual?.content as TendenciasContent | undefined)?.candidatas
  if (!candidatas?.length) throw new Error('No hay long list de tendencias guardada para este proyecto')

  // Antes de contar cuántas son: si hay repetidas, el largo crudo miente sobre cuántas
  // tendencias distintas se eligieron en verdad.
  const repetidas = [...new Set(seleccionadas.filter((id, i) => seleccionadas.indexOf(id) !== i))]
  if (repetidas.length) throw new Error(`Estas tendencias están repetidas en la selección: ${repetidas.join(', ')}`)

  if (seleccionadas.length < MIN_TENDENCIAS || seleccionadas.length > MAX_TENDENCIAS)
    throw new Error(`Hay que elegir entre ${MIN_TENDENCIAS} y ${MAX_TENDENCIAS} tendencias, llegaron ${seleccionadas.length}`)

  const conocidas = new Set(candidatas.map(c => c.id))
  const intrusas = seleccionadas.filter(id => !conocidas.has(id))
  if (intrusas.length) throw new Error(`Estas tendencias no están en la long list: ${intrusas.join(', ')}`)

  const version = await saveLandscapeVersion(db, projectId, 'tendencias', {
    content: { candidatas, seleccionadas } satisfies TendenciasContent,
    author: 'humano',
    authorLabel,
  })
  return approveLandscapeVersion(db, version.id)
}

export interface StageState {
  stage: StageKey
  status: StageStatus
  versiones: number
  actual: LandscapeVersionRow | null
  aprobada: boolean
}

/** El estado completo del landscape de un proyecto. Siempre las seis etapas. */
export async function landscapeState(db: AnyDb, projectId: string): Promise<StageState[]> {
  const filas = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, projectId))
  const versiones = await listLandscapeVersions(db, projectId)

  const estadoPorEtapa = new Map<string, StageStatus>(
    (filas as { stage: string; status: string }[]).map(f => [f.stage, f.status as StageStatus]),
  )

  return STAGE_ORDER.map(stage => {
    const deLaEtapa = versiones.filter(v => v.stage === stage)
    const actual = deLaEtapa.find(v => v.approvedAt) ?? deLaEtapa[0] ?? null
    const status = estadoPorEtapa.get(stage) ?? 'pendiente'
    return { stage, status, versiones: deLaEtapa.length, actual, aprobada: status === 'aprobada' }
  })
}

export interface ActivityEntry {
  id: string
  tipo: 'guardado' | 'aprobado'
  stage: StageKey
  autor: 'claude' | 'humano'
  quien?: string
  cuando: Date
}

/**
 * La actividad no tiene tabla propia: se deriva de las versiones. Cada versión es
 * un guardado, y cada versión sellada es además una aprobación. Aprobar siempre es
 * humano, así que esas entradas van con autor 'humano'. La tabla no guarda quién
 * aprobó (solo quién guardó el borrador), así que las entradas 'aprobado' van sin
 * `quien` — el panel cae a "Equipo" en vez de atribuirle la aprobación a quien
 * escribió el borrador.
 */
export async function listLandscapeActivity(db: AnyDb, projectId: string, limit = 8): Promise<ActivityEntry[]> {
  const versiones = await listLandscapeVersions(db, projectId)
  const entradas: ActivityEntry[] = []

  for (const v of versiones) {
    entradas.push({
      id: `${v.id}:guardado`,
      tipo: 'guardado',
      stage: v.stage as StageKey,
      autor: v.author as 'claude' | 'humano',
      quien: v.authorLabel ?? undefined,
      cuando: new Date(v.createdAt),
    })
    if (v.approvedAt) {
      entradas.push({
        id: `${v.id}:aprobado`,
        tipo: 'aprobado',
        stage: v.stage as StageKey,
        autor: 'humano',
        cuando: new Date(v.approvedAt),
      })
    }
  }

  return entradas.sort((a, b) => b.cuando.getTime() - a.cuando.getTime()).slice(0, limit)
}
