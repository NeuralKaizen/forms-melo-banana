# Fase 2 · Landscape — columna vertebral · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el panel de Landscape deje de ser una demo con datos fijos y pase a leer y escribir el estado real del proyecto — etapas versionadas, gates humanos y actividad — sobre Neon.

**Architecture:** Dos tablas nuevas cuelgan de `projects`: `landscape_stages` (una fila por etapa, con su estado) y `landscape_versions` (append-only, nada se pisa). El store de `src/lib/db/store.ts` gana las funciones de lectura y escritura; el panel las consume por Server Component y escribe por una única ruta de API. No hay llamadas a ningún modelo: la escritura desde Claude llega después, por MCP, contra estas mismas funciones.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM sobre Neon (`neon-http`), PGlite para los tests, Vitest, Tailwind v4.

## Contexto para quien implementa

Lee antes de empezar: `docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md` (el diseño aprobado) y `docs/fase2/fase-2-investigacion-landscape.md` (el flujo real del estudio, de donde salen las seis etapas).

Lo que ya existe y **no** hay que rehacer:
- `src/app/admin/projects/[id]/landscape/page.tsx` y `LandscapeWorkspace.tsx` — el layout visual está aprobado. Este plan **conserva el diseño tal cual** y solo cambia de dónde vienen los datos.
- `src/lib/landscape/stages.ts` — tiene los tipos definitivos (`StageKey`, `TendenciaCandidata`, …) y constantes de demo (`TENDENCIAS_DEMO`, `ACTIVIDAD_DEMO`, `STAGES`). Los tipos se quedan; las constantes de demo se borran en la Tarea 6.
- `src/lib/db/testdb.ts` — levanta un Postgres en memoria con el esquema a mano. Cada tabla nueva se agrega también ahí o los tests no la ven.

## Global Constraints

- **La plataforma no corre modelos.** Ninguna tarea de este plan llama a la API de Anthropic ni gasta tokens. La inteligencia la pone Claude desde el chat de M&B; acá se guarda y se decide.
- **Toda función nueva produce contexto para la columna vertebral o lo consume.** Si no hace ninguna de las dos, no se construye.
- **`landscape_versions` es append-only.** Nada se actualiza salvo `approved_at`. Corregir es crear una versión nueva.
- **Claude nunca aprueba.** Toda escritura de contenido entra como borrador (`approved_at = null`). Aprobar es un acto humano desde el panel.
- **Comillas tipográficas.** El copy de la UI usa `“ ”` (U+201C/U+201D) y `—` (U+2014), no `"` ni `-`. Hay un test canario en `src/app/admin/projects/[id]/DeliverableDocument.test.tsx` (`it('las citas van entre comillas tipográficas')`) que lo verifica por bytes — cubre el documento del entregable, **no** el panel de Landscape, así que en los archivos de este plan hay que verificarlo a mano: `rg -n $'—' <archivo>` tiene que encontrar los guiones largos que copiaste.
- **Alias de imports:** `@/` resuelve tanto en Next como en Vitest (ya está en `vitest.config.ts` y en `tsconfig.json`). El store puede importar de `@/lib/landscape/stages` sin romper los tests.
- **Idioma:** nombres de funciones del store en inglés (sigue `saveDeliverable`/`getDeliverable`), tipos de dominio y copy de UI en español.
- **Commits:** convención del repo, en español, con scope — `feat(landscape): …`, `test(landscape): …`. Todo mensaje de commit termina con:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
  ```
- **Tests:** `npx vitest run <archivo>` para uno solo, `npm test` para todo. Nunca se comitea con la suite en rojo.
- **Esquema en Neon:** `npm run db:push` (drizzle-kit) aplica `schema.ts` contra la base real. Se corre una sola vez, en la Tarea 1.
- **Estados de etapa:** `'pendiente' | 'en_curso' | 'aprobada' | 'no_aplica'`. El spec lista tres; se agrega `'no_aplica'` porque la etapa Diagnóstico es condicional (solo rebranding) y la UI ya la modela así. Es una desviación deliberada del spec.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/db/schema.ts` (modificar) | Las dos tablas nuevas. |
| `src/lib/db/testdb.ts` (modificar) | El mismo DDL a mano para PGlite. |
| `src/lib/db/store.ts` (modificar) | Escritura y lectura de etapas y versiones. Sin lógica de presentación. |
| `src/lib/db/store.test.ts` (modificar) | Tests de todo lo anterior. |
| `src/lib/landscape/stages.ts` (modificar) | Modelo de dominio del panel: etiquetas, orden, armado de etapas, texto de actividad, tiempo relativo. Sin acceso a base. |
| `src/lib/landscape/stages.test.ts` (crear) | Tests de las funciones puras. |
| `src/app/api/projects/[id]/landscape/[stage]/route.ts` (crear) | Única ruta de escritura del panel. Tres acciones. |
| `src/app/admin/projects/[id]/landscape/page.tsx` (modificar) | Carga los datos reales y se los pasa al workspace. |
| `src/app/admin/projects/[id]/landscape/LandscapeWorkspace.tsx` (modificar) | Mismo diseño, datos por props, botones que escriben. |
| `src/app/admin/projects/[id]/landscape/ContenidoEtapa.tsx` (crear) | Render legible del `content` de una etapa cualquiera. |
| `scripts/seed-landscape.ts` (crear) | Carga el contenido de demo en un proyecto real para poder verlo funcionando. |

---

### Task 1: Las dos tablas

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/testdb.ts:37` (justo después de la tabla `deliverables`, antes del backtick de cierre)
- Test: `src/lib/db/store.test.ts`

**Interfaces:**
- Consumes: `projects` de `src/lib/db/schema.ts`.
- Produces: `landscapeStages` y `landscapeVersions` (tablas Drizzle). Filas:
  - `landscapeStages`: `{ projectId: string; stage: string; status: string; updatedAt: Date }`, clave primaria compuesta `(projectId, stage)`.
  - `landscapeVersions`: `{ id: string; projectId: string; stage: string; content: unknown; author: string; authorLabel: string | null; createdAt: Date; approvedAt: Date | null }`.

- [ ] **Step 1: Escribe el test que falla**

Agrega al final de `src/lib/db/store.test.ts`:

```ts
describe('landscape · esquema', () => {
  it('guarda una versión de etapa y la lee de vuelta', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const [v] = await db.insert(landscapeVersions).values({
      projectId: p.id,
      stage: 'tendencias',
      content: { candidatas: [] },
      author: 'claude',
    }).returning()
    expect(v.id).toBeTruthy()
    expect(v.approvedAt).toBeNull()
    expect(v.authorLabel).toBeNull()
  })

  it('una etapa es única por proyecto', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await db.insert(landscapeStages).values({ projectId: p.id, stage: 'contexto', status: 'en_curso' })
    await expect(
      db.insert(landscapeStages).values({ projectId: p.id, stage: 'contexto', status: 'aprobada' }),
    ).rejects.toThrow()
  })
})
```

Y agrega las tablas al import de schema que ya está arriba del archivo (línea 8):

```ts
import { answers, landscapeStages, landscapeVersions } from './schema'
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npx vitest run src/lib/db/store.test.ts -t "landscape · esquema"`
Expected: FAIL — no existe el export `landscapeVersions` en `./schema`.

- [ ] **Step 3: Agrega las tablas al esquema de Drizzle**

En `src/lib/db/schema.ts`, cambia la primera línea para importar `primaryKey` e `index`:

```ts
import { pgTable, uuid, text, timestamp, jsonb, unique, primaryKey, index } from 'drizzle-orm/pg-core'
```

Y agrega al final del archivo:

```ts
// Fase 2 · Landscape. Ver docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md

