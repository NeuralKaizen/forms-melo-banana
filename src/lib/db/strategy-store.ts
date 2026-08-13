import { eq, and, desc, sql } from 'drizzle-orm'
import { strategyStages, strategyVersions } from './schema'
import type { StageStatus } from '@/lib/landscape/stages'
import type { EstrategiaKey } from '@/lib/estrategia/stages'
import { ETAPA_ORDER } from '@/lib/estrategia/stages'
import { type AnyDb, ErrorNoEncontrado, esViolacionDeForeignKey, existeProyecto, versionDeOrigen } from './store'

// ── Estrategia (fase 3) ──────────────────────────────────────────────────────
// Espejo 1:1 del store de landscape (fase 2): mismo patrón de estado por etapa +
// versiones append-only. Ver valkyria/specs/2026-08-11-fase3-pipeline-estrategia-design.md

export type StrategyVersionRow = typeof strategyVersions.$inferSelect

export async function setStrategyStageStatus(db: AnyDb, projectId: string, stage: EstrategiaKey, status: StageStatus) {
  await db.insert(strategyStages)
    .values({ projectId, stage, status })
    .onConflictDoUpdate({
      target: [strategyStages.projectId, strategyStages.stage],
      set: { status, updatedAt: new Date() },
    })
}

/**
 * Escribe una versión nueva. Siempre borrador: aprobar es un acto humano aparte.
 * La etapa arranca a moverse con la primera versión, pero una etapa ya aprobada
 * o marcada como no aplica no se degrada sola.
 */
export async function saveStrategyVersion(db: AnyDb, projectId: string, stage: EstrategiaKey, v: {
  content: unknown; author: 'claude' | 'humano'; authorLabel?: string
}): Promise<StrategyVersionRow> {
  let row: StrategyVersionRow
  try {
    ;[row] = await db.insert(strategyVersions)
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

  await db.insert(strategyStages)
    .values({ projectId, stage, status: 'en_curso' })
    .onConflictDoUpdate({
      target: [strategyStages.projectId, strategyStages.stage],
      set: {
        status: sql`case when ${strategyStages.status} = 'pendiente' then 'en_curso' else ${strategyStages.status} end`,
        updatedAt: new Date(),
      },
    })

  return row
}

/** Historial de una etapa, o del proyecto entero. La más nueva primero. */
export async function listStrategyVersions(db: AnyDb, projectId: string, stage?: EstrategiaKey): Promise<StrategyVersionRow[]> {
  const where = stage
    ? and(eq(strategyVersions.projectId, projectId), eq(strategyVersions.stage, stage))
    : eq(strategyVersions.projectId, projectId)
  // Desempate por id: dos versiones con el mismo `created_at` tendrían orden indefinido,
  // y `strategyState` decide con el orden —cuál es la actual y si hay un borrador más
  // nuevo que la aprobada—. Con Claude escribiendo por MCP el empate deja de ser teórico.
  return db.select().from(strategyVersions).where(where)
    .orderBy(desc(strategyVersions.createdAt), desc(strategyVersions.id))
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
export async function approveStrategyVersion(
  db: AnyDb, versionId: string, scope: { projectId: string; stage: EstrategiaKey },
): Promise<StrategyVersionRow> {
  const [row] = await db.update(strategyVersions)
    .set({ approvedAt: new Date() })
    .where(and(
      eq(strategyVersions.id, versionId),
      eq(strategyVersions.projectId, scope.projectId),
      eq(strategyVersions.stage, scope.stage),
    ))
    .returning()
  // Mismo mensaje tanto si el id no existe como si existe pero es de otro proyecto o
  // etapa: quien hace el pedido no necesita distinguir esos dos casos, y así tampoco se
  // filtra que la versión existe en otro lado. Es ErrorNoEncontrado (404), no
  // ErrorDeValidacion (400): el recurso no está para este pedido, igual que un proyecto
  // que no existe — no es que el pedido esté mal formado.
  if (!row) throw new ErrorNoEncontrado(`No existe la versión ${versionId}`)
  await setStrategyStageStatus(db, row.projectId, row.stage as EstrategiaKey, 'aprobada')
  return row
}

export interface StrategyStageState {
  stage: EstrategiaKey
  status: StageStatus
  versiones: number
  actual: StrategyVersionRow | null
  aprobada: boolean
  /** De dónde viene el contenido de `actual`, si no lo escribió `actual`. Ver `versionDeOrigen`. */
  origen: StrategyVersionRow | null
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
  borradorNuevo: StrategyVersionRow | null
}

/** El estado completo de la estrategia de un proyecto. Siempre las catorce etapas. */
export async function strategyState(db: AnyDb, projectId: string): Promise<StrategyStageState[]> {
  const filas = await db.select().from(strategyStages).where(eq(strategyStages.projectId, projectId))
  const versiones = await listStrategyVersions(db, projectId)

  const estadoPorEtapa = new Map<string, StageStatus>(
    (filas as { stage: string; status: string }[]).map(f => [f.stage, f.status as StageStatus]),
  )

  return ETAPA_ORDER.map(stage => {
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
 * Espejo de `reafirmarAprobada` del landscape: el equipo se queda con lo que ya había
 * aprobado. Appendea una versión con el contenido de la aprobada vigente, ya sellada, que
 * pasa a ser la más nueva y disuelve el conflicto sola. Lo que escribió Claude queda en el
 * historial. Sin conflicto no hace nada y devuelve `null`.
 */
export async function reafirmarAprobadaEstrategia(
  db: AnyDb, projectId: string, stage: EstrategiaKey, autor?: string,
): Promise<StrategyVersionRow | null> {
  if (!(await existeProyecto(db, projectId))) throw new ErrorNoEncontrado(`No existe el proyecto ${projectId}`)

  const etapa = (await strategyState(db, projectId)).find(e => e.stage === stage)
  if (!etapa?.borradorNuevo || !etapa.actual) return null

  const version = await saveStrategyVersion(db, projectId, stage, {
    content: etapa.actual.content,
    author: 'humano',
    authorLabel: autor,
  })
  return approveStrategyVersion(db, version.id, { projectId, stage })
}

/**
 * Cuántas etapas cuentan como aprobadas y cuántas cuentan en total, para la cabecera
 * del proyecto. Una etapa 'no_aplica' no suma en ninguno de los dos lados: no es
 * "pendiente" (nadie la va a mover nunca) ni "aprobada" (nadie la aprobó) — si contara
 * como pendiente, un proyecto que no necesita una etapa nunca llegaría a "completo";
 * si contara como aprobada, se acreditaría algo que nadie revisó. Se cuenta aparte, y no
 * entra ni al numerador ni al denominador.
 */
export function summarizeStrategy(estado: StrategyStageState[]): { aprobadas: number; total: number } {
  const aplicables = estado.filter(e => e.status !== 'no_aplica')
  return {
    aprobadas: aplicables.filter(e => e.aprobada).length,
    total: aplicables.length,
  }
}
