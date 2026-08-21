import { eq, ne, and, asc, desc, sql } from 'drizzle-orm'
import { sessions, answers, projects, deliverables, landscapeStages, landscapeVersions } from './schema'
import type { StageKey, StageStatus, TendenciaCandidata } from '@/lib/landscape/stages'
import { MIN_TENDENCIAS, MAX_TENDENCIAS, STAGE_ORDER } from '@/lib/landscape/stages'

export type AnyDb = any // drizzle db (neon-http or pglite); kept loose for the adapter seam

/**
 * Un rechazo que es culpa del pedido (datos inválidos), no del servidor: la ruta HTTP
 * la traduce a 400. Cualquier otra excepción (Postgres caído, un bug real) es un fallo
 * del servidor y se traduce a 500.
 */
export class ErrorDeValidacion extends Error {}

/**
 * El pedido apunta a un recurso que no existe (un proyecto borrado o que nunca existió):
 * la ruta HTTP la traduce a 404. No es "el pedido está mal formado" (eso es
 * `ErrorDeValidacion`, 400) ni "algo se rompió" (eso es cualquier otra excepción, 500).
 */
export class ErrorNoEncontrado extends Error {}

/** Código de Postgres para violación de foreign key (por ejemplo, un project_id que no existe). */
const CODIGO_FK_VIOLADA = '23503'

/**
 * `drizzle-orm` envuelve el error del driver en `DrizzleQueryError`; el código de Postgres
 * viaja en la excepción original, en `cause` (verificado a mano contra PGlite).
 */
export function esViolacionDeForeignKey(e: unknown): boolean {
  const causa = e instanceof Error ? (e as { cause?: unknown }).cause : undefined
  return Boolean(
    causa && typeof causa === 'object' && 'code' in causa && (causa as { code?: unknown }).code === CODIGO_FK_VIOLADA,
  )
}

/**
 * Chequeo de existencia liviano, solo para dar un 404 claro en vez de un mensaje que
 * despista (por ejemplo "no hay long list") cuando el proyecto directamente no existe.
 * No es la fuente de verdad de la escritura: si el proyecto se borra en la ventana entre
 * este chequeo y el insert final —una carrera muy improbable en un panel interno de uso
 * secuencial—, el catch de la violación de foreign key en `saveLandscapeVersion` sigue
 * atajando el caso. Ver la Ronda 3 en el reporte de la Tarea 7 para la justificación
 * completa de por qué la escritura no usa este mismo chequeo como gate.
 */
export async function existeProyecto(db: AnyDb, projectId: string): Promise<boolean> {
  const [row] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId))
  return Boolean(row)
}

export async function createSession(db: AnyDb, info: {
  name?: string; company?: string; role?: string; email?: string; projectId?: string
}) {
  try {
    const [row] = await db.insert(sessions).values(info).returning()
    return row
  } catch (e) {
    // Un link de entrevista puede apuntar a un proyecto que ya se borró: eso no puede
    // dejar a la persona sin entrevista. La sesión arranca sin proyecto y el cierre
    // la asigna por empresa, como si el link no hubiera traído proyecto.
    if (info.projectId && esViolacionDeForeignKey(e)) {
      const [row] = await db.insert(sessions).values({ ...info, projectId: undefined }).returning()
      return row
    }
    throw e
  }
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

/**
 * Cierra la entrevista una sola vez: la fila vuelve solo en la primera completada, y
 * `undefined` si ya estaba completa (o no existe). Repetir el cierre no puede tener
 * efectos —ni pisar `completedAt`, ni volver a asignar proyecto, ni mandar otro
 * correo—: el entrevistado puede volver a entrar al link y terminar de nuevo.
 */
export async function completeSession(db: AnyDb, id: string) {
  const [row] = await db.update(sessions)
    .set({ status: 'completed', completedAt: new Date() })
    .where(and(eq(sessions.id, id), ne(sessions.status, 'completed')))
    .returning()
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
  let rows: unknown[]
  try {
    rows = await db.update(sessions).set({ projectId }).where(eq(sessions.id, sessionId)).returning()
  } catch (e) {
    if (esViolacionDeForeignKey(e)) throw new ErrorNoEncontrado(`No existe el proyecto ${projectId}`)
    throw e
  }
  // Sin fila no hubo escritura: el "movido" habría sido silencio y la entrevista
  // seguiría donde estaba, que es exactamente el bug que este 404 hace visible.
  if (!rows.length) throw new ErrorNoEncontrado(`No existe la sesión ${sessionId}`)
}

export async function getProject(db: AnyDb, projectId: string) {
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId))
  return row ?? null
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
  let row: LandscapeVersionRow
  try {
    ;[row] = await db.insert(landscapeVersions)
      .values({
        projectId, stage,
        content: v.content,
        author: v.author,
        authorLabel: v.authorLabel ?? null,
      })
      .returning()
  } catch (e) {
    // Sin pre-chequeo de existencia acá a propósito: este catch es la fuente de verdad de
    // la escritura y no tiene ventana de carrera (a diferencia de un SELECT previo, que sí
    // la tendría entre el chequeo y el insert).
    if (esViolacionDeForeignKey(e)) throw new ErrorNoEncontrado(`No existe el proyecto ${projectId}`)
    throw e
  }

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
  // Desempate por id: dos versiones con el mismo `created_at` tendrían orden indefinido,
  // y `landscapeState` decide con el orden —cuál es la actual y si hay un borrador más
  // nuevo que la aprobada—. Con Claude escribiendo por MCP el empate deja de ser teórico.
  return db.select().from(landscapeVersions).where(where)
    .orderBy(desc(landscapeVersions.createdAt), desc(landscapeVersions.id))
}

