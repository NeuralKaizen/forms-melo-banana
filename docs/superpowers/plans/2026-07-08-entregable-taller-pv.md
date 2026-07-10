# Entregable del Taller de Propuesta de Valor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desde las entrevistas conversacionales de un proyecto (empresa), generar automáticamente el insumo de 5 partes del Taller de Propuesta de Valor y mostrarlo en el panel admin, honrando la "regla de oro" (dato del cliente vs. propuesta del equipo vs. pendiente del taller).

**Architecture:** Un módulo nuevo `src/lib/deliverable/` con 5 pasos segmentados (una llamada Claude enfocada por paso) orquestados secuencialmente por un `generator`. Los datos se agregan **por proyecto** (N respondientes), agrupando sesiones por `company` normalizado. Se persiste un `deliverable` por proyecto en JSONB, con `generatedAt` por parte para regenerar partes sueltas. El panel admin pasa a listar proyectos y renderiza las 4 partes visibles con el marcado de origen.

**Tech Stack:** Next.js 16 (App Router, RSC + route handlers), Drizzle ORM (neon-http en prod, pglite en test), `@anthropic-ai/sdk` vía OpenRouter (`anthropic/claude-sonnet-4.6`), Vitest, Tailwind.

## Global Constraints

- **Regla de oro (verbatim del spec):** el análisis se construye sobre lo que el cliente dijo, no sobre lo que imaginamos. Lo que la entrevista no cubre NO se inventa: se marca `pendiente`. Lo que aporta el equipo (referentes, ejes, posición ideal) se marca `equipo`, nunca como dato del cliente.
- **Marcado de origen obligatorio:** cada ítem/bloque generado lleva `origen: 'cliente' | 'equipo' | 'pendiente'`. El esquema JSON lo exige y el panel lo renderiza distinto.
- **Agregación por proyecto, no por sesión.** El motor recibe una lista de respondientes (1..9). Con N=1 no hay tensiones; el mismo motor funciona. Triangular: consenso = hecho; contradicción = tensión a nombrar (no promediar).
- **No se lee el `.md` en runtime.** El texto guía del skill se embebe como constantes versionadas en cada módulo de paso.
- **Modelo/cliente:** reusar el patrón de `src/lib/brief/service.ts` — `new Anthropic({ authToken: process.env.OPENROUTER_API_KEY!, baseURL: 'https://openrouter.ai/api/v1', defaultHeaders: { 'X-Title': 'Melo & Banana' } })`, modelo `'anthropic/claude-sonnet-4.6'`.
- **Tono del contenido generado:** español colombiano, directo, conserva vocabulario del cliente, sin lenguaje publicitario, con citas verbatim cuando se citen.
- **Ejecución síncrona** con estado de carga en el panel. 5 llamadas entran en el timeout de 300s de Vercel.
- **Normalización best-effort:** correr `ensureNormalized` por sesión antes de generar; usar `normalizedText ?? rawText`.

---

## File Structure

**Nuevos:**
- `src/lib/deliverable/schema.ts` — tipos (`Origen`, `Item`, las 5 partes, `Deliverable`, `PartKey`, `RespondentInput`).
- `src/lib/deliverable/prompt-preamble.ts` — preámbulo compartido + `formatRespondents` + instrucción de origen/triangulación.
- `src/lib/deliverable/llm.ts` — `callJson` (create + extracción de JSON + parseo + 1 reintento correctivo).
- `src/lib/deliverable/steps/personalidad.ts` — paso 0.
- `src/lib/deliverable/steps/problema.ts` — paso 1.
- `src/lib/deliverable/steps/competencia.ts` — paso 2.
- `src/lib/deliverable/steps/perfil.ts` — paso 3.
- `src/lib/deliverable/steps/propuesta-valor.ts` — paso 4.
- `src/lib/deliverable/generator.ts` — orquestación secuencial + regeneración por parte + aislamiento de fallos.
- `src/lib/deliverable/service.ts` — reúne respondientes del proyecto, llama al generador, persiste.
- `src/app/api/projects/[id]/deliverable/route.ts` — POST (completo y `?part=`).
- `src/app/api/sessions/[id]/route.ts` — PATCH (reasignar `project_id`).
- `src/app/admin/projects/[id]/page.tsx` — vista de proyecto (RSC).
- `src/app/admin/projects/[id]/DeliverablePanel.tsx` — client component (botones generar/regenerar + render).
- Tests: uno junto a cada módulo nuevo con lógica (`*.test.ts`).

**Modificados:**
- `src/lib/db/schema.ts` — add `projects`, `deliverables`; add `projectId` a `sessions`; remove `briefs`.
- `src/lib/db/testdb.ts` — DDL espejo (add projects/deliverables/project_id, remove briefs).
- `src/lib/db/store.ts` — add funciones de proyecto/deliverable; remove `saveBrief`/`getBrief`.
- `src/app/api/sessions/[id]/complete/route.ts` — auto-asignar a proyecto al completar.
- `src/app/admin/page.tsx` — listar proyectos en vez de sesiones sueltas.
- `src/app/admin/[sessionId]/page.tsx` — remover el bloque `getBrief`/render de brief.

**Eliminados (retiro del brief genérico, en pausa y sin uso):**
- `src/lib/brief/service.ts`, `generator.ts`, `prompt.ts`, `generator.test.ts`, `prompt.test.ts`.
- `src/app/api/sessions/[id]/brief/route.ts`.

> **NO tocar** `src/lib/pdf/*` (buildBriefView/BriefDocument): construye desde respuestas, no desde la tabla `briefs`. El PDF sigue funcionando.

---

## FASE A — Capa de datos

### Task A1: Schema — projects, deliverables, project_id; retirar briefs

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/testdb.ts:26-30` (bloque `CREATE TABLE briefs`)

**Interfaces:**
- Produces: tablas `projects` (`id`, `name`, `normalizedName`, `createdAt`), `deliverables` (`projectId` PK, `content` jsonb, `updatedAt`), y `sessions.projectId` (uuid nullable → `projects.id`).

- [ ] **Step 1: Reescribir `schema.ts`**

```ts
import { pgTable, uuid, text, timestamp, jsonb, unique } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),                        // nombre mostrado (marca)
  normalizedName: text('normalized_name').notNull(),   // clave de agrupación
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [unique('projects_normalized_name').on(t.normalizedName)])

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  company: text('company'),
  role: text('role'),
  email: text('email'),
  projectId: uuid('project_id').references(() => projects.id),
  status: text('status').notNull().default('in_progress'), // 'in_progress' | 'completed'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
})

export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  questionId: text('question_id').notNull(),
  rawText: text('raw_text').notNull(),
  normalizedText: text('normalized_text'),
  imageChoice: text('image_choice'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [unique('answers_session_question').on(t.sessionId, t.questionId)])