/** Una fila por etapa del landscape de un proyecto. El estado, y nada más. */
export const landscapeStages = pgTable('landscape_stages', {
  projectId: uuid('project_id').notNull().references(() => projects.id),
  stage: text('stage').notNull(),                          // StageKey
  status: text('status').notNull().default('pendiente'),   // StageStatus
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.projectId, t.stage] })])

/**
 * Append-only: nada se pisa. La versión aprobada es la que cuenta; las anteriores
 * quedan para volver atrás y para ver cómo evolucionó la etapa.
 */
export const landscapeVersions = pgTable('landscape_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  stage: text('stage').notNull(),                          // StageKey
  content: jsonb('content').notNull(),                     // la salida de la etapa
  author: text('author').notNull(),                        // 'claude' | 'humano'
  authorLabel: text('author_label'),                       // quién, si se sabe
  createdAt: timestamp('created_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
}, (t) => [index('landscape_versions_project_stage').on(t.projectId, t.stage)])
```

- [ ] **Step 4: Agrega el mismo DDL a la base de tests**

En `src/lib/db/testdb.ts`, dentro del template literal de `client.exec`, después del `CREATE TABLE deliverables (...);` y antes del backtick de cierre:

```sql
    CREATE TABLE landscape_stages (
      project_id uuid NOT NULL REFERENCES projects(id),
      stage text NOT NULL,
      status text NOT NULL DEFAULT 'pendiente',
      updated_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, stage)
    );
    CREATE TABLE landscape_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES projects(id),
      stage text NOT NULL,
      content jsonb NOT NULL,
      author text NOT NULL,
      author_label text,
      created_at timestamp NOT NULL DEFAULT now(),
      approved_at timestamp
    );
    CREATE INDEX landscape_versions_project_stage ON landscape_versions (project_id, stage);
```

- [ ] **Step 5: Corre el test para verificar que pasa**

Run: `npx vitest run src/lib/db/store.test.ts`
Expected: PASS, incluidos los tests que ya existían.

- [ ] **Step 6: Aplica el esquema a Neon**

Run: `npm run db:push`
Expected: drizzle-kit reporta la creación de `landscape_stages` y `landscape_versions`. Si pregunta por alguna operación destructiva sobre tablas existentes, **cancela y avisa** — este cambio solo agrega tablas.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/testdb.ts src/lib/db/store.test.ts
git commit -m "$(cat <<'EOF'
feat(landscape): etapas y versiones append-only en el esquema

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
EOF
)"
```

---

### Task 2: Guardar una versión mueve la etapa

**Files:**
- Modify: `src/lib/db/store.ts`
- Test: `src/lib/db/store.test.ts`

**Interfaces:**
- Consumes: `landscapeStages`, `landscapeVersions` (Tarea 1); `StageKey`, `StageStatus` de `@/lib/landscape/stages` (ya existen ahí, exportados).
- Produces:
  ```ts
  type LandscapeVersionRow = typeof landscapeVersions.$inferSelect
  saveLandscapeVersion(db, projectId: string, stage: StageKey, v: {
    content: unknown; author: 'claude' | 'humano'; authorLabel?: string
  }): Promise<LandscapeVersionRow>
  setStageStatus(db, projectId: string, stage: StageKey, status: StageStatus): Promise<void>
  listLandscapeVersions(db, projectId: string, stage?: StageKey): Promise<LandscapeVersionRow[]>  // más nueva primero
  ```

Regla que codifica la Tarea: la primera versión de una etapa la pasa de `pendiente` a `en_curso`. Una etapa `aprobada` o `no_aplica` **no** se degrada por una escritura de Claude — eso lo decide una persona.

- [ ] **Step 1: Escribe los tests que fallan**

Agrega a `src/lib/db/store.test.ts`:

```ts
describe('landscape · guardar versiones', () => {
  it('guardar la primera versión pone la etapa en curso', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', {
      content: { cifras: ['x'] }, author: 'claude',
    })
    expect(v.approvedAt).toBeNull()
    const [stage] = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, p.id))
    expect(stage.status).toBe('en_curso')
  })

  it('guardar no degrada una etapa ya aprobada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await setStageStatus(db, p.id, 'contexto', 'aprobada')
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'claude' })
    const [stage] = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, p.id))
    expect(stage.status).toBe('aprobada')
  })

  it('las versiones se acumulan, la más nueva primero', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await new Promise(r => setTimeout(r, 5))
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'humano', authorLabel: 'Isa' })
    await saveLandscapeVersion(db, p.id, 'tendencias', { content: { v: 9 }, author: 'claude' })

    const solo = await listLandscapeVersions(db, p.id, 'contexto')
    expect(solo).toHaveLength(2)
    expect((solo[0].content as { v: number }).v).toBe(2)
    expect(solo[0].authorLabel).toBe('Isa')
    expect(await listLandscapeVersions(db, p.id)).toHaveLength(3)
  })
})
```

Agrega al import de `./store` (línea 3-7) los tres nombres nuevos, y al import de `drizzle-orm` en el archivo de test — si no hay, agrégalo arriba de todo:

```ts
import { eq } from 'drizzle-orm'
```

- [ ] **Step 2: Corre los tests para verificar que fallan**

Run: `npx vitest run src/lib/db/store.test.ts -t "landscape · guardar versiones"`
Expected: FAIL — `saveLandscapeVersion is not a function`.

- [ ] **Step 3: Implementa en el store**

En `src/lib/db/store.ts`, cambia las dos primeras líneas:

```ts
import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { sessions, answers, projects, deliverables, landscapeStages, landscapeVersions } from './schema'
import type { StageKey, StageStatus } from '@/lib/landscape/stages'
```

Y agrega al final del archivo:

```ts
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
```

- [ ] **Step 4: Corre los tests para verificar que pasan**

Run: `npx vitest run src/lib/db/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/store.ts src/lib/db/store.test.ts
git commit -m "$(cat <<'EOF'
feat(landscape): guardar versiones de etapa, siempre como borrador

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
EOF
)"
```

---

### Task 3: Aprobar una versión

**Files:**
- Modify: `src/lib/db/store.ts`
- Test: `src/lib/db/store.test.ts`

**Interfaces:**
- Consumes: `saveLandscapeVersion`, `setStageStatus`, `listLandscapeVersions` (Tarea 2).
- Produces:
  ```ts
  approveLandscapeVersion(db, versionId: string): Promise<LandscapeVersionRow>
  getCurrentVersion(db, projectId: string, stage: StageKey): Promise<LandscapeVersionRow | null>
  ```
  `getCurrentVersion` devuelve la aprobada más reciente; si no hay ninguna aprobada, el borrador más reciente; si no hay nada, `null`.

- [ ] **Step 1: Escribe los tests que fallan**