/**
 * Sella una versión como aprobada y cierra la etapa. Único punto donde una etapa
 * pasa a 'aprobada'. Claude nunca llega acá: aprobar es humano y vive en el panel.
 *
 * `scope` ata la aprobación al proyecto y la etapa de la URL: el WHERE filtra por los
 * tres campos a la vez, así que un versionId de otro proyecto (o de otra etapa del mismo
 * proyecto) no matchea ninguna fila, en vez de aprobar y cerrar una etapa ajena. Al ir
 * los tres campos en un solo UPDATE no hay ventana de carrera entre "existe" y "aprobar"
 * como la habría con un SELECT previo.
 */
export async function approveLandscapeVersion(
  db: AnyDb, versionId: string, scope: { projectId: string; stage: StageKey },
): Promise<LandscapeVersionRow> {
  const [row] = await db.update(landscapeVersions)
    .set({ approvedAt: new Date() })
    .where(and(
      eq(landscapeVersions.id, versionId),
      eq(landscapeVersions.projectId, scope.projectId),
      eq(landscapeVersions.stage, scope.stage),
    ))
    .returning()
  // Mismo mensaje tanto si el id no existe como si existe pero es de otro proyecto o
  // etapa: quien hace el pedido no necesita distinguir esos dos casos, y así tampoco se
  // filtra que la versión existe en otro lado. Es ErrorNoEncontrado (404), no
  // ErrorDeValidacion (400): el recurso no está para este pedido, igual que un proyecto
  // que no existe — no es que el pedido esté mal formado.
  if (!row) throw new ErrorNoEncontrado(`No existe la versión ${versionId}`)
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
  // Sin este chequeo, un proyecto inexistente cae en "no hay long list" más abajo — un
  // mensaje que despista, porque el problema real es que el proyecto no existe, no que
  // le falte la etapa de tendencias.
  if (!(await existeProyecto(db, projectId))) throw new ErrorNoEncontrado(`No existe el proyecto ${projectId}`)

  // La long list sale de la versión *más nueva*, no de la aprobada. La long list es el
  // insumo del gate: si Claude amplió la lista después de una selección aprobada, hay que
  // poder elegir sobre la lista ampliada — con `getCurrentVersion` acá, una tendencia que
  // solo existe en la propuesta nueva se rechazaba por "intrusa". Cuando no hay borrador
  // más nuevo las dos coinciden, porque seleccionar guarda y aprueba en un solo acto.
  const [masNueva] = await listLandscapeVersions(db, projectId, 'tendencias')
  const candidatas = (masNueva?.content as TendenciasContent | undefined)?.candidatas
  if (!candidatas?.length) throw new ErrorDeValidacion('No hay long list de tendencias guardada para este proyecto')

  // Antes de contar cuántas son: si hay repetidas, el largo crudo miente sobre cuántas
  // tendencias distintas se eligieron en verdad.
  const repetidas = [...new Set(seleccionadas.filter((id, i) => seleccionadas.indexOf(id) !== i))]
  if (repetidas.length) throw new ErrorDeValidacion(`Estas tendencias están repetidas en la selección: ${repetidas.join(', ')}`)

  if (seleccionadas.length < MIN_TENDENCIAS || seleccionadas.length > MAX_TENDENCIAS)
    throw new ErrorDeValidacion(`Hay que elegir entre ${MIN_TENDENCIAS} y ${MAX_TENDENCIAS} tendencias, llegaron ${seleccionadas.length}`)

  const conocidas = new Set(candidatas.map(c => c.id))
  const intrusas = seleccionadas.filter(id => !conocidas.has(id))
  if (intrusas.length) throw new ErrorDeValidacion(`Estas tendencias no están en la long list: ${intrusas.join(', ')}`)

  const version = await saveLandscapeVersion(db, projectId, 'tendencias', {
    content: { candidatas, seleccionadas } satisfies TendenciasContent,
    author: 'humano',
    authorLabel,
  })
  return approveLandscapeVersion(db, version.id, { projectId, stage: 'tendencias' })
}