export const deliverables = pgTable('deliverables', {
  projectId: uuid('project_id').primaryKey().references(() => projects.id),
  content: jsonb('content').notNull(), // Deliverable (ver deliverable/schema.ts)
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

(El `export const briefs` desaparece por completo.)

- [ ] **Step 2: Actualizar la DDL de `testdb.ts`**

Reemplazar el bloque `CREATE TABLE briefs (...)` por:

```sql
    CREATE TABLE projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      normalized_name text NOT NULL UNIQUE,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE deliverables (
      project_id uuid PRIMARY KEY REFERENCES projects(id),
      content jsonb NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    );
```

Y en el `CREATE TABLE sessions (...)` agregar la columna `project_id uuid REFERENCES projects(id)` **antes** de `status`. Como `answers`/`sessions` se crean en el mismo `client.exec`, mover el `CREATE TABLE projects` para que quede **primero** (sessions lo referencia).

Orden final del `exec`: projects → sessions → answers → deliverables.

- [ ] **Step 3: Verificar que compila y los tests existentes no truenan por schema**

Run: `npm run test -- src/lib/db/store.test.ts`
Expected: los tests actuales de store que NO usan briefs siguen PASS. (Si algún test rompe por `briefs`, se arregla en Task A2.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/testdb.ts
git commit -m "feat(db): tablas projects/deliverables + project_id; retira briefs del schema"
```

---

### Task A2: Store — funciones de proyecto y deliverable; quitar brief

**Files:**
- Modify: `src/lib/db/store.ts`
- Test: `src/lib/db/store.test.ts`

**Interfaces:**
- Consumes: `sessions`, `answers`, `projects`, `deliverables` de `./schema`.
- Produces:
  - `normalizeCompanyName(name: string): string`
  - `findOrCreateProject(db, name: string): Promise<{ id: string; name: string; normalizedName: string }>`
  - `assignSessionToProject(db, sessionId: string, projectId: string): Promise<void>`
  - `listProjects(db): Promise<{ id: string; name: string }[]>`
  - `getProjectWithSessions(db, projectId: string): Promise<{ id: string; name: string; sessions: SessionRow[] } | null>`
  - `saveDeliverable(db, projectId: string, content: unknown): Promise<void>`
  - `getDeliverable(db, projectId: string): Promise<{ projectId: string; content: unknown; updatedAt: Date } | null>`
- Removes: `saveBrief`, `getBrief`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `store.test.ts` (importando lo nuevo desde `./store` y `projects`, `sessions` desde `./schema`):

```ts
import {
  createSession, saveAnswer, getSessionWithAnswers, completeSession, setNormalized,
  normalizeCompanyName, findOrCreateProject, assignSessionToProject,
  listProjects, getProjectWithSessions, saveDeliverable, getDeliverable,
} from './store'

describe('projects & deliverables', () => {
  it('normalizeCompanyName colapsa mayúsculas y espacios', () => {
    expect(normalizeCompanyName('  Going   SAS ')).toBe('going sas')
    expect(normalizeCompanyName('Cacao Hunters')).toBe('cacao hunters')
  })

  it('findOrCreateProject crea una vez y reusa por nombre normalizado', async () => {
    const db = await makeTestDb()
    const a = await findOrCreateProject(db, 'Going')
    const b = await findOrCreateProject(db, '  going  ')
    expect(b.id).toBe(a.id)
    expect((await listProjects(db))).toHaveLength(1)
  })

  it('assignSessionToProject agrupa sesiones y getProjectWithSessions las lista', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const s1 = await createSession(db, { company: 'Acme', name: 'Ana' })
    const s2 = await createSession(db, { company: 'Acme', name: 'Beto' })
    await assignSessionToProject(db, s1.id, p.id)
    await assignSessionToProject(db, s2.id, p.id)
    const pw = await getProjectWithSessions(db, p.id)
    expect(pw!.sessions).toHaveLength(2)
    expect(pw!.name).toBe('Acme')
  })

  it('saveDeliverable/getDeliverable persisten y hacen upsert', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveDeliverable(db, p.id, { problema: { data: { problemaMundo: 'x' }, meta: { generatedAt: 'T0' } } })
    let d = await getDeliverable(db, p.id)
    expect((d!.content as any).problema.data.problemaMundo).toBe('x')
    await saveDeliverable(db, p.id, { problema: { data: { problemaMundo: 'y' }, meta: { generatedAt: 'T1' } } })
    d = await getDeliverable(db, p.id)
    expect((d!.content as any).problema.data.problemaMundo).toBe('y')
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- src/lib/db/store.test.ts`
Expected: FAIL — funciones no definidas (`normalizeCompanyName is not a function`, etc.).

- [ ] **Step 3: Implementar en `store.ts`**

Cambiar el import de la línea 2 a:
```ts
import { sessions, answers, projects, deliverables } from './schema'
```
Borrar `saveBrief` y `getBrief`. Agregar al final:

```ts
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
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- src/lib/db/store.test.ts`
Expected: PASS (todos, viejos y nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/store.ts src/lib/db/store.test.ts
git commit -m "feat(store): findOrCreateProject/assignSession/saveDeliverable; retira brief store"
```

---

## FASE B — Motor de generación

### Task B1: schema.ts del deliverable (tipos) + preámbulo compartido

**Files:**
- Create: `src/lib/deliverable/schema.ts`
- Create: `src/lib/deliverable/prompt-preamble.ts`
- Test: `src/lib/deliverable/prompt-preamble.test.ts`

**Interfaces:**
- Produces (schema.ts):
  ```ts
  export type Origen = 'cliente' | 'equipo' | 'pendiente'
  export interface Item { texto: string; origen: Origen; cita?: string | null }
  export interface Personalidad { arquetipo: string; atributos: string[]; queNoQuiereSer: string[]; tensiones: string[] }
  export interface Problema { problemaMundo: string; problemaMarca: string; problemaConsumidor: Item[]; comoLoHacemos: Item[]; porQueRelevante: Item[] }
  export interface Eje { nombre: string; extremoIzquierdo: string; extremoDerecho: string; origen: Origen }
  export interface Referente { marca: string; tipo: string; origen: Origen }
  export interface Competencia { competidores: Item[]; otrosReferentes: Referente[]; ejes: Eje[]; posicionActual: Item; posicionIdeal: Item }
  export interface Perfil { jobs: Item[]; gains: Item[]; pains: Item[] }
  export interface FilaValor { job: string; solucion: string; comoSeResuelve: string; origen: Origen }
  export interface PropuestaValor { formula: { marca: string; verbo: string; razonDeSer: string; beneficioCentral: string }; filas: FilaValor[] }
  export type PartKey = 'personalidad' | 'problema' | 'competencia' | 'perfil' | 'propuestaValor'
  export interface PartMeta { generatedAt: string; error?: string | null }
  export interface Part<T> { data: T | null; meta: PartMeta }
  export interface Deliverable {
    personalidad?: Part<Personalidad>
    problema?: Part<Problema>
    competencia?: Part<Competencia>
    perfil?: Part<Perfil>
    propuestaValor?: Part<PropuestaValor>
  }
  export interface RespondentInput { respondentName: string; role: string; answers: { questionId: string; text: string; imageChoice?: string | null }[] }
  ```
- Produces (prompt-preamble.ts):
  - `PREAMBULO: string`
  - `ORIGEN_Y_TRIANGULACION: string`
  - `formatRespondents(respondents: RespondentInput[]): string`

- [ ] **Step 1: Crear `schema.ts`** con exactamente los tipos del bloque Interfaces de arriba.

- [ ] **Step 2: Escribir el test que falla** (`prompt-preamble.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from './prompt-preamble'
import type { RespondentInput } from './schema'

const R: RespondentInput[] = [
  { respondentName: 'Ana', role: 'Fundadora', answers: [
    { questionId: 'animal', text: 'un perro, leal', imageChoice: 'perro' },
    { questionId: 'estrategia', text: 'crecer en B2B' },
  ]},
  { respondentName: 'Beto', role: 'CM', answers: [
    { questionId: 'animal', text: 'un león', imageChoice: 'leon' },
  ]},
]

describe('preámbulo compartido', () => {
  it('el preámbulo trae rol, regla de oro y tono', () => {
    expect(PREAMBULO).toMatch(/estratega/i)
    expect(PREAMBULO).toMatch(/no.*invent/i)
    expect(PREAMBULO).toMatch(/colombiano/i)
  })
  it('la instrucción de origen exige cliente|equipo|pendiente y triangular', () => {
    expect(ORIGEN_Y_TRIANGULACION).toMatch(/cliente/); expect(ORIGEN_Y_TRIANGULACION).toMatch(/equipo/)
    expect(ORIGEN_Y_TRIANGULACION).toMatch(/pendiente/); expect(ORIGEN_Y_TRIANGULACION).toMatch(/tensi/i)
  })
  it('formatRespondents incluye nombre, cargo, la pregunta legible y la elección', () => {
    const out = formatRespondents(R)
    expect(out).toContain('Ana'); expect(out).toContain('Fundadora'); expect(out).toContain('Beto')
    expect(out).toMatch(/animal/i)              // prompt legible de la pregunta
    expect(out).toContain('un perro, leal')
    expect(out).toContain('perro')              // imageChoice
  })
})
```

- [ ] **Step 3: Correr y ver fallar**

Run: `npm run test -- src/lib/deliverable/prompt-preamble.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 4: Implementar `prompt-preamble.ts`**

```ts
import { SCRIPT } from '@/lib/script/questions'
import type { RespondentInput } from './schema'

const promptOf = (qid: string) =>
  SCRIPT.flatMap(s => s.questions).find(q => q.id === qid)?.prompt ?? qid

export const PREAMBULO = [
  'Sos estratega de marca en Melo & Banana. Convertís las respuestas crudas de las',
  'entrevistas proyectivas de un cliente en el insumo del Taller de Propuesta de Valor.',
  '',
  'REGLA DE ORO: el análisis se construye sobre lo que el cliente DIJO, no sobre lo que',
  'imaginás. Si el cliente no lo respondió, no existe todavía: se marca como pendiente del',
  'taller. Lo que aporte el equipo (referentes, ejes de comparación, posición ideal) se',
  'marca como propuesta del equipo, nunca como dato del cliente.',
  '',
  'TONO: español colombiano, directo y profesional. Conservá el vocabulario del cliente',
  '(si dice "queremos que la gente nos sienta cercanos", no lo traduzcas a jerga). Apoyá',
  'los puntos clave con citas textuales. Nada de lenguaje publicitario ni promesas',
  'grandilocuentes: esto es análisis, no aviso. Sin términos rebuscados (los del canvas',
  '—JTBD, gains, pains— sí se usan).',
].join('\n')

export const ORIGEN_Y_TRIANGULACION = [
  'MARCADO DE ORIGEN — cada ítem generado lleva "origen":',
  '- "cliente": lo dijo el cliente en la entrevista (idealmente con cita textual en "cita").',
  '- "equipo": lo propone el equipo de estrategia (referentes, ejes, posición ideal). Nunca',
  '  lo presentes como dato del cliente.',
  '- "pendiente": no salió en la entrevista y no lo inventás; queda para resolver en el taller.',
  '',
  'TRIANGULACIÓN entre respondientes: lo que casi todos repiten es señal fuerte (va como',
  'hecho). Donde se contradicen es una TENSIÓN a nombrar explícitamente, no a promediar ni',
  'esconder; muchas veces esa tensión ES el hallazgo. Con un solo respondiente no fuerces',
  'tensiones inexistentes.',
].join('\n')

export function formatRespondents(respondents: RespondentInput[]): string {
  return respondents.map((r, i) => {
    const head = `### Respondiente ${i + 1}: ${r.respondentName || 'sin nombre'} — ${r.role || 'cargo no indicado'}`
    const lines = r.answers.map(a =>
      `- ${promptOf(a.questionId)}\n  ${a.text}${a.imageChoice ? ` (eligió: ${a.imageChoice})` : ''}`)
    return [head, ...lines].join('\n')
  }).join('\n\n')
}
```

- [ ] **Step 5: Correr y ver pasar**

Run: `npm run test -- src/lib/deliverable/prompt-preamble.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/deliverable/schema.ts src/lib/deliverable/prompt-preamble.ts src/lib/deliverable/prompt-preamble.test.ts
git commit -m "feat(deliverable): tipos del entregable + preámbulo compartido (regla de oro, triangulación)"
```

---

### Task B2: llm.ts — helper de llamada JSON con reintento

**Files:**
- Create: `src/lib/deliverable/llm.ts`
- Test: `src/lib/deliverable/llm.test.ts`

**Interfaces:**
- Produces: `callJson<T>(client, prompt: string, maxTokens: number, validate: (o: unknown) => T): Promise<T>`
  - Hace `client.messages.create`, extrae el JSON (entre el primer `{` y el último `}`), parsea, valida. Si parseo/validación fallan, reintenta UNA vez agregando un mensaje correctivo. Si vuelve a fallar, `throw`.
- Consumes: un `client` con forma `{ messages: { create(args): Promise<{ content: {type:string;text?:string}[] }> } }` (compatible con `Anthropic`).

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest'
import { callJson } from './llm'

function fakeClient(responses: string[]) {
  let i = 0
  return { messages: { create: async () => ({ content: [{ type: 'text', text: responses[i++] }] }) } } as any
}
const validate = (o: any) => { if (typeof o?.ok !== 'boolean') throw new Error('shape'); return o as { ok: boolean } }

describe('callJson', () => {
  it('parsea JSON envuelto en texto', async () => {
    const c = fakeClient(['claro:\n{"ok": true}\ngracias'])
    expect(await callJson(c, 'p', 100, validate)).toEqual({ ok: true })
  })
  it('reintenta una vez ante JSON inválido y luego resuelve', async () => {
    const c = fakeClient(['no es json', '{"ok": false}'])
    expect(await callJson(c, 'p', 100, validate)).toEqual({ ok: false })
  })
  it('tira si falla dos veces', async () => {
    const c = fakeClient(['nope', 'tampoco'])
    await expect(callJson(c, 'p', 100, validate)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- src/lib/deliverable/llm.test.ts`
Expected: FAIL — `callJson` no existe.

- [ ] **Step 3: Implementar `llm.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'anthropic/claude-sonnet-4.6'

function extractJson(text: string): unknown {
  const start = text.indexOf('{'); const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON en la respuesta')
  return JSON.parse(text.slice(start, end + 1))
}

export async function callJson<T>(
  client: Anthropic,
  prompt: string,
  maxTokens: number,
  validate: (o: unknown) => T,
): Promise<T> {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [{ role: 'user', content: prompt }]
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({ model: MODEL, max_tokens: maxTokens, messages })
    const text = res.content.map((b: any) => (b.type === 'text' ? b.text : '')).join('')
    try {
      return validate(extractJson(text))
    } catch (e) {
      if (attempt === 1) throw new Error(`respuesta inválida tras reintento: ${String(e)}`)
      messages.push({ role: 'assistant', content: text })
      messages.push({ role: 'user', content: 'Esa respuesta no era JSON válido con la forma pedida. Devolvé SOLO el JSON, sin texto alrededor.' })
    }
  }
  throw new Error('unreachable')
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- src/lib/deliverable/llm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deliverable/llm.ts src/lib/deliverable/llm.test.ts
git commit -m "feat(deliverable): callJson con extracción de JSON y un reintento correctivo"
```

---

### Task B3: Paso 0 — personalidad

**Files:**
- Create: `src/lib/deliverable/steps/personalidad.ts`
- Test: `src/lib/deliverable/steps/personalidad.test.ts`

**Interfaces:**
- Produces:
  - `buildPersonalidadPrompt(respondents: RespondentInput[]): string`
  - `validatePersonalidad(o: unknown): Personalidad`
  - `runPersonalidad(client, respondents: RespondentInput[]): Promise<Personalidad>`
- Consumes: `PREAMBULO`, `ORIGEN_Y_TRIANGULACION`, `formatRespondents` (B1); `callJson` (B2).

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest'
import { buildPersonalidadPrompt, validatePersonalidad } from './personalidad'
import type { RespondentInput } from '../schema'

const R: RespondentInput[] = [
  { respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'animal', text: 'perro, leal', imageChoice: 'perro' }] },
  { respondentName: 'Beto', role: 'CM', answers: [{ questionId: 'genero', text: 'mujer', imageChoice: 'mujer' }] },
]

describe('paso personalidad', () => {
  it('el prompt trae preámbulo, respondientes y pide las metáforas proyectivas', () => {
    const p = buildPersonalidadPrompt(R)
    expect(p).toMatch(/estratega/i)          // preámbulo
    expect(p).toContain('Ana')               // respondientes
    expect(p).toMatch(/animal|color|género|olor|ciudad/i) // lectura proyectiva
    expect(p).toMatch(/arquetipo/i)
  })
  it('validatePersonalidad acepta forma correcta', () => {
    const ok = { arquetipo: 'cercano', atributos: ['leal'], queNoQuiereSer: ['frío'], tensiones: ['género mixto'] }
    expect(validatePersonalidad(ok)).toEqual(ok)
  })
  it('validatePersonalidad rechaza forma incorrecta', () => {
    expect(() => validatePersonalidad({ arquetipo: 'x' })).toThrow()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- src/lib/deliverable/steps/personalidad.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `personalidad.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk'
import type { Personalidad, RespondentInput } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { callJson } from '../llm'

const GUIA = [
  'PASO — LECTURA PROYECTIVA (personalidad de marca).',
  'La mitad de la entrevista son metáforas proyectivas (animal, color, género, edad, olor,',
  'estilo, ciudad). No son relleno: son la vía para sacar la personalidad sin que el cliente',
  'la racionalice.',
  '- Sintetizá cada metáfora a través de TODOS los respondientes, no una por una. Buscá el',
  '  patrón (si casi todos dicen "perro" → leal, social, cercano).',
  '- Leé el PORQUÉ, no solo la elección: el valor está en la justificación.',
  '- Nombrá las tensiones: si en género unos dicen hombre y otros mujer, no promedies;',
  '  interpretá (p. ej. "marca neutra, ni masculina ni femenina").',
  'Entregá: arquetipo/temperamento, atributos que se repiten, qué NO quiere ser la marca,',
  'y las tensiones a resolver en el taller.',
].join('\n')

export function buildPersonalidadPrompt(respondents: RespondentInput[]): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Respuestas de los respondientes', formatRespondents(respondents), '',
    'Devolvé SOLO JSON con esta forma:',
    '{"arquetipo": string, "atributos": string[], "queNoQuiereSer": string[], "tensiones": string[]}',
  ].join('\n')
}

export function validatePersonalidad(o: unknown): Personalidad {
  const p = o as any
  const arr = (x: unknown) => Array.isArray(x) && x.every(i => typeof i === 'string')
  if (typeof p?.arquetipo !== 'string' || !arr(p.atributos) || !arr(p.queNoQuiereSer) || !arr(p.tensiones))
    throw new Error('Personalidad con forma inválida')
  return { arquetipo: p.arquetipo, atributos: p.atributos, queNoQuiereSer: p.queNoQuiereSer, tensiones: p.tensiones }
}

export function runPersonalidad(client: Anthropic, respondents: RespondentInput[]): Promise<Personalidad> {
  return callJson(client, buildPersonalidadPrompt(respondents), 2000, validatePersonalidad)
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- src/lib/deliverable/steps/personalidad.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deliverable/steps/personalidad.ts src/lib/deliverable/steps/personalidad.test.ts
git commit -m "feat(deliverable): paso personalidad (lectura proyectiva)"
```

---

### Task B4: Paso 1 — problema (depende de personalidad)

**Files:**
- Create: `src/lib/deliverable/steps/problema.ts`
- Test: `src/lib/deliverable/steps/problema.test.ts`

**Interfaces:**
- Produces:
  - `buildProblemaPrompt(respondents: RespondentInput[], personalidad: Personalidad): string`
  - `validateProblema(o: unknown): Problema`
  - `runProblema(client, respondents, personalidad): Promise<Problema>`
- Consumes: B1, B2. Usa `Personalidad` como dependencia (su `queNoQuiereSer`/`arquetipo` alimentan "¿Cómo lo hacemos?").

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest'
import { buildProblemaPrompt, validateProblema } from './problema'
import type { RespondentInput, Personalidad } from '../schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'estrategia', text: 'crecer en B2B' }] }]
const PERS: Personalidad = { arquetipo: 'cercano', atributos: ['cálido'], queNoQuiereSer: ['frío', 'corporativo'], tensiones: [] }

describe('paso problema', () => {
  it('el prompt inyecta la personalidad (qué NO quiere ser) y pide los 5 bloques', () => {
    const p = buildProblemaPrompt(R, PERS)
    expect(p).toContain('corporativo')                 // viene de personalidad
    expect(p).toMatch(/mundo|consumidor/i)
    expect(p).toMatch(/cómo.*hacer/i)
    expect(p).toMatch(/relevante/i)
  })
  it('validateProblema acepta forma correcta con Items marcados', () => {
    const ok = {
      problemaMundo: 'p1', problemaMarca: 'p2',
      problemaConsumidor: [{ texto: 'no saben empezar', origen: 'cliente', cita: 'no sé por dónde' }],
      comoLoHacemos: [{ texto: 'marca cálida', origen: 'cliente' }],
      porQueRelevante: [{ texto: 'desbloquea crecimiento', origen: 'equipo' }],
    }
    expect(validateProblema(ok).problemaConsumidor[0].origen).toBe('cliente')
  })
  it('validateProblema rechaza origen inválido', () => {
    expect(() => validateProblema({ problemaMundo: 'a', problemaMarca: 'b',
      problemaConsumidor: [{ texto: 't', origen: 'inventado' }], comoLoHacemos: [], porQueRelevante: [] })).toThrow()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- src/lib/deliverable/steps/problema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `problema.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk'
import type { Problema, Personalidad, Item, RespondentInput, Origen } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { callJson } from '../llm'

const GUIA = [
  'PASO 1 — DECLARACIÓN DEL PROBLEMA. Definí el problema que la marca resuelve, en dos',
  'planos, y justificalo. Bloques:',
  '- problemaMundo: contexto y tensión que vive la gente/el mercado (un párrafo).',
  '- problemaMarca: qué le pasa puntualmente a ESTA marca, dónde está atascada (un párrafo).',
  '- problemaConsumidor: los dolores concretos de las personas/empresas, en sus palabras (ítems).',
  '- comoLoHacemos: la vía de solución + pistas de identidad y comunicación (tono, qué NO',
  '  quiere ser la marca, atributos a evitar). USÁ la lectura de personalidad de abajo (ítems).',
  '- porQueRelevante: qué se desbloquea, el impacto (ítems).',
].join('\n')

export const validarItems = (x: unknown): Item[] => {
  if (!Array.isArray(x)) throw new Error('se esperaba lista de Items')
  const ok: Origen[] = ['cliente', 'equipo', 'pendiente']
  return x.map((i: any) => {
    if (typeof i?.texto !== 'string' || !ok.includes(i?.origen)) throw new Error('Item inválido')
    return { texto: i.texto, origen: i.origen, cita: typeof i.cita === 'string' ? i.cita : null }
  })
}

export function buildProblemaPrompt(respondents: RespondentInput[], personalidad: Personalidad): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Lectura de personalidad (paso previo, ya sintetizada)',
    `Arquetipo: ${personalidad.arquetipo}. Atributos: ${personalidad.atributos.join(', ')}.`,
    `Qué NO quiere ser: ${personalidad.queNoQuiereSer.join(', ')}. Tensiones: ${personalidad.tensiones.join(', ') || 'ninguna'}.`,
    '', '## Respuestas de los respondientes', formatRespondents(respondents), '',
    'Devolvé SOLO JSON con esta forma (cada ítem: {"texto": string, "origen": "cliente"|"equipo"|"pendiente", "cita"?: string}):',
    '{"problemaMundo": string, "problemaMarca": string, "problemaConsumidor": Item[], "comoLoHacemos": Item[], "porQueRelevante": Item[]}',
  ].join('\n')
}

export function validateProblema(o: unknown): Problema {
  const p = o as any
  if (typeof p?.problemaMundo !== 'string' || typeof p?.problemaMarca !== 'string')
    throw new Error('Problema: párrafos faltantes')
  return {
    problemaMundo: p.problemaMundo, problemaMarca: p.problemaMarca,
    problemaConsumidor: validarItems(p.problemaConsumidor),
    comoLoHacemos: validarItems(p.comoLoHacemos),
    porQueRelevante: validarItems(p.porQueRelevante),
  }
}

export function runProblema(client: Anthropic, respondents: RespondentInput[], personalidad: Personalidad): Promise<Problema> {
  return callJson(client, buildProblemaPrompt(respondents, personalidad), 3000, validateProblema)
}
```

> `validarItems` se exporta acá y se reutiliza en los pasos 2/3/4 (DRY).

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- src/lib/deliverable/steps/problema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deliverable/steps/problema.ts src/lib/deliverable/steps/problema.test.ts
git commit -m "feat(deliverable): paso problema (5 bloques, alimentado por personalidad)"
```

---

### Task B5: Paso 2 — competencia

**Files:**
- Create: `src/lib/deliverable/steps/competencia.ts`
- Test: `src/lib/deliverable/steps/competencia.test.ts`

**Interfaces:**
- Produces:
  - `buildCompetenciaPrompt(respondents: RespondentInput[]): string`
  - `validateCompetencia(o: unknown): Competencia`
  - `runCompetencia(client, respondents): Promise<Competencia>`
- Consumes: B1, B2; `validarItems` de `./problema`.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest'
import { buildCompetenciaPrompt, validateCompetencia } from './competencia'
import type { RespondentInput } from '../schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'estrategia', text: 'competimos con Platzi' }] }]

describe('paso competencia', () => {
  it('el prompt pide competidores, 2 ejes y posición actual/ideal, marcando aportes del equipo', () => {
    const p = buildCompetenciaPrompt(R)
    expect(p).toMatch(/competidor/i); expect(p).toMatch(/eje/i)
    expect(p).toMatch(/posición.*ideal/i); expect(p).toMatch(/equipo/i)
  })
  it('validateCompetencia acepta forma correcta con 2 ejes', () => {
    const ok = {
      competidores: [{ texto: 'Platzi', origen: 'cliente' }],
      otrosReferentes: [{ marca: 'Lovable', tipo: 'referente de marca', origen: 'equipo' }],
      ejes: [
        { nombre: 'accesibilidad', extremoIzquierdo: 'accesible', extremoDerecho: 'poco accesible', origen: 'equipo' },
        { nombre: 'credibilidad', extremoIzquierdo: 'menor', extremoDerecho: 'mayor', origen: 'equipo' },
      ],
      posicionActual: { texto: 'centro-izq', origen: 'equipo' },
      posicionIdeal: { texto: 'arriba-der', origen: 'equipo' },
    }
    expect(validateCompetencia(ok).ejes).toHaveLength(2)
  })
  it('validateCompetencia rechaza referente sin tipo', () => {
    expect(() => validateCompetencia({ competidores: [], otrosReferentes: [{ marca: 'X' }], ejes: [],
      posicionActual: { texto: 'a', origen: 'equipo' }, posicionIdeal: { texto: 'b', origen: 'equipo' } })).toThrow()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- src/lib/deliverable/steps/competencia.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `competencia.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk'
import type { Competencia, Referente, Eje, Item, RespondentInput, Origen } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { validarItems } from './problema'
import { callJson } from '../llm'

const GUIA = [
  'PASO 2 — PANORAMA DE LA CATEGORÍA (mapeo de competencia). Ubicá a la marca frente a su',
  'competencia en un mapa de dos ejes:',
  '- competidores: las marcas que el cliente menciona (origen "cliente").',
  '- otrosReferentes: marcas de fuera de la categoría que inspiran, etiquetadas por para qué',
  '  sirven ("referente de marca" / "de comunicación" / "visual"). El formulario casi nunca',
  '  las trae: si faltan, proponelas marcadas como "equipo".',
  '- ejes: EXACTAMENTE 2 ejes de comparación. Casi nunca vienen en el formulario: proponelos',
  '  a partir de lo que el cliente valora, marcados como "equipo".',
  '- posicionActual y posicionIdeal: dónde está hoy la marca y a dónde debería moverse (texto).',
  '  La posición ideal suele ser aporte del equipo.',
].join('\n')

export function buildCompetenciaPrompt(respondents: RespondentInput[]): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Respuestas de los respondientes', formatRespondents(respondents), '',
    'Devolvé SOLO JSON con esta forma:',
    '{"competidores": Item[], "otrosReferentes": [{"marca": string, "tipo": string, "origen": Origen}],',
    ' "ejes": [{"nombre": string, "extremoIzquierdo": string, "extremoDerecho": string, "origen": Origen}],',
    ' "posicionActual": Item, "posicionIdeal": Item}',
    'Origen es "cliente"|"equipo"|"pendiente". "ejes" debe tener 2 elementos.',
  ].join('\n')
}

const ORIGENES: Origen[] = ['cliente', 'equipo', 'pendiente']
const validarItem = (x: unknown): Item => validarItems([x])[0]

export function validateCompetencia(o: unknown): Competencia {
  const c = o as any
  const otrosReferentes: Referente[] = (Array.isArray(c?.otrosReferentes) ? c.otrosReferentes : []).map((r: any) => {
    if (typeof r?.marca !== 'string' || typeof r?.tipo !== 'string' || !ORIGENES.includes(r?.origen)) throw new Error('Referente inválido')
    return { marca: r.marca, tipo: r.tipo, origen: r.origen }
  })
  const ejes: Eje[] = (Array.isArray(c?.ejes) ? c.ejes : []).map((e: any) => {
    if (typeof e?.nombre !== 'string' || typeof e?.extremoIzquierdo !== 'string'
      || typeof e?.extremoDerecho !== 'string' || !ORIGENES.includes(e?.origen)) throw new Error('Eje inválido')
    return { nombre: e.nombre, extremoIzquierdo: e.extremoIzquierdo, extremoDerecho: e.extremoDerecho, origen: e.origen }
  })
  return {
    competidores: validarItems(c?.competidores), otrosReferentes, ejes,
    posicionActual: validarItem(c?.posicionActual), posicionIdeal: validarItem(c?.posicionIdeal),
  }
}

export function runCompetencia(client: Anthropic, respondents: RespondentInput[]): Promise<Competencia> {
  return callJson(client, buildCompetenciaPrompt(respondents), 3000, validateCompetencia)
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- src/lib/deliverable/steps/competencia.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deliverable/steps/competencia.ts src/lib/deliverable/steps/competencia.test.ts
git commit -m "feat(deliverable): paso competencia (marcas, 2 ejes, posición actual/ideal)"
```

---

### Task B6: Paso 3 — perfil (depende de problema + personalidad)

**Files:**
- Create: `src/lib/deliverable/steps/perfil.ts`
- Test: `src/lib/deliverable/steps/perfil.test.ts`

**Interfaces:**
- Produces:
  - `buildPerfilPrompt(respondents, problema: Problema, personalidad: Personalidad): string`
  - `validatePerfil(o: unknown): Perfil`
  - `runPerfil(client, respondents, problema, personalidad): Promise<Perfil>`
- Consumes: B1, B2; `validarItems` de `./problema`.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest'
import { buildPerfilPrompt, validatePerfil } from './perfil'
import type { RespondentInput, Problema, Personalidad } from '../schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'estrategia', text: 'quieren productividad' }] }]
const PROB: Problema = { problemaMundo: 'm', problemaMarca: 'x',
  problemaConsumidor: [{ texto: 'no saben empezar', origen: 'cliente' }], comoLoHacemos: [], porQueRelevante: [] }
const PERS: Personalidad = { arquetipo: 'cercano', atributos: [], queNoQuiereSer: [], tensiones: [] }

describe('paso perfil', () => {
  it('el prompt pide jobs (Quiero poder…), gains y pains e inyecta el problema', () => {
    const p = buildPerfilPrompt(R, PROB, PERS)
    expect(p).toMatch(/jobs to be done|quiero poder/i)
    expect(p).toMatch(/gains/i); expect(p).toMatch(/pains/i)
    expect(p).toContain('no saben empezar')       // viene del problema
  })
  it('validatePerfil acepta y rechaza correctamente', () => {
    const ok = { jobs: [{ texto: 'Quiero poder X', origen: 'cliente' }], gains: [], pains: [] }
    expect(validatePerfil(ok).jobs).toHaveLength(1)
    expect(() => validatePerfil({ jobs: 'x', gains: [], pains: [] })).toThrow()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- src/lib/deliverable/steps/perfil.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `perfil.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk'
import type { Perfil, Problema, Personalidad, RespondentInput } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { validarItems } from './problema'
import { callJson } from '../llm'

const GUIA = [
  'PASO 3 — PERFIL DE USUARIO (lado izquierdo del Value Proposition Canvas de Strategyzer).',
  '- jobs (Jobs to be done): necesidades/tareas/problemas que el usuario quiere resolver',
  '  (funcionales, sociales, emocionales). Redactalos como "Quiero poder…".',
  '- gains: beneficios que el usuario desea o que lo sorprenderían.',
  '- pains: riesgos, miedos y obstáculos antes/durante/después del job.',
  'Basate en los dolores del consumidor ya identificados en el problema. No inventes: lo que',
  'no salga, márcalo "pendiente".',
].join('\n')

export function buildPerfilPrompt(respondents: RespondentInput[], problema: Problema, personalidad: Personalidad): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Problema (paso previo)',
    `Consumidor: ${problema.problemaConsumidor.map(i => i.texto).join(' | ') || '—'}`,
    `Arquetipo de marca: ${personalidad.arquetipo}`,
    '', '## Respuestas de los respondientes', formatRespondents(respondents), '',
    'Devolvé SOLO JSON (cada ítem: {"texto": string, "origen": Origen, "cita"?: string}):',
    '{"jobs": Item[], "gains": Item[], "pains": Item[]}',
  ].join('\n')
}

export function validatePerfil(o: unknown): Perfil {
  const p = o as any
  return { jobs: validarItems(p?.jobs), gains: validarItems(p?.gains), pains: validarItems(p?.pains) }
}

export function runPerfil(client: Anthropic, respondents: RespondentInput[], problema: Problema, personalidad: Personalidad): Promise<Perfil> {
  return callJson(client, buildPerfilPrompt(respondents, problema, personalidad), 3000, validatePerfil)
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- src/lib/deliverable/steps/perfil.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deliverable/steps/perfil.ts src/lib/deliverable/steps/perfil.test.ts
git commit -m "feat(deliverable): paso perfil (jobs/gains/pains sobre el canvas)"
```

---

### Task B7: Paso 4 — propuesta de valor (depende de problema + perfil)

**Files:**
- Create: `src/lib/deliverable/steps/propuesta-valor.ts`
- Test: `src/lib/deliverable/steps/propuesta-valor.test.ts`

**Interfaces:**
- Produces:
  - `buildPropuestaValorPrompt(respondents, problema: Problema, perfil: Perfil): string`
  - `validatePropuestaValor(o: unknown): PropuestaValor`
  - `runPropuestaValor(client, respondents, problema, perfil): Promise<PropuestaValor>`
- Consumes: B1, B2.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest'
import { buildPropuestaValorPrompt, validatePropuestaValor } from './propuesta-valor'
import type { RespondentInput, Problema, Perfil } from '../schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'estrategia', text: 'x' }] }]
const PROB: Problema = { problemaMundo: 'm', problemaMarca: 'x', problemaConsumidor: [], comoLoHacemos: [], porQueRelevante: [] }
const PERF: Perfil = { jobs: [{ texto: 'Quiero poder adoptar IA', origen: 'cliente' }], gains: [], pains: [] }

describe('paso propuesta de valor', () => {
  it('el prompt pide la fórmula y una fila por JTBD, e inyecta los jobs del perfil', () => {
    const p = buildPropuestaValorPrompt(R, PROB, PERF)
    expect(p).toMatch(/fórmula|verbo|razón de ser/i)
    expect(p).toMatch(/pain reliever|gain creator|una fila/i)
    expect(p).toContain('Quiero poder adoptar IA')  // job del perfil
  })
  it('validatePropuestaValor acepta forma correcta', () => {
    const ok = { formula: { marca: 'LAB10', verbo: 'desbloqueamos', razonDeSer: 'el potencial', beneficioCentral: 'espacio seguro' },
      filas: [{ job: 'adoptar IA', solucion: 'acompañamiento', comoSeResuelve: 'de punta a punta', origen: 'equipo' }] }
    expect(validatePropuestaValor(ok).filas[0].job).toBe('adoptar IA')
  })
  it('validatePropuestaValor rechaza fórmula incompleta', () => {
    expect(() => validatePropuestaValor({ formula: { marca: 'x' }, filas: [] })).toThrow()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- src/lib/deliverable/steps/propuesta-valor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `propuesta-valor.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk'
import type { PropuestaValor, FilaValor, Problema, Perfil, RespondentInput, Origen } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { callJson } from '../llm'

const GUIA = [
  'PASO 4 — PROPUESTA DE VALOR (lado derecho del canvas + síntesis).',
  'Primero sintetizá la propuesta de valor con esta fórmula:',
  '  En [marca], [verbo] [razón de ser]. Somos [beneficio central].',
  'Después mapeá CADA job del perfil con su pain reliever / gain creator y una descripción',
  'de cómo se resuelve (una fila por job). Marcá el origen de cada fila.',
].join('\n')

export function buildPropuestaValorPrompt(respondents: RespondentInput[], problema: Problema, perfil: Perfil): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Jobs to be done del perfil (paso previo)',
    perfil.jobs.map(j => `- ${j.texto}`).join('\n') || '- (ninguno; márcalo pendiente)',
    `Impacto/relevancia: ${problema.porQueRelevante.map(i => i.texto).join(' | ') || '—'}`,
    '', '## Respuestas de los respondientes', formatRespondents(respondents), '',
    'Devolvé SOLO JSON con esta forma:',
    '{"formula": {"marca": string, "verbo": string, "razonDeSer": string, "beneficioCentral": string},',
    ' "filas": [{"job": string, "solucion": string, "comoSeResuelve": string, "origen": Origen}]}',
  ].join('\n')
}

const ORIGENES: Origen[] = ['cliente', 'equipo', 'pendiente']

export function validatePropuestaValor(o: unknown): PropuestaValor {
  const p = o as any
  const f = p?.formula
  if (!f || ['marca', 'verbo', 'razonDeSer', 'beneficioCentral'].some(k => typeof f[k] !== 'string'))
    throw new Error('fórmula incompleta')
  const filas: FilaValor[] = (Array.isArray(p?.filas) ? p.filas : []).map((r: any) => {
    if (typeof r?.job !== 'string' || typeof r?.solucion !== 'string'
      || typeof r?.comoSeResuelve !== 'string' || !ORIGENES.includes(r?.origen)) throw new Error('Fila inválida')
    return { job: r.job, solucion: r.solucion, comoSeResuelve: r.comoSeResuelve, origen: r.origen }
  })
  return { formula: { marca: f.marca, verbo: f.verbo, razonDeSer: f.razonDeSer, beneficioCentral: f.beneficioCentral }, filas }
}

export function runPropuestaValor(client: Anthropic, respondents: RespondentInput[], problema: Problema, perfil: Perfil): Promise<PropuestaValor> {
  return callJson(client, buildPropuestaValorPrompt(respondents, problema, perfil), 3000, validatePropuestaValor)
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- src/lib/deliverable/steps/propuesta-valor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deliverable/steps/propuesta-valor.ts src/lib/deliverable/steps/propuesta-valor.test.ts
git commit -m "feat(deliverable): paso propuesta de valor (fórmula + tabla JTBD)"
```

---

### Task B8: generator.ts — orquestación secuencial + regeneración por parte + aislamiento

**Files:**
- Create: `src/lib/deliverable/generator.ts`
- Test: `src/lib/deliverable/generator.test.ts`

**Interfaces:**
- Produces:
  - `generateDeliverable(client, respondents: RespondentInput[], opts?: { only?: PartKey; prev?: Deliverable }): Promise<Deliverable>`
  - Ejecución secuencial: personalidad → problema → competencia → perfil → propuestaValor.
  - `only`: regenera esa sola parte usando dependencias de `prev`; si falta una dependencia en `prev`, lanza error claro.
  - Aislamiento: en run completo, si un paso falla, su `Part.meta.error` se setea y `data=null`; los dependientes que necesiten esa data quedan también con error "dependencia X falló"; los independientes se conservan.
- Consumes: `run*` de los 5 pasos; tipos de B1.

- [ ] **Step 1: Escribir el test que falla** (con un client falso que devuelve JSON por paso, detectando el paso por una marca en el prompt)

```ts
import { describe, it, expect } from 'vitest'
import { generateDeliverable } from './generator'
import type { RespondentInput } from './schema'

const R: RespondentInput[] = [{ respondentName: 'Ana', role: 'Fundadora', answers: [{ questionId: 'animal', text: 'perro' }] }]

// client falso: mira el prompt y responde el JSON del paso correspondiente
function fakeClient(opts: { failCompetencia?: boolean } = {}) {
  const byStep = (prompt: string) => {
    if (/LECTURA PROYECTIVA/.test(prompt)) return '{"arquetipo":"cercano","atributos":[],"queNoQuiereSer":[],"tensiones":[]}'
    if (/DECLARACIÓN DEL PROBLEMA/.test(prompt)) return '{"problemaMundo":"m","problemaMarca":"x","problemaConsumidor":[],"comoLoHacemos":[],"porQueRelevante":[]}'
    if (/PANORAMA DE LA CATEGORÍA/.test(prompt)) {
      if (opts.failCompetencia) return 'no json'
      return '{"competidores":[],"otrosReferentes":[],"ejes":[{"nombre":"a","extremoIzquierdo":"i","extremoDerecho":"d","origen":"equipo"},{"nombre":"b","extremoIzquierdo":"i","extremoDerecho":"d","origen":"equipo"}],"posicionActual":{"texto":"a","origen":"equipo"},"posicionIdeal":{"texto":"b","origen":"equipo"}}'
    }
    if (/PERFIL DE USUARIO/.test(prompt)) return '{"jobs":[],"gains":[],"pains":[]}'
    if (/PROPUESTA DE VALOR/.test(prompt)) return '{"formula":{"marca":"M","verbo":"v","razonDeSer":"r","beneficioCentral":"b"},"filas":[]}'
    return '{}'
  }
  return { messages: { create: async (a: any) => ({ content: [{ type: 'text', text: byStep(a.messages.at(-1).content) }] }) } } as any
}

describe('generateDeliverable', () => {
  it('run completo produce las 5 partes con generatedAt', async () => {
    const d = await generateDeliverable(fakeClient(), R)
    for (const k of ['personalidad', 'problema', 'competencia', 'perfil', 'propuestaValor'] as const) {
      expect(d[k]!.data).not.toBeNull()
      expect(d[k]!.meta.generatedAt).toBeTruthy()
    }
  })
  it('un paso que falla queda aislado; los demás se conservan', async () => {
    const d = await generateDeliverable(fakeClient({ failCompetencia: true }), R)
    expect(d.competencia!.data).toBeNull()
    expect(d.competencia!.meta.error).toBeTruthy()
    expect(d.personalidad!.data).not.toBeNull()
    expect(d.propuestaValor!.data).not.toBeNull()  // no depende de competencia
  })
  it('only=perfil reusa problema+personalidad de prev', async () => {
    const prev = await generateDeliverable(fakeClient(), R)
    const d = await generateDeliverable(fakeClient(), R, { only: 'perfil', prev })
    expect(d.perfil!.data).not.toBeNull()
    expect(d.problema).toEqual(prev.problema)       // no regeneró la dependencia
  })
  it('only con dependencia ausente lanza error', async () => {
    await expect(generateDeliverable(fakeClient(), R, { only: 'perfil', prev: {} })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- src/lib/deliverable/generator.test.ts`
Expected: FAIL — `generateDeliverable` no existe.

- [ ] **Step 3: Implementar `generator.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk'
import type { Deliverable, PartKey, RespondentInput, Part } from './schema'
import { runPersonalidad } from './steps/personalidad'
import { runProblema } from './steps/problema'
import { runCompetencia } from './steps/competencia'
import { runPerfil } from './steps/perfil'
import { runPropuestaValor } from './steps/propuesta-valor'

const now = () => new Date().toISOString()
const ok = <T>(data: T): Part<T> => ({ data, meta: { generatedAt: now(), error: null } })
const fail = (error: unknown): Part<never> => ({ data: null, meta: { generatedAt: now(), error: String(error) } })

// Regeneración de una sola parte: usa dependencias de prev; si falta, error claro.
async function regenOne(client: Anthropic, respondents: RespondentInput[], only: PartKey, prev: Deliverable): Promise<Deliverable> {
  const need = (k: PartKey) => {
    const p = prev[k]
    if (!p || !p.data) throw new Error(`No se puede regenerar "${only}": falta la dependencia "${k}". Generá el entregable completo primero.`)
    return p.data as any
  }
  const out: Deliverable = { ...prev }
  try {
    if (only === 'personalidad') out.personalidad = ok(await runPersonalidad(client, respondents))
    else if (only === 'problema') out.problema = ok(await runProblema(client, respondents, need('personalidad')))
    else if (only === 'competencia') out.competencia = ok(await runCompetencia(client, respondents))
    else if (only === 'perfil') out.perfil = ok(await runPerfil(client, respondents, need('problema'), need('personalidad')))
    else if (only === 'propuestaValor') out.propuestaValor = ok(await runPropuestaValor(client, respondents, need('problema'), need('perfil')))
  } catch (e) {
    // errores de dependencia ausente se propagan; errores del LLM se marcan en la parte
    if (String(e).includes('falta la dependencia')) throw e
    out[only] = fail(e) as any
  }
  return out
}

export async function generateDeliverable(
  client: Anthropic,
  respondents: RespondentInput[],
  opts: { only?: PartKey; prev?: Deliverable } = {},
): Promise<Deliverable> {
  if (opts.only) return regenOne(client, respondents, opts.only, opts.prev ?? {})

  const out: Deliverable = {}
  // paso 0
  try { out.personalidad = ok(await runPersonalidad(client, respondents)) } catch (e) { out.personalidad = fail(e) as any }
  // paso 1 (dep personalidad)
  if (out.personalidad?.data) {
    try { out.problema = ok(await runProblema(client, respondents, out.personalidad.data)) } catch (e) { out.problema = fail(e) as any }
  } else out.problema = fail('dependencia personalidad falló') as any
  // paso 2 (independiente)
  try { out.competencia = ok(await runCompetencia(client, respondents)) } catch (e) { out.competencia = fail(e) as any }
  // paso 3 (dep problema + personalidad)
  if (out.problema?.data && out.personalidad?.data) {
    try { out.perfil = ok(await runPerfil(client, respondents, out.problema.data, out.personalidad.data)) } catch (e) { out.perfil = fail(e) as any }
  } else out.perfil = fail('dependencia problema/personalidad falló') as any
  // paso 4 (dep problema + perfil)
  if (out.problema?.data && out.perfil?.data) {
    try { out.propuestaValor = ok(await runPropuestaValor(client, respondents, out.problema.data, out.perfil.data)) } catch (e) { out.propuestaValor = fail(e) as any }
  } else out.propuestaValor = fail('dependencia problema/perfil falló') as any

  return out
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- src/lib/deliverable/generator.test.ts`
Expected: PASS (los 4 casos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/deliverable/generator.ts src/lib/deliverable/generator.test.ts
git commit -m "feat(deliverable): generator secuencial con regeneración por parte y aislamiento de fallos"
```

---

### Task B9: service.ts — reúne respondientes, genera, persiste

**Files:**
- Create: `src/lib/deliverable/service.ts`

**Interfaces:**
- Produces: `generateProjectDeliverable(projectId: string, opts?: { part?: PartKey }): Promise<Deliverable>`
- Consumes: `db` (`@/lib/db/client`), `getProjectWithSessions`, `getSessionWithAnswers`, `saveDeliverable`, `getDeliverable` (store); `ensureNormalized` (normalize); `generateDeliverable` (B8).

> No lleva test unitario propio: es I/O + orquestación fina, cubierta por los tests de generator/store y verificada end-to-end en la Fase D. (Si el revisor lo pide, se agrega un test con `makeTestDb` inyectado; hoy usa el `db` real.)

- [ ] **Step 1: Implementar `service.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/client'
import { getProjectWithSessions, getSessionWithAnswers, saveDeliverable, getDeliverable } from '@/lib/db/store'
import { ensureNormalized } from '@/lib/normalize/service'
import { generateDeliverable } from './generator'
import type { Deliverable, PartKey, RespondentInput } from './schema'

export async function generateProjectDeliverable(projectId: string, opts: { part?: PartKey } = {}): Promise<Deliverable> {
  const project = await getProjectWithSessions(db, projectId)
  if (!project) throw new Error('proyecto no encontrado')

  const respondents: RespondentInput[] = []
  for (const s of project.sessions as { id: string; name?: string | null; role?: string | null }[]) {
    await ensureNormalized(db, s.id)
    const full = await getSessionWithAnswers(db, s.id)
    if (!full) continue
    respondents.push({
      respondentName: s.name ?? '',
      role: s.role ?? '',
      answers: (full.answers as { questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }[])
        .map(a => ({ questionId: a.questionId, text: a.normalizedText ?? a.rawText, imageChoice: a.imageChoice ?? null })),
    })
  }

  const client = new Anthropic({
    authToken: process.env.OPENROUTER_API_KEY!,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: { 'X-Title': 'Melo & Banana' },
  })

  const prev = (await getDeliverable(db, projectId))?.content as Deliverable | undefined
  const content = await generateDeliverable(client, respondents, opts.part ? { only: opts.part, prev: prev ?? {} } : {})
  await saveDeliverable(db, projectId, content)
  return content
}
```

- [ ] **Step 2: Verificar typecheck/build**

Run: `npm run build`
Expected: compila sin errores de tipos (todo el motor + service).

- [ ] **Step 3: Commit**

```bash
git add src/lib/deliverable/service.ts
git commit -m "feat(deliverable): service que reúne respondientes del proyecto, genera y persiste"
```

---

## FASE C — API y retiro del brief

### Task C1: Retirar el subsistema brief (lib + endpoint + uso en admin)

**Files:**
- Delete: `src/lib/brief/service.ts`, `src/lib/brief/generator.ts`, `src/lib/brief/prompt.ts`, `src/lib/brief/generator.test.ts`, `src/lib/brief/prompt.test.ts`
- Delete: `src/app/api/sessions/[id]/brief/route.ts`
- Modify: `src/app/admin/[sessionId]/page.tsx` (quitar `getBrief` y el bloque de render del brief)

**Interfaces:**
- Consumes: nada nuevo. Deja `getSessionWithAnswers`, `ensureNormalized`, `SCRIPT` intactos en la página de sesión.

- [ ] **Step 1: Borrar los archivos del brief**

```bash
git rm src/lib/brief/service.ts src/lib/brief/generator.ts src/lib/brief/prompt.ts \
       src/lib/brief/generator.test.ts src/lib/brief/prompt.test.ts \
       src/app/api/sessions/[id]/brief/route.ts
```

- [ ] **Step 2: Editar `admin/[sessionId]/page.tsx`**

Quitar de los imports `getBrief` (dejar `getSessionWithAnswers`). Borrar las líneas `const brief = await getBrief(...)` y `const b = brief?.content as any`, y el bloque JSX `{b && <section ...>...</section>}` completo (el que titula "Brief"). El resto (título, botón PDF, sección "Respuestas") queda igual.

- [ ] **Step 3: Verificar que no quedan referencias colgando**

Run: `grep -rn "getBrief\|saveBrief\|/brief/service\|lib/brief" src`
Expected: sin resultados (salvo `src/lib/pdf/*` que NO se toca y no importa de `lib/brief`).

Run: `npm run build`
Expected: compila.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: retira el brief genérico (lib, endpoint y uso en admin); el PDF sigue desde respuestas"
```

---

### Task C2: Endpoint POST /api/projects/[id]/deliverable (completo y por parte)

**Files:**
- Create: `src/app/api/projects/[id]/deliverable/route.ts`

**Interfaces:**
- Produces: `POST /api/projects/[id]/deliverable` (run completo) y `?part=personalidad|problema|competencia|perfil|propuestaValor` (regenera una parte). Devuelve el `Deliverable` en JSON; 500 con `{error}` si falla.
- Consumes: `generateProjectDeliverable` (B9).

- [ ] **Step 1: Implementar la ruta**

```ts
import { NextResponse } from 'next/server'
import { generateProjectDeliverable } from '@/lib/deliverable/service'
import type { PartKey } from '@/lib/deliverable/schema'

const PARTS: PartKey[] = ['personalidad', 'problema', 'competencia', 'perfil', 'propuestaValor']

export const maxDuration = 300

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const partParam = new URL(req.url).searchParams.get('part')
  if (partParam && !PARTS.includes(partParam as PartKey))
    return NextResponse.json({ error: `part inválido: ${partParam}` }, { status: 400 })
  try {
    const content = await generateProjectDeliverable(id, partParam ? { part: partParam as PartKey } : {})
    return NextResponse.json(content)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila; la ruta aparece en el output de rutas.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/[id]/deliverable/route.ts
git commit -m "feat(api): POST /api/projects/[id]/deliverable (completo y ?part=)"
```

---

### Task C3: Auto-asignar a proyecto al completar + PATCH para reasignar

**Files:**
- Modify: `src/app/api/sessions/[id]/complete/route.ts`
- Create: `src/app/api/sessions/[id]/route.ts`

**Interfaces:**
- Modify complete: tras `completeSession`, si la sesión tiene `company`, `findOrCreateProject(db, company)` + `assignSessionToProject(db, id, project.id)`.
- Produces PATCH `/api/sessions/[id]` con body `{ projectId: string }` → reasigna. Devuelve `{ ok: true }`.
- Consumes: `findOrCreateProject`, `assignSessionToProject`, `getSessionWithAnswers` (store).

- [ ] **Step 1: Reescribir `complete/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { completeSession, getSessionWithAnswers, findOrCreateProject, assignSessionToProject } from '@/lib/db/store'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await completeSession(db, id)
  const full = await getSessionWithAnswers(db, id)
  const company = full?.company?.trim()
  if (company) {
    const project = await findOrCreateProject(db, company)
    await assignSessionToProject(db, id, project.id)
  }
  return NextResponse.json({ status: s.status })
}
```

- [ ] **Step 2: Crear `sessions/[id]/route.ts` (PATCH)**

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { assignSessionToProject } from '@/lib/db/store'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (typeof body?.projectId !== 'string')
    return NextResponse.json({ error: 'falta projectId' }, { status: 400 })
  await assignSessionToProject(db, id, body.projectId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: compila.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sessions/[id]/complete/route.ts src/app/api/sessions/[id]/route.ts
git commit -m "feat(api): auto-asignar sesión a proyecto al completar + PATCH para reasignar"
```

---

## FASE D — Panel admin

### Task D1: /admin lista proyectos

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `listProjects` (store). Cada proyecto enlaza a `/admin/projects/[id]`.

- [ ] **Step 1: Reescribir `admin/page.tsx`**

```tsx
import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listProjects } from '@/lib/db/store'

export const dynamic = 'force-dynamic'

export default async function Admin() {
  const projects = await listProjects(db) as { id: string; name: string }[]
  return <main className="mx-auto max-w-2xl p-8">
    <h1 className="mb-6 text-2xl font-bold text-ink">Proyectos</h1>
    {projects.length === 0 && <p className="text-black/50">Todavía no hay proyectos. Se crean al completarse una entrevista.</p>}
    <ul className="divide-y">
      {projects.map(p => (
        <li key={p.id} className="py-3">
          <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
        </li>
      ))}
    </ul>
  </main>
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): /admin lista proyectos"
```

---

### Task D2: Vista de proyecto (RSC) — sesiones + entregable actual + panel cliente

**Files:**
- Create: `src/app/admin/projects/[id]/page.tsx`
- Create: `src/app/admin/projects/[id]/DeliverablePanel.tsx`

**Interfaces:**
- page.tsx (RSC): carga proyecto + sesiones + deliverable guardado, otros proyectos (para reasignar), y pasa todo a `<DeliverablePanel>`.
- DeliverablePanel (client): botón "Generar entregable"; render de las 4 partes visibles (problema, competencia, perfil, propuestaValor) + personalidad como bloque de apoyo; "regenerar por parte"; select para reasignar cada sesión a otro proyecto. Marca visual del `origen`.
- Consumes: `getProjectWithSessions`, `getDeliverable`, `listProjects` (store); tipos de `deliverable/schema`; POST `/api/projects/[id]/deliverable`, PATCH `/api/sessions/[id]`.

- [ ] **Step 1: Crear `page.tsx` (RSC)**

```tsx
import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, listProjects } from '@/lib/db/store'
import type { Deliverable } from '@/lib/deliverable/schema'
import { DeliverablePanel } from './DeliverablePanel'

export const dynamic = 'force-dynamic'

export default async function ProjectView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return <main className="p-8">Proyecto no encontrado.</main>
  const deliverable = (await getDeliverable(db, id))?.content as Deliverable | null
  const allProjects = await listProjects(db) as { id: string; name: string }[]
  const sessions = (project.sessions as { id: string; name?: string | null; role?: string | null }[])
    .map(s => ({ id: s.id, name: s.name ?? '—', role: s.role ?? '—' }))

  return <main className="mx-auto max-w-3xl space-y-8 p-8">
    <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
    <DeliverablePanel
      projectId={id}
      initial={deliverable ?? null}
      sessions={sessions}
      projects={allProjects}
    />
  </main>
}
```

- [ ] **Step 2: Crear `DeliverablePanel.tsx` (client component)**

```tsx
'use client'
import { useState } from 'react'
import type { Deliverable, PartKey, Item } from '@/lib/deliverable/schema'

const PARTS: { key: PartKey; label: string }[] = [
  { key: 'personalidad', label: 'Personalidad (apoyo)' },
  { key: 'problema', label: 'Declaración del problema' },
  { key: 'competencia', label: 'Panorama de la categoría' },
  { key: 'perfil', label: 'Perfil de usuario' },
  { key: 'propuestaValor', label: 'Propuesta de valor' },
]

const badge = (o: Item['origen']) =>
  o === 'cliente' ? 'bg-green-100 text-green-800'
  : o === 'equipo' ? 'bg-amber-100 text-amber-800'
  : 'bg-gray-200 text-gray-600'
const badgeLabel = (o: Item['origen']) => o === 'cliente' ? 'cliente' : o === 'equipo' ? 'equipo' : 'pendiente'

function ItemList({ items }: { items: Item[] }) {
  if (!items?.length) return <p className="text-sm text-black/40">— pendiente del taller —</p>
  return <ul className="space-y-1">{items.map((i, k) => (
    <li key={k} className="flex gap-2 text-sm">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge(i.origen)}`}>{badgeLabel(i.origen)}</span>
      <span>{i.texto}{i.cita ? <em className="text-black/50"> — “{i.cita}”</em> : null}</span>
    </li>
  ))}</ul>
}

export function DeliverablePanel({ projectId, initial, sessions, projects }: {
  projectId: string
  initial: Deliverable | null
  sessions: { id: string; name: string; role: string }[]
  projects: { id: string; name: string }[]
}) {
  const [d, setD] = useState<Deliverable | null>(initial)
  const [busy, setBusy] = useState<PartKey | 'full' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate(part?: PartKey) {
    setBusy(part ?? 'full'); setError(null)
    try {
      const url = `/api/projects/${projectId}/deliverable${part ? `?part=${part}` : ''}`
      const res = await fetch(url, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'error')
      setD(json as Deliverable)
    } catch (e) { setError(String(e)) } finally { setBusy(null) }
  }

  async function reassign(sessionId: string, newProjectId: string) {
    if (!newProjectId || newProjectId === projectId) return
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: newProjectId }),
    })
    location.reload()
  }

  return <div className="space-y-8">
    <section className="rounded-2xl bg-[var(--cream)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Respondientes ({sessions.length})</h2>
        <button onClick={() => generate()} disabled={busy !== null}
          className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy === 'full' ? 'Generando…' : d ? 'Regenerar todo' : 'Generar entregable'}
        </button>
      </div>
      <ul className="space-y-2">
        {sessions.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{s.name} · <span className="text-black/50">{s.role}</span></span>
            <select defaultValue="" onChange={e => reassign(s.id, e.target.value)}
              className="rounded border px-2 py-1 text-xs">
              <option value="">mover a…</option>
              {projects.filter(p => p.id !== projectId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </section>

    {error && <p className="text-red-600">⚠ {error}</p>}

    {PARTS.map(({ key, label }) => {
      const part = d?.[key]
      return <section key={key} className="rounded-2xl border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{label}</h2>
          {d && <button onClick={() => generate(key)} disabled={busy !== null}
            className="rounded-lg border px-3 py-1 text-xs disabled:opacity-50">
            {busy === key ? 'Regenerando…' : 'Regenerar'}</button>}
        </div>
        {!part && <p className="text-sm text-black/40">Sin generar.</p>}
        {part?.meta.error && <p className="text-sm text-red-600">⚠ {part.meta.error}</p>}
        {part?.data && <PartBody k={key} data={part.data as any} />}
      </section>
    })}
  </div>
}

function PartBody({ k, data }: { k: PartKey; data: any }) {
  if (k === 'personalidad') return <div className="space-y-2 text-sm">
    <p><strong>Arquetipo:</strong> {data.arquetipo}</p>
    <p><strong>Atributos:</strong> {data.atributos.join(', ') || '—'}</p>
    <p><strong>Qué NO quiere ser:</strong> {data.queNoQuiereSer.join(', ') || '—'}</p>
    <p><strong>Tensiones:</strong> {data.tensiones.join(' · ') || '—'}</p>
  </div>
  if (k === 'problema') return <div className="space-y-3 text-sm">
    <p><strong>Problema (mundo/consumidor):</strong> {data.problemaMundo}</p>
    <p><strong>Para la marca:</strong> {data.problemaMarca}</p>
    <div><strong>¿Qué resolvemos para el consumidor?</strong><ItemList items={data.problemaConsumidor} /></div>
    <div><strong>¿Cómo lo hacemos?</strong><ItemList items={data.comoLoHacemos} /></div>
    <div><strong>¿Por qué es relevante?</strong><ItemList items={data.porQueRelevante} /></div>
  </div>
  if (k === 'competencia') return <div className="space-y-3 text-sm">
    <div><strong>Competidores:</strong><ItemList items={data.competidores} /></div>
    <div><strong>Otros referentes:</strong>
      <ul className="space-y-1">{data.otrosReferentes.map((r: any, i: number) =>
        <li key={i}>{r.marca} <span className="text-black/40">({r.tipo}, {r.origen})</span></li>)}</ul></div>
    <div><strong>Ejes de comparación:</strong>
      <ul className="space-y-1">{data.ejes.map((e: any, i: number) =>
        <li key={i}>{e.nombre}: {e.extremoIzquierdo} ↔ {e.extremoDerecho} <span className="text-black/40">({e.origen})</span></li>)}</ul></div>
    <p><strong>Posición actual:</strong> {data.posicionActual.texto} <span className="text-black/40">({data.posicionActual.origen})</span></p>
    <p><strong>Posición ideal:</strong> {data.posicionIdeal.texto} <span className="text-black/40">({data.posicionIdeal.origen})</span></p>
  </div>
  if (k === 'perfil') return <div className="space-y-3 text-sm">
    <div><strong>Jobs to be done:</strong><ItemList items={data.jobs} /></div>
    <div><strong>Gains:</strong><ItemList items={data.gains} /></div>
    <div><strong>Pains:</strong><ItemList items={data.pains} /></div>
  </div>
  // propuestaValor
  return <div className="space-y-3 text-sm">
    <p className="rounded-lg bg-[var(--cream)] p-3">
      En <strong>{data.formula.marca}</strong>, {data.formula.verbo} {data.formula.razonDeSer}. Somos {data.formula.beneficioCentral}.
    </p>
    <table className="w-full text-left text-xs">
      <thead><tr className="border-b"><th className="py-1 pr-2">Job</th><th className="py-1 pr-2">Solución</th><th className="py-1">Cómo se resuelve</th></tr></thead>
      <tbody>{data.filas.map((f: any, i: number) => (
        <tr key={i} className="border-b align-top"><td className="py-1 pr-2">{f.job}</td><td className="py-1 pr-2">{f.solucion}</td><td className="py-1">{f.comoSeResuelve}</td></tr>
      ))}</tbody>
    </table>
  </div>
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: compila; ruta `/admin/projects/[id]` presente.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/projects/[id]/page.tsx src/app/admin/projects/[id]/DeliverablePanel.tsx
git commit -m "feat(admin): vista de proyecto con generar/regenerar entregable, marcado de origen y reasignar sesiones"
```

---

### Task D3: Verificación end-to-end + suite completa

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa verde**

Run: `npm run test`
Expected: PASS (deliverable, store, y los que quedan; sin restos de brief).

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 3: Migrar el schema en la base real (Neon)**

Run: `npm run db:push`
Expected: drizzle-kit aplica `projects`, `deliverables`, `sessions.project_id` y dropea `briefs`. Revisar el diff que propone antes de confirmar.

> Con la DB de dev posiblemente limpia (ver `scripts/wipe-db.ts`), no hay datos que migrar. Si hubiera sesiones completadas previas sin `project_id`, quedarían fuera de `/admin` hasta reasignarlas; para MVP es aceptable (o correr `wipe-db` y recapturar).

- [ ] **Step 4: Prueba manual del flujo**

Levantar `npm run dev`, completar 1-2 entrevistas con la misma `company`, entrar a `/admin` → proyecto → "Generar entregable". Verificar: aparecen las 4 partes, los badges de origen se ven, "Regenerar" por parte funciona, mover una sesión a otro proyecto la reagrupa.

- [ ] **Step 5: Commit final (si quedaron ajustes)**

```bash
git add -A && git commit -m "chore: verificación end-to-end del entregable del taller"
```

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del spec:** §2 tabla de slides → pasos B3-B7. §3 agregación por proyecto/híbrida → A1/A2 + C3. §4 arquitectura/dependencias → B1-B9. §4 marcado de origen → `Item.origen` en B1 y validadores. §5 modelo de datos → A1/A2 (incluye retiro de briefs). §6 API + panel → C2/C3 + D1/D2. §7 errores/bordes → B8 (aislamiento), B2 (JSON inválido/reintento), N=1 (preámbulo), best-effort normalize (B9). §9 testing → tests por paso, store, generator, panel manual (D3). Deck/PPT y dibujo del mapa quedan fuera (§8), como corresponde.
- **Placeholders:** ninguno; todo el código va completo.
- **Consistencia de tipos:** `PartKey`, `Item`, `Deliverable`, `RespondentInput`, `run*`/`validate*`/`build*Prompt` usados consistentemente entre B1→B9→C→D. `validarItems` definido en B4 y reusado en B5/B6.