```ts
describe('landscape · aprobar', () => {
  it('aprobar sella la versión y cierra la etapa', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    const aprobada = await approveLandscapeVersion(db, v.id)
    expect(aprobada.approvedAt).toBeTruthy()
    const [stage] = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, p.id))
    expect(stage.status).toBe('aprobada')
  })

  it('aprobar una versión que no existe explota', async () => {
    const db = await makeTestDb()
    await expect(
      approveLandscapeVersion(db, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(/no existe/i)
  })

  it('getCurrentVersion prefiere la aprobada sobre un borrador posterior', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v1 = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v1.id)
    await new Promise(r => setTimeout(r, 5))
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'claude' })

    const actual = await getCurrentVersion(db, p.id, 'contexto')
    expect((actual!.content as { v: number }).v).toBe(1)
  })

  it('getCurrentVersion cae al borrador más nuevo si no hay ninguna aprobada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await new Promise(r => setTimeout(r, 5))
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'claude' })

    const actual = await getCurrentVersion(db, p.id, 'contexto')
    expect((actual!.content as { v: number }).v).toBe(2)
    expect(await getCurrentVersion(db, p.id, 'panorama')).toBeNull()
  })
})
```

Agrega `approveLandscapeVersion` y `getCurrentVersion` al import de `./store`.

- [ ] **Step 2: Corre los tests para verificar que fallan**

Run: `npx vitest run src/lib/db/store.test.ts -t "landscape · aprobar"`
Expected: FAIL — `approveLandscapeVersion is not a function`.

- [ ] **Step 3: Implementa en el store**

Agrega al final de `src/lib/db/store.ts`:

```ts
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
```

- [ ] **Step 4: Corre los tests para verificar que pasan**

Run: `npx vitest run src/lib/db/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/store.ts src/lib/db/store.test.ts
git commit -m "$(cat <<'EOF'
feat(landscape): aprobar una versión cierra la etapa

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
EOF
)"
```

---

### Task 4: El gate de tendencias (4 o 5, decide una persona)

**Files:**
- Modify: `src/lib/db/store.ts`
- Test: `src/lib/db/store.test.ts`

**Interfaces:**
- Consumes: `getCurrentVersion`, `saveLandscapeVersion`, `approveLandscapeVersion` (Tareas 2 y 3); `MIN_TENDENCIAS = 4` y `MAX_TENDENCIAS = 5` de `@/lib/landscape/stages`.
- Produces:
  ```ts
  interface TendenciasContent { candidatas: TendenciaCandidata[]; seleccionadas?: string[] }
  selectTendencias(db, projectId: string, seleccionadas: string[], authorLabel?: string): Promise<LandscapeVersionRow>
  ```

Qué hace: lee la long list vigente de la etapa `tendencias`, valida que la selección tenga entre 4 y 5 ids y que todos existan en la long list, escribe una versión nueva de autor `humano` con `{ candidatas, seleccionadas }` y la aprueba en el mismo paso. Es la decisión humana del proceso (`tendencias.seleccion` en `docs/fase2/fase-2-investigacion-landscape.md`), por eso guardar y aprobar es un solo acto.

- [ ] **Step 1: Escribe los tests que fallan**

```ts
describe('landscape · gate de tendencias', () => {
  const longList = {
    candidatas: [
      { id: 't1', eje: 'Marca', titulo: 'A', descripcion: '', fuentes: [] },
      { id: 't2', eje: 'Marca', titulo: 'B', descripcion: '', fuentes: [] },
      { id: 't3', eje: 'Estrategia', titulo: 'C', descripcion: '', fuentes: [] },
      { id: 't4', eje: 'Estrategia', titulo: 'D', descripcion: '', fuentes: [] },
      { id: 't5', eje: 'Comunicación', titulo: 'E', descripcion: '', fuentes: [] },
      { id: 't6', eje: 'Comunicación', titulo: 'F', descripcion: '', fuentes: [] },
    ],
  }

  async function conLongList() {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveLandscapeVersion(db, p.id, 'tendencias', { content: longList, author: 'claude' })
    return { db, p }
  }

  it('cuatro seleccionadas quedan aprobadas y conservan la long list', async () => {
    const { db, p } = await conLongList()
    const v = await selectTendencias(db, p.id, ['t1', 't3', 't4', 't5'], 'Isa')
    expect(v.approvedAt).toBeTruthy()
    expect(v.author).toBe('humano')
    expect(v.authorLabel).toBe('Isa')
    const content = v.content as { candidatas: unknown[]; seleccionadas: string[] }
    expect(content.seleccionadas).toEqual(['t1', 't3', 't4', 't5'])
    expect(content.candidatas).toHaveLength(6)

    const [stage] = await db.select().from(landscapeStages)
      .where(and(eq(landscapeStages.projectId, p.id), eq(landscapeStages.stage, 'tendencias')))
    expect(stage.status).toBe('aprobada')
  })

  it('tres es muy poco y seis es demasiado', async () => {
    const { db, p } = await conLongList()
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3'])).rejects.toThrow(/entre 4 y 5/i)
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3', 't4', 't5', 't6'])).rejects.toThrow(/entre 4 y 5/i)
  })

  it('no se puede seleccionar algo que no está en la long list', async () => {
    const { db, p } = await conLongList()
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3', 'fantasma'])).rejects.toThrow(/fantasma/)
  })

  it('sin long list guardada no hay nada que seleccionar', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3', 't4'])).rejects.toThrow(/long list/i)
  })
})
```

Agrega `selectTendencias` al import de `./store` y `and` al import de `drizzle-orm` en el archivo de test.

- [ ] **Step 2: Corre los tests para verificar que fallan**

Run: `npx vitest run src/lib/db/store.test.ts -t "landscape · gate de tendencias"`
Expected: FAIL — `selectTendencias is not a function`.

- [ ] **Step 3: Implementa en el store**

Agrega el import de tipos arriba (junto al de `StageKey`):

```ts
import type { StageKey, StageStatus, TendenciaCandidata } from '@/lib/landscape/stages'
import { MIN_TENDENCIAS, MAX_TENDENCIAS } from '@/lib/landscape/stages'
```

Y al final del archivo:

```ts
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
```

- [ ] **Step 4: Corre los tests para verificar que pasan**

Run: `npx vitest run src/lib/db/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/store.ts src/lib/db/store.test.ts
git commit -m "$(cat <<'EOF'
feat(landscape): el gate de 4 o 5 tendencias vive en el store

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
EOF
)"
```

---

### Task 5: Leer el estado del landscape y la actividad