/**
 * El contenido serializado con las claves ordenadas: son objetos que volvieron de una
 * columna `jsonb`, y ahí el orden no es información. Dos contenidos son el mismo cuando
 * sus strings estabilizados coinciden — comparando así, el documento fijo se serializa una
 * sola vez y no una por comparación.
 */
function estabilizar(valor: unknown): string {
  return JSON.stringify(valor, (_clave, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  )
}

/**
 * La versión que escribió por primera vez el contenido que la etapa muestra hoy, cuando
 * la de arriba lo repite letra por letra. Es exactamente lo que deja `reafirmarAprobada`:
 * la fila nueva se creó recién, pero el contenido lo escribió otro, antes. El panel arma
 * la procedencia desde acá —si no, un contenido de hace tres días diría que se escribió
 * recién—. `null` cuando esa versión es la primera vez que el contenido aparece.
 *
 * `deLaEtapa` viene de la más nueva a la más vieja, así que las anteriores a `actual` son
 * las que le siguen en la lista, y la última de las que repiten es la que lo escribió.
 *
 * Esto corre por cada etapa de cada proyecto de la barra lateral, en cada render del
 * panel, y lo consumen sólo las dos pantallas de etapa: por eso corta antes de serializar
 * nada cuando no puede haber origen, y estabiliza el contenido de `actual` una sola vez
 * en vez de una por comparación.
 */
export function versionDeOrigen<V extends { content: unknown }>(actual: V | null, deLaEtapa: V[]): V | null {
  // Con una sola versión (o ninguna) no hay nada anterior que pueda haberlo escrito.
  if (!actual || deLaEtapa.length < 2) return null
  const i = deLaEtapa.indexOf(actual)
  // La función se exporta: con un `actual` que no esté en la lista, `indexOf` da -1, el
  // slice se llevaría el array entero y `actual` terminaría comparándose consigo mismo.
  if (i < 0) return null

  // Desde la más vieja hacia arriba: la primera que coincida es la que lo escribió, y no
  // hace falta serializar el resto del historial para saberlo.
  const contenido = estabilizar(actual.content)
  for (let j = deLaEtapa.length - 1; j > i; j--) {
    if (estabilizar(deLaEtapa[j].content) === contenido) return deLaEtapa[j]
  }
  return null
}

export interface StageState {
  stage: StageKey
  status: StageStatus
  versiones: number
  actual: LandscapeVersionRow | null
  aprobada: boolean
  /** De dónde viene el contenido de `actual`, si no lo escribió `actual`. Ver `versionDeOrigen`. */
  origen: LandscapeVersionRow | null
  /**
   * La versión más nueva sin aprobar, cuando la etapa ya tiene una aprobada debajo.
   * `null` el resto del tiempo (sin aprobar todavía, el borrador ya es `actual`).
   *
   * Existe porque el spec pone la frontera en que Claude nunca aprueba: escribir es
   * trabajo y va al chat, aprobar es decisión y vive en el panel. Una escritura por
   * MCP sobre una etapa cerrada no puede ni pisar lo aprobado ni reabrir la etapa
   * sola —sería deshacer una decisión humana desde un chat que nadie está mirando—,
   * pero tampoco puede quedar escondida. Queda acá, esperando el gate humano.
   */
  borradorNuevo: LandscapeVersionRow | null
}

/** El estado completo del landscape de un proyecto. Siempre las seis etapas. */
export async function landscapeState(db: AnyDb, projectId: string): Promise<StageState[]> {
  const filas = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, projectId))
  const versiones = await listLandscapeVersions(db, projectId)

  const estadoPorEtapa = new Map<string, StageStatus>(
    (filas as { stage: string; status: string }[]).map(f => [f.stage, f.status as StageStatus]),
  )

  return STAGE_ORDER.map(stage => {
    // `versiones` viene de la más nueva a la más vieja, así que [0] es la más reciente.
    const deLaEtapa = versiones.filter(v => v.stage === stage)
    const aprobadaMasNueva = deLaEtapa.find(v => v.approvedAt) ?? null
    const masNueva = deLaEtapa[0] ?? null
    const actual = aprobadaMasNueva ?? masNueva
    const status = estadoPorEtapa.get(stage) ?? 'pendiente'
    // Si la más reciente de todas no está aprobada y hay una aprobada más abajo,
    // entonces llegó trabajo después de la decisión: eso es el borrador pendiente.
    const borradorNuevo = aprobadaMasNueva && masNueva && !masNueva.approvedAt ? masNueva : null
    return {
      stage,
      status,
      versiones: deLaEtapa.length,
      actual,
      aprobada: status === 'aprobada',
      origen: versionDeOrigen(actual, deLaEtapa),
      borradorNuevo,
    }
  })
}

/**
 * El equipo mira el borrador que llegó después de la aprobación y decide quedarse con lo
 * que ya había aprobado. No borra nada —la tabla es append-only y lo que escribió Claude
 * queda en el historial—: appendea una versión con el contenido de la aprobada vigente,
 * ya sellada y firmada por quien decidió. Esa fila pasa a ser la más nueva, tiene
 * `approvedAt`, y `borradorNuevo` se vuelve `null` solo, por la misma regla que lo derivó
 * en `landscapeState`. Por eso no hace falta ninguna columna nueva.
 *
 * Sin conflicto no hace nada y devuelve `null`: ratificar algo que nadie discutió sólo
 * ensuciaría el historial con una fila por cada clic.
 *
 * La regla de negocio no se invierte: lo aprobado ya estaba vigente y sigue estándolo.
 * Lo que cambia es que ahora queda escrito que alguien miró el borrador y eligió lo
 * anterior — antes no había forma de distinguir eso de que nadie lo hubiera mirado.
 */
export async function reafirmarAprobada(
  db: AnyDb, projectId: string, stage: StageKey, autor?: string,
): Promise<LandscapeVersionRow | null> {
  // Igual que en `selectTendencias`: sin este chequeo, un proyecto inexistente sale por
  // el mismo camino que “no hay nada que reafirmar”, y son dos cosas distintas.
  if (!(await existeProyecto(db, projectId))) throw new ErrorNoEncontrado(`No existe el proyecto ${projectId}`)

  const etapa = (await landscapeState(db, projectId)).find(e => e.stage === stage)
  if (!etapa?.borradorNuevo || !etapa.actual) return null

  const version = await saveLandscapeVersion(db, projectId, stage, {
    content: etapa.actual.content,
    author: 'humano',
    authorLabel: autor,
  })
  return approveLandscapeVersion(db, version.id, { projectId, stage })
}

/**
 * Cuántas etapas cuentan como aprobadas y cuántas cuentan en total, para la cabecera
 * del proyecto. Una etapa 'no_aplica' no suma en ninguno de los dos lados: no es
 * "pendiente" (nadie la va a mover nunca) ni "aprobada" (nadie la aprobó) — si contara
 * como pendiente, un proyecto que no necesita 'diagnostico' nunca llegaría a "completo";
 * si contara como aprobada, se acreditaría algo que nadie revisó. Se cuenta aparte, y no
 * entra ni al numerador ni al denominador.
 */
export function summarizeLandscape(estado: StageState[]): { aprobadas: number; total: number } {
  const aplicables = estado.filter(e => e.status !== 'no_aplica')
  return {
    aprobadas: aplicables.filter(e => e.aprobada).length,
    total: aplicables.length,
  }
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

  // Desempate cuando guardar y aprobar caen en el mismo milisegundo (pasa cada vez que
  // se guarda y aprueba en un solo acto, como en selectTendencias): la aprobación sella
  // algo ya guardado, así que en el empate va arriba, no al azar del sort estable.
  return entradas.sort((a, b) =>
    b.cuando.getTime() - a.cuando.getTime()
    || Number(b.tipo === 'aprobado') - Number(a.tipo === 'aprobado'),
  ).slice(0, limit)
}