**Files:**
- Modify: `src/lib/db/store.ts`
- Test: `src/lib/db/store.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  ```ts
  interface StageState {
    stage: StageKey
    status: StageStatus
    versiones: number                       // cuántas versiones tiene la etapa
    actual: LandscapeVersionRow | null      // aprobada, o último borrador
    aprobada: boolean
  }
  interface ActivityEntry {
    id: string
    tipo: 'guardado' | 'aprobado'
    stage: StageKey
    autor: 'claude' | 'humano'
    quien?: string
    cuando: Date
  }
  landscapeState(db, projectId: string): Promise<StageState[]>          // en orden de proceso, las seis siempre
  listLandscapeActivity(db, projectId: string, limit?: number): Promise<ActivityEntry[]>  // default 8, más nuevo primero
  ```

`landscapeState` devuelve **siempre las seis etapas**, con `status: 'pendiente'` para las que todavía no tienen fila. Es lo que consume el panel hoy y lo que consumirá `estado_landscape` por MCP después.

- [ ] **Step 1: Escribe los tests que fallan**

```ts
describe('landscape · lectura de estado', () => {
  it('siempre devuelve las seis etapas, en orden, aunque no haya nada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const estado = await landscapeState(db, p.id)
    expect(estado.map(e => e.stage)).toEqual(
      ['setup', 'contexto', 'tendencias', 'panorama', 'diagnostico', 'entrega'],
    )
    expect(estado.every(e => e.status === 'pendiente')).toBe(true)
    expect(estado.every(e => e.actual === null && e.versiones === 0)).toBe(true)
  })

  it('refleja versiones, aprobación y no_aplica', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v.id)
    await saveLandscapeVersion(db, p.id, 'tendencias', { content: { candidatas: [] }, author: 'claude' })
    await setStageStatus(db, p.id, 'diagnostico', 'no_aplica')

    const porEtapa = Object.fromEntries((await landscapeState(db, p.id)).map(e => [e.stage, e]))
    expect(porEtapa.contexto.status).toBe('aprobada')
    expect(porEtapa.contexto.aprobada).toBe(true)
    expect(porEtapa.contexto.versiones).toBe(1)
    expect(porEtapa.tendencias.status).toBe('en_curso')
    expect(porEtapa.tendencias.aprobada).toBe(false)
    expect(porEtapa.diagnostico.status).toBe('no_aplica')
    expect(porEtapa.entrega.status).toBe('pendiente')
  })

  it('la actividad sale de las versiones, sin tabla aparte', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', {
      content: { v: 1 }, author: 'claude',
    })
    await approveLandscapeVersion(db, v.id)

    const act = await listLandscapeActivity(db, p.id)
    expect(act).toHaveLength(2)
    expect(act[0].tipo).toBe('aprobado')
    expect(act[0].autor).toBe('humano')
    expect(act[1].tipo).toBe('guardado')
    expect(act[1].autor).toBe('claude')
    expect(act[1].stage).toBe('contexto')
  })

  it('la actividad respeta el límite', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    for (let i = 0; i < 5; i++) {
      await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: i }, author: 'claude' })
    }
    expect(await listLandscapeActivity(db, p.id, 3)).toHaveLength(3)
  })
})
```

Agrega `landscapeState` y `listLandscapeActivity` al import de `./store`.

- [ ] **Step 2: Corre los tests para verificar que fallan**

Run: `npx vitest run src/lib/db/store.test.ts -t "landscape · lectura de estado"`
Expected: FAIL — `landscapeState is not a function`.

- [ ] **Step 3: Implementa en el store**

Agrega `STAGE_ORDER` al import de `@/lib/landscape/stages`:

```ts
import { MIN_TENDENCIAS, MAX_TENDENCIAS, STAGE_ORDER } from '@/lib/landscape/stages'
```

> `STAGE_ORDER` se crea en la Tarea 6. Si estás haciendo esta tarea antes, agrégalo vos a `src/lib/landscape/stages.ts`:
> ```ts
> export const STAGE_ORDER: StageKey[] = ['setup', 'contexto', 'tendencias', 'panorama', 'diagnostico', 'entrega']
> ```

Y al final del archivo:

```ts
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
 * humano, así que esas entradas van con autor 'humano'.
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
        quien: v.authorLabel ?? undefined,
        cuando: new Date(v.approvedAt),
      })
    }
  }

  return entradas.sort((a, b) => b.cuando.getTime() - a.cuando.getTime()).slice(0, limit)
}
```

- [ ] **Step 4: Corre los tests para verificar que pasan**

Run: `npx vitest run src/lib/db/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/store.ts src/lib/db/store.test.ts src/lib/landscape/stages.ts
git commit -m "$(cat <<'EOF'
feat(landscape): estado por etapa y actividad derivada de las versiones

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
EOF
)"
```

---

### Task 6: El modelo de dominio del panel (chau datos de demo)

**Files:**
- Modify: `src/lib/landscape/stages.ts`
- Create: `src/lib/landscape/stages.test.ts`

**Interfaces:**
- Consumes: `StageState` y `ActivityEntry` de `@/lib/db/store` (solo los tipos — este módulo no toca la base).
- Produces:
  ```ts
  STAGE_ORDER: StageKey[]
  STAGE_LABEL: Record<StageKey, string>
  STAGE_HINT: Partial<Record<StageKey, string>>
  buildStages(estado: { stage: StageKey; status: StageStatus }[]): Stage[]
  textoActividad(e: { tipo: 'guardado' | 'aprobado'; stage: StageKey }): string
  haceCuanto(fecha: Date, ahora?: Date): string
  ```
  Se **borran**: `STAGES`, `TENDENCIAS_DEMO`, `ACTIVIDAD_DEMO`, `interface Actividad`. Se conservan: `StageKey`, `StageStatus`, `Stage`, `Fuente`, `Eje`, `TendenciaCandidata`, `EJES`, `MIN_TENDENCIAS`, `MAX_TENDENCIAS`.

Ojo con el orden: `LandscapeWorkspace.tsx` importa `STAGES` y `Actividad`, y `page.tsx` importa `TENDENCIAS_DEMO`/`ACTIVIDAD_DEMO`. El proyecto queda sin compilar entre esta tarea y la 8. Está bien: se comitea igual (los tests unitarios pasan) y la 8 lo cierra. Si preferís no romper el build ni un commit, hacé las tareas 6, 7 y 8 y comiteá al final.

- [ ] **Step 1: Escribe los tests que fallan**

Crea `src/lib/landscape/stages.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildStages, textoActividad, haceCuanto, STAGE_ORDER } from './stages'

describe('buildStages', () => {
  it('arma las seis etapas en orden con etiqueta y estado', () => {
    const stages = buildStages([
      { stage: 'setup', status: 'aprobada' },
      { stage: 'contexto', status: 'aprobada' },
      { stage: 'tendencias', status: 'en_curso' },
      { stage: 'panorama', status: 'pendiente' },
      { stage: 'diagnostico', status: 'no_aplica' },
      { stage: 'entrega', status: 'pendiente' },
    ])
    expect(stages.map(s => s.key)).toEqual(STAGE_ORDER)
    expect(stages[1].label).toBe('Contexto del sector')
    expect(stages[2].status).toBe('en_curso')
    expect(stages[4].hint).toBe('solo rebranding')
    expect(stages[0].hint).toBeUndefined()
  })

  it('lo que no viene queda pendiente', () => {
    const stages = buildStages([{ stage: 'setup', status: 'aprobada' }])
    expect(stages).toHaveLength(6)
    expect(stages.find(s => s.key === 'entrega')!.status).toBe('pendiente')
  })
})

describe('textoActividad', () => {
  it('describe qué pasó, en español y con el nombre de la etapa', () => {
    expect(textoActividad({ tipo: 'guardado', stage: 'tendencias' }))
      .toBe('Guardó un borrador de Tendencias')
    expect(textoActividad({ tipo: 'aprobado', stage: 'contexto' }))
      .toBe('Aprobó Contexto del sector')
  })
})

describe('haceCuanto', () => {
  const ahora = new Date('2026-07-29T12:00:00Z')
  const antes = (ms: number) => new Date(ahora.getTime() - ms)
  const MIN = 60_000, HORA = 60 * MIN, DIA = 24 * HORA

  it('traduce distancias a lenguaje del panel', () => {
    expect(haceCuanto(antes(30_000), ahora)).toBe('recién')
    expect(haceCuanto(antes(5 * MIN), ahora)).toBe('hace 5 min')
    expect(haceCuanto(antes(2 * HORA), ahora)).toBe('hace 2 h')
    expect(haceCuanto(antes(30 * HORA), ahora)).toBe('ayer')
    expect(haceCuanto(antes(4 * DIA), ahora)).toBe('hace 4 días')
  })

  it('más de una semana muestra la fecha', () => {
    expect(haceCuanto(new Date('2026-07-02T09:00:00Z'), ahora)).toBe('2 jul')
  })
})
```

- [ ] **Step 2: Corre los tests para verificar que fallan**

Run: `npx vitest run src/lib/landscape/stages.test.ts`
Expected: FAIL — no existe el export `buildStages`.

- [ ] **Step 3: Reescribe el módulo de dominio**

Reemplaza el contenido completo de `src/lib/landscape/stages.ts` por:

```ts
/**
 * Modelo de las etapas del Landscape (fase 2).
 * Ver docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md
 *
 * Este módulo no toca la base: traduce el estado que devuelve el store a lo que
 * el panel necesita mostrar. Funciones puras, testeables sin Postgres.
 */

export type StageKey = 'setup' | 'contexto' | 'tendencias' | 'panorama' | 'diagnostico' | 'entrega'

export type StageStatus = 'pendiente' | 'en_curso' | 'aprobada' | 'no_aplica'

export interface Stage {
  key: StageKey
  label: string
  /** Nota chica bajo el nombre, para condicionales. */
  hint?: string
  status: StageStatus
}

export interface Fuente {
  /** Nombre del documento en el archivo del estudio. */
  doc: string
  pagina?: number
}

export type Eje = 'Marca' | 'Estrategia' | 'Comunicación'

export interface TendenciaCandidata {
  id: string
  eje: Eje
  titulo: string
  descripcion: string
  fuentes: Fuente[]
}

/** El orden del proceso, de docs/fase2/fase-2-investigacion-landscape.md. */
export const STAGE_ORDER: StageKey[] = ['setup', 'contexto', 'tendencias', 'panorama', 'diagnostico', 'entrega']

export const STAGE_LABEL: Record<StageKey, string> = {
  setup: 'Setup',
  contexto: 'Contexto del sector',
  tendencias: 'Tendencias',
  panorama: 'Panorama de categoría',
  diagnostico: 'Diagnóstico',
  entrega: 'Entrega',
}

export const STAGE_HINT: Partial<Record<StageKey, string>> = {
  diagnostico: 'solo rebranding',
}

/** Cuántas tendencias exige el proceso antes de dejar avanzar la etapa. */
export const MIN_TENDENCIAS = 4
export const MAX_TENDENCIAS = 5

export const EJES: Eje[] = ['Marca', 'Estrategia', 'Comunicación']

/** Las seis etapas siempre, aunque el proyecto todavía no tenga ninguna fila. */
export function buildStages(estado: { stage: StageKey; status: StageStatus }[]): Stage[] {
  const porEtapa = new Map(estado.map(e => [e.stage, e.status]))
  return STAGE_ORDER.map(key => ({
    key,
    label: STAGE_LABEL[key],
    hint: STAGE_HINT[key],
    status: porEtapa.get(key) ?? 'pendiente',
  }))
}

export function textoActividad(e: { tipo: 'guardado' | 'aprobado'; stage: StageKey }): string {
  return e.tipo === 'aprobado'
    ? `Aprobó ${STAGE_LABEL[e.stage]}`
    : `Guardó un borrador de ${STAGE_LABEL[e.stage]}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Tiempo relativo corto, para la columna de actividad. */
export function haceCuanto(fecha: Date, ahora: Date = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - fecha.getTime()) / 60_000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return `${fecha.getUTCDate()} ${MESES[fecha.getUTCMonth()]}`
}
```

- [ ] **Step 4: Corre los tests para verificar que pasan**

Run: `npx vitest run src/lib/landscape/stages.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/landscape/stages.ts src/lib/landscape/stages.test.ts
git commit -m "$(cat <<'EOF'
feat(landscape): el modelo del panel deja de tener datos de demo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
EOF
)"
```

---

### Task 7: La ruta de escritura del panel

**Files:**
- Create: `src/app/api/projects/[id]/landscape/[stage]/route.ts`

**Interfaces:**
- Consumes: `saveLandscapeVersion`, `approveLandscapeVersion`, `selectTendencias` (Tareas 2–4); `STAGE_ORDER` (Tarea 6); `db` de `@/lib/db/client`.
- Produces: `POST /api/projects/:id/landscape/:stage` con tres acciones en el body:
  - `{ accion: 'guardar', content: unknown, autor?: string }` → 200 con la versión creada.
  - `{ accion: 'aprobar', versionId: string }` → 200 con la versión aprobada.
  - `{ accion: 'seleccionar-tendencias', seleccionadas: string[], autor?: string }` → 200 con la versión aprobada. Solo válido en `stage = 'tendencias'`.
  - Errores: 400 con `{ error: string }` para etapa desconocida, acción desconocida o validación del gate.

Una sola ruta con discriminador en vez de tres rutas: evita el conflicto entre un segmento dinámico `[stage]` y hermanos literales, y deja un único lugar donde validar la etapa. Sigue el patrón de `src/app/api/projects/[id]/deliverable/route.ts` (POST, `NextResponse.json`, error como string).

> Nota de seguridad: esta ruta queda **sin autenticación**, igual que el resto del panel — es deuda ya aceptada y anotada (`melo-banana-pendientes-seguridad`). La autenticación endurecida es requisito del **servidor MCP**, que es otro plan, porque ese sí se expone a internet.

- [ ] **Step 1: Escribe la ruta**

Crea `src/app/api/projects/[id]/landscape/[stage]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { saveLandscapeVersion, approveLandscapeVersion, selectTendencias } from '@/lib/db/store'
import { STAGE_ORDER, type StageKey } from '@/lib/landscape/stages'

export async function POST(req: Request, { params }: { params: Promise<{ id: string; stage: string }> }) {
  const { id, stage } = await params
  if (!STAGE_ORDER.includes(stage as StageKey))
    return NextResponse.json({ error: `Etapa desconocida: ${stage}` }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'El body tiene que ser JSON' }, { status: 400 })
  }

  try {
    switch (body.accion) {
      case 'guardar': {
        // Desde el panel el autor siempre es humano. Claude escribe por MCP, no por acá.
        const version = await saveLandscapeVersion(db, id, stage as StageKey, {
          content: body.content,
          author: 'humano',
          authorLabel: typeof body.autor === 'string' ? body.autor : undefined,
        })
        return NextResponse.json(version)
      }
      case 'aprobar': {
        if (typeof body.versionId !== 'string')
          return NextResponse.json({ error: 'Falta versionId' }, { status: 400 })
        return NextResponse.json(await approveLandscapeVersion(db, body.versionId))
      }
      case 'seleccionar-tendencias': {
        if (stage !== 'tendencias')
          return NextResponse.json({ error: 'La selección de tendencias solo aplica a la etapa Tendencias' }, { status: 400 })
        if (!Array.isArray(body.seleccionadas))
          return NextResponse.json({ error: 'seleccionadas tiene que ser una lista de ids' }, { status: 400 })
        const version = await selectTendencias(
          db, id, body.seleccionadas as string[],
          typeof body.autor === 'string' ? body.autor : undefined,
        )
        return NextResponse.json(version)
      }
      default:
        return NextResponse.json({ error: `Acción desconocida: ${String(body.accion)}` }, { status: 400 })
    }
  } catch (e) {
    // Los errores del gate (4 o 5 tendencias, ids que no existen) son culpa del pedido.
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}
```

- [ ] **Step 2: Verifica que compila y que el lint pasa**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores en `src/app/api/projects/[id]/landscape/[stage]/route.ts`.

> Si `tsc` se queja de `LandscapeWorkspace.tsx` o `landscape/page.tsx` por `STAGES`/`TENDENCIAS_DEMO`, es lo esperado tras la Tarea 6 y lo arregla la Tarea 8. Verifica solo que no haya errores en la ruta nueva.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/[id]/landscape
git commit -m "$(cat <<'EOF'
feat(landscape): ruta de escritura del panel con guardar, aprobar y seleccionar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
EOF
)"
```

---

### Task 8: El panel, con datos reales

**Files:**
- Modify: `src/app/admin/projects/[id]/landscape/page.tsx`
- Modify: `src/app/admin/projects/[id]/landscape/LandscapeWorkspace.tsx`
- Create: `src/app/admin/projects/[id]/landscape/ContenidoEtapa.tsx`

**Interfaces:**
- Consumes: `landscapeState`, `listLandscapeActivity`, `TendenciasContent` (Tareas 4–5); `buildStages`, `textoActividad`, `haceCuanto` (Tarea 6); `POST /api/projects/:id/landscape/:stage` (Tarea 7).
- Produces: nada que consuman otras tareas.

**El diseño visual no cambia.** Las clases de Tailwind, los colores, los tamaños y el copy que ya están en `LandscapeWorkspace.tsx` se conservan tal cual. Lo único que cambia: las etapas y la actividad vienen por props, la selección de tendencias arranca de lo ya aprobado, el botón escribe, y las etapas sin contenido muestran su versión guardada en vez de un cartel fijo.

- [ ] **Step 1: Crea el render genérico de contenido de etapa**

Claude va a guardar formas distintas por etapa (cifras con fuente en `contexto`, fichas por marca en `panorama`). No hay un esquema cerrado para todas, así que el panel las muestra de forma legible sin conocerlas de antemano.

Crea `src/app/admin/projects/[id]/landscape/ContenidoEtapa.tsx`:

```tsx
/**
 * El `content` de una etapa es jsonb libre: cada etapa guarda lo suyo y no hay
 * un esquema cerrado. Esto lo muestra legible sin conocer la forma de antemano.
 */

function humanizar(clave: string): string {
  const conEspacios = clave.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1)
}

function Valor({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined || valor === '')
    return <p className="text-[13px] text-[#b3ab9b]">Sin datos</p>

  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean')
    return <p className="text-[13.5px] leading-relaxed text-[#4a4438]">{String(valor)}</p>

  if (Array.isArray(valor))
    return (
      <ul className="space-y-1.5">
        {valor.map((item, i) => (
          <li key={i} className="text-[13.5px] leading-relaxed text-[#4a4438]">
            {typeof item === 'object' && item !== null
              ? <Campos objeto={item as Record<string, unknown>} />
              : String(item)}
          </li>
        ))}
      </ul>
    )

  return <Campos objeto={valor as Record<string, unknown>} />
}

function Campos({ objeto }: { objeto: Record<string, unknown> }) {
  return (
    <div className="space-y-2 rounded-xl bg-[#faf7ee] p-3">
      {Object.entries(objeto).map(([clave, valor]) => (
        <div key={clave}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a59c89]">{humanizar(clave)}</p>
          <div className="mt-0.5"><Valor valor={valor} /></div>
        </div>
      ))}
    </div>
  )
}

export function ContenidoEtapa({ content }: { content: unknown }) {
  if (typeof content !== 'object' || content === null)
    return <Valor valor={content} />

  return (
    <div className="space-y-5">
      {Object.entries(content as Record<string, unknown>).map(([clave, valor]) => (
        <section key={clave}>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">{humanizar(clave)}</h3>
          <Valor valor={valor} />
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Conecta la página a la base**

Reemplaza el contenido de `src/app/admin/projects/[id]/landscape/page.tsx` por:

```tsx
import { db } from '@/lib/db/client'
import {
  getProjectWithSessions, getDeliverable,
  landscapeState, listLandscapeActivity, type TendenciasContent,
} from '@/lib/db/store'
import { derivePhases } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { AdminShell } from '@/components/AdminShell'
import { ProjectHeader } from '@/components/ProjectHeader'
import { buildStages, haceCuanto, textoActividad } from '@/lib/landscape/stages'
import { LandscapeWorkspace } from './LandscapeWorkspace'

export const dynamic = 'force-dynamic'

export default async function LandscapeView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return (
    <AdminShell activeProjectId={id}>
      <p className="pt-16 text-center text-[15px] text-[#8a8170]">Proyecto no encontrado.</p>
    </AdminShell>
  )

  const deliverable = await getDeliverable(db, id)
  const rawSessions = project.sessions as { status?: string | null }[]
  const phases = derivePhases(id, projectSignals({ sessions: rawSessions, tieneEntregable: !!deliverable }))

  const estado = await landscapeState(db, id)
  const stages = buildStages(estado)

  const etapaTendencias = estado.find(e => e.stage === 'tendencias')!
  const tendenciasContent = etapaTendencias.actual?.content as TendenciasContent | undefined

  // Se formatea el tiempo en el servidor para que no baile entre servidor y cliente.
  const ahora = new Date()
  const actividad = (await listLandscapeActivity(db, id)).map(e => ({
    id: e.id,
    autor: e.autor,
    quien: e.quien,
    texto: textoActividad(e),
    cuando: haceCuanto(e.cuando, ahora),
  }))

  const contenidoPorEtapa = Object.fromEntries(
    estado.map(e => [e.stage, e.actual ? { content: e.actual.content, aprobada: !!e.actual.approvedAt } : null]),
  )

  return (
    <AdminShell activeProjectId={id}>
      <div className="space-y-8">
      <ProjectHeader name={project.name} phases={phases} active="landscape" />
      <LandscapeWorkspace
        projectId={id}
        stages={stages}
        tendencias={tendenciasContent?.candidatas ?? []}
        seleccionAprobada={tendenciasContent?.seleccionadas ?? []}
        tendenciasAprobadas={etapaTendencias.aprobada}
        contenidoPorEtapa={contenidoPorEtapa}
        actividad={actividad}
      />
      </div>
    </AdminShell>
  )
}
```

- [ ] **Step 3: Conecta el workspace**

En `src/app/admin/projects/[id]/landscape/LandscapeWorkspace.tsx`, aplica estos cambios y **nada más** (el resto de los componentes — `StageDot`, `StageRow`, `FuentePill`, `TendenciaCard`, `ActividadItem` — quedan intactos):

1. Cambia el bloque de imports de arriba (líneas 1-7) por:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  EJES, MIN_TENDENCIAS, MAX_TENDENCIAS,
  type Stage, type StageKey, type StageStatus, type TendenciaCandidata,
} from '@/lib/landscape/stages'
import { ContenidoEtapa } from './ContenidoEtapa'

/** Lo que la página le pasa al panel: ya formateado, sin fechas crudas. */
export interface ActividadVista {
  id: string
  autor: 'claude' | 'humano'
  quien?: string
  texto: string
  cuando: string
}

type ContenidoEtapaVista = { content: unknown; aprobada: boolean } | null
```

2. En `ActividadItem`, cambia el tipo del prop de `Actividad` a `ActividadVista`:

```tsx
function ActividadItem({ a }: { a: ActividadVista }) {
```

3. Reemplaza la firma y el cuerpo de `LandscapeWorkspace` (desde `export function LandscapeWorkspace` hasta el cierre del componente) por:

```tsx
export function LandscapeWorkspace({
  projectId,
  stages,
  tendencias,
  seleccionAprobada,
  tendenciasAprobadas,
  contenidoPorEtapa,
  actividad,
}: {
  projectId: string
  stages: Stage[]
  tendencias: TendenciaCandidata[]
  seleccionAprobada: string[]
  tendenciasAprobadas: boolean
  contenidoPorEtapa: Record<string, ContenidoEtapaVista>
  actividad: ActividadVista[]
}) {
  const router = useRouter()
  const [stage, setStage] = useState<StageKey>(
    stages.find(s => s.status === 'en_curso')?.key ?? 'tendencias',
  )
  const [selected, setSelected] = useState<string[]>(seleccionAprobada)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) =>
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length >= MAX_TENDENCIAS ? prev : [...prev, id],
    )

  const listo = selected.length >= MIN_TENDENCIAS && selected.length <= MAX_TENDENCIAS
  const tope = selected.length >= MAX_TENDENCIAS

  async function aprobarSeleccion() {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/landscape/tendencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'seleccionar-tendencias', seleccionadas: selected }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'No se pudo guardar')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const etapaActual = stages.find(s => s.key === stage)
  const contenido = contenidoPorEtapa[stage]
  const hayLongList = tendencias.length > 0

  return (
    <div className="grid gap-6 lg:grid-cols-[176px_minmax(0,1fr)_248px]">

      {/* Etapas */}
      <nav aria-label="Etapas del landscape" className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">Etapas</p>
        <div className="space-y-0.5">
          {stages.map(s => (
            <StageRow key={s.key} stage={s} active={s.key === stage} onSelect={() => setStage(s.key)} />
          ))}
        </div>
      </nav>

      {/* Contenido de la etapa */}
      <section className="min-w-0">
        {stage === 'tendencias' && hayLongList ? (
          <>
            <header className="mb-5">
              <h2 className="font-serif text-xl font-medium text-ink">Tendencias</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#8a8170]">
                Long list propuesta por Claude desde el archivo del estudio. Elige entre {MIN_TENDENCIAS} y {MAX_TENDENCIAS};
                cada una se desarrolla después en tres diapositivas.
              </p>
            </header>

            {EJES.map(eje => {
              const delEje = tendencias.filter(t => t.eje === eje)
              if (delEje.length === 0) return null
              return (
                <div key={eje} className="mb-6">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a59c89]">Eje · {eje}</p>
                  <div className="space-y-2.5">
                    {delEje.map(t => (
                      <TendenciaCard key={t.id} t={t} selected={selected.includes(t.id)} onToggle={() => toggle(t.id)} />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Gate humano: bloquea el avance de la etapa */}
            <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-5 py-3.5 shadow-[0_8px_24px_-12px_rgba(26,21,16,0.5)]">
              <p className="text-[13px] text-white/85">
                <span className="font-semibold text-white tabular-nums">{selected.length}</span> de {MIN_TENDENCIAS}–{MAX_TENDENCIAS} seleccionadas
                <span className="text-white/50"> · decide el equipo, no el agente</span>
                {tope && <span className="ml-1 text-[var(--banana)]">Llegaste al máximo.</span>}
                {error && <span className="ml-1 text-[#ff9c8a]">{error}</span>}
              </p>
              <button
                type="button"
                disabled={!listo || guardando}
                onClick={aprobarSeleccion}
                className="rounded-xl bg-[var(--banana)] px-4 py-2 text-[13px] font-semibold text-[#1a1510] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {guardando ? 'Guardando…' : tendenciasAprobadas ? 'Actualizar selección' : 'Aprobar y desarrollar'}
              </button>
            </div>
          </>
        ) : contenido ? (
          <>
            <header className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-xl font-medium text-ink">{etapaActual?.label}</h2>
              <span className="text-[11px] text-[#a59c89]">
                {contenido.aprobada ? 'Versión aprobada' : 'Borrador sin aprobar'}
              </span>
            </header>
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <ContenidoEtapa content={contenido.content} />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-black/5 bg-white p-10 text-center shadow-sm">
            <h2 className="font-serif text-lg font-medium text-ink">{etapaActual?.label}</h2>
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-[#8a8170]">
              Esta etapa todavía no tiene una versión guardada. Cuando el equipo la trabaje en Claude,
              el resultado aparece aquí para revisar y aprobar.
            </p>
          </div>
        )}
      </section>

      {/* Actividad desde Claude */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5aa469]" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b6155]">Conectado a Claude</p>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-[#8a8170]">
            Este proyecto y el archivo del estudio están disponibles como contexto en las conversaciones del equipo.
            No hay que volver a subir nada.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">Actividad</p>
          {actividad.length === 0 ? (
            <p className="mt-2 text-[12px] leading-relaxed text-[#a59c89]">Todavía no pasó nada en este proyecto.</p>
          ) : (
            <ul className="mt-1 divide-y divide-black/5">
              {actividad.map(a => <ActividadItem key={a.id} a={a} />)}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
```

- [ ] **Step 4: Verifica que compila, lint y toda la suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; todos los tests en verde.

- [ ] **Step 5: Verifica la tipografía por bytes**

```bash
rg -n $'–' 'src/app/admin/projects/[id]/landscape/LandscapeWorkspace.tsx'   # guión medio
rg -n $'…' 'src/app/admin/projects/[id]/landscape/LandscapeWorkspace.tsx'   # puntos suspensivos
```

Expected: la primera encuentra `de {MIN_TENDENCIAS}–{MAX_TENDENCIAS} seleccionadas`; la segunda, `Guardando…`. Si alguna sale vacía, el carácter se aplanó al escribir el archivo: corrígelo antes de comitear.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/projects/\[id\]/landscape
git commit -m "$(cat <<'EOF'
feat(landscape): el panel lee y escribe el estado real del proyecto

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
EOF
)"
```

---

### Task 9: Verlo funcionando

**Files:**
- Create: `scripts/seed-landscape.ts`
- Modify: `package.json` (sección `scripts`)

**Interfaces:**
- Consumes: `saveLandscapeVersion`, `approveLandscapeVersion`, `setStageStatus` (Tareas 2-3); `listProjects` (ya existe).
- Produces: `npm run seed:landscape -- <nombre-del-proyecto>`.

Sin esto no hay forma de ver el panel con contenido hasta que el MCP exista. El seed carga la misma long list que era la demo, ahora como datos reales en la base.

- [ ] **Step 1: Escribe el seed**

Crea `scripts/seed-landscape.ts`:

```ts
/**
 * Carga un landscape de ejemplo en un proyecto existente, para poder ver el panel
 * funcionando antes de que exista el MCP. Uso:
 *
 *   npm run seed:landscape -- "Fruta Viva"
 */
import { db } from '../src/lib/db/client'
import {
  listProjects, normalizeCompanyName,
  saveLandscapeVersion, approveLandscapeVersion, setStageStatus,
} from '../src/lib/db/store'

const CONTEXTO = {
  datos_generales: 'La categoría de alimentos frescos en Colombia creció 7,4 % en 2025, por encima del promedio de consumo masivo.',
  cifras_relevantes: [
    { dato: '7,4 % de crecimiento anual', fuente: 'RADDAR Reports', anio: 2025 },
    { dato: '38 % de los hogares compra fresco al menos 3 veces por semana', fuente: 'Kantar Colombia', anio: 2025 },
  ],
  drivers_de_cambio: [
    'Precio del transporte y su efecto en la cadena de frío',
    'Migración del canal tradicional al d2c por suscripción',
  ],
  retos_del_sector: ['Merma en el último tramo', 'Fragmentación de la oferta de origen'],
}

const TENDENCIAS = {
  candidatas: [
    {
      id: 't1', eje: 'Marca',
      titulo: 'Longevidad como aspiración, no como miedo',
      descripcion: 'La alimentación saludable deja de venderse como prevención del deterioro y pasa a venderse como ampliación de la vida activa.',
      fuentes: [
        { doc: 'Mintel 2026 Global Food and Drink Predictions', pagina: 31 },
        { doc: 'WGSN Generation Cheat Sheet', pagina: 12 },
      ],
    },
    {
      id: 't2', eje: 'Marca',
      titulo: 'El origen como identidad, no como sello',
      descripcion: 'La procedencia deja de ser un ícono en el empaque y se convierte en el relato central de la marca: quién lo cultiva y dónde.',
      fuentes: [{ doc: 'Whole Foods Market Trends 2026' }, { doc: 'RADDAR Reports octubre 2025', pagina: 9 }],
    },
    {
      id: 't3', eje: 'Estrategia',
      titulo: 'Transparencia radical de la cadena',
      descripcion: 'Publicar precios, márgenes y condiciones del productor como diferencial competitivo y no como obligación regulatoria.',
      fuentes: [{ doc: 'Good Deed Economy · TrendWatching', pagina: 24 }],
    },
    {
      id: 't4', eje: 'Estrategia',
      titulo: 'Conveniencia sin renunciar a lo fresco',
      descripcion: 'El formato listo para consumir deja de asociarse a lo procesado; gana quien resuelve la fricción sin perder la percepción de fresco.',
      fuentes: [
        { doc: 'VML The Future Shopper Report 2025', pagina: 44 },
        { doc: 'Mintel 2026 Global Consumer Predictions', pagina: 18 },
      ],
    },
    {
      id: 't5', eje: 'Comunicación',
      titulo: 'El productor como creador',
      descripcion: 'La autoridad de la marca se construye en formato corto y en primera persona, desde el campo y no desde el estudio.',
      fuentes: [{ doc: 'Social Media Study 2026', pagina: 37 }, { doc: '2026 Social Trends Report' }],
    },
    {
      id: 't6', eje: 'Comunicación',
      titulo: 'Vocabulario sin promesa',
      descripcion: 'Retirada del lenguaje de milagro nutricional por presión regulatoria y por fatiga del consumidor.',
      fuentes: [{ doc: 'RADDAR Reports octubre 2025', pagina: 22 }],
    },
  ],
}

async function main() {
  const nombre = process.argv[2]
  if (!nombre) {
    console.error('Falta el nombre del proyecto. Uso: npm run seed:landscape -- "Fruta Viva"')
    process.exit(1)
  }

  const proyectos = await listProjects(db)
  const objetivo = proyectos.find(
    (p: { id: string; name: string }) => normalizeCompanyName(p.name) === normalizeCompanyName(nombre),
  )
  if (!objetivo) {
    console.error(`No encontré el proyecto "${nombre}". Los que hay:`)
    for (const p of proyectos as { name: string }[]) console.error(`  · ${p.name}`)
    process.exit(1)
  }

  const setup = await saveLandscapeVersion(db, objetivo.id, 'setup', {
    content: { carpeta_dropbox: `/Clientes/${objetivo.name}/Fase 01 Landscape`, deck: `${objetivo.name} — Landscape.key` },
    author: 'claude',
  })
  await approveLandscapeVersion(db, setup.id)

  const contexto = await saveLandscapeVersion(db, objetivo.id, 'contexto', { content: CONTEXTO, author: 'claude' })
  await approveLandscapeVersion(db, contexto.id)

  await saveLandscapeVersion(db, objetivo.id, 'tendencias', { content: TENDENCIAS, author: 'claude' })
  await setStageStatus(db, objetivo.id, 'diagnostico', 'no_aplica')

  console.log(`Listo. Abrí /admin/projects/${objetivo.id}/landscape`)
}

main()
```

- [ ] **Step 2: Agrega el script a package.json**

En la sección `"scripts"`, después de `"db:rm-project"`:

```json
    "seed:landscape": "tsx --env-file=.env scripts/seed-landscape.ts"
```

(Acordate de la coma en la línea anterior.)

- [ ] **Step 3: Córrelo contra un proyecto real**

```bash
npm run db:projects          # lista los proyectos que hay
npm run seed:landscape -- "Fruta Viva"
```

Expected: imprime la URL del panel.

- [ ] **Step 4: Verifica en el navegador**

```bash
npm run dev
```

Abre la URL que imprimió el seed y comprueba:
- Setup y Contexto del sector aparecen con punto lleno (aprobadas).
- Tendencias aparece en curso, con las 6 candidatas agrupadas por eje.
- Diagnóstico aparece apagado, con la nota “solo rebranding”.
- Contexto del sector muestra las cifras con fuente y año, legibles.
- La columna de actividad muestra los guardados y las aprobaciones con tiempo relativo.
- Seleccionar 4 tendencias habilita el botón; al apretarlo la etapa pasa a aprobada y la actividad suma una línea. Seleccionar 3 lo deshabilita.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-landscape.ts package.json
git commit -m "$(cat <<'EOF'
feat(landscape): seed para ver el panel con datos reales

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bf3JSmegz7Rm7sBWCicARQ
EOF
)"
```

---

## Qué queda afuera de este plan

Estos son los otros dos subsistemas del spec. Cada uno merece su plan y ambos se apoyan en lo que construye este:

1. **Servidor MCP** — las seis herramientas (`catalogo_archivo`, `listar_proyectos`, `contexto_proyecto`, `traer_documento`, `guardar_etapa`, `estado_landscape`). `guardar_etapa` es `saveLandscapeVersion` con `author: 'claude'`, y `estado_landscape` es `landscapeState`: ya existen. Requiere autenticación endurecida desde el día uno (401 sin credencial válida, sin filtrar existencia de proyectos) porque expone datos de marcas de terceros a internet.
2. **Catálogo del archivo del estudio** — tabla de documentos, extracción de texto con `pdftotext` página por página, y la carga inicial. Sin LLM.

También queda pendiente del spec, sin plan todavía: la versión post-taller de la propuesta de valor sobre `deliverables`, con el mismo mecanismo de versiones.
