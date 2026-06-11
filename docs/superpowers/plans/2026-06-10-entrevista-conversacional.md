# Entrevista Proyectiva Conversacional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a voice-guided web app that replaces Mellow & Banana's Google Form brand-brief interview — premium pre-recorded ElevenLabs audio asks each scripted question, the client answers by voice or text, and Claude generates a structured brief the team reads in an internal panel.

**Architecture:** Next.js (App Router, TypeScript) on Vercel. The question script is config-in-code. Sessions/answers/briefs persist in Neon (serverless Postgres) via Drizzle. The interview UI plays a pre-generated `.mp3` per question (built once with ElevenLabs into `/public/audio`) and captures answers via the browser Web Speech API with an always-available text fallback. No live LLM during the interview; Claude is called once at the end to generate the brief. Components are isolated units with narrow interfaces (`script`, `store`, `voice`, `brief-generator`, `interview-ui`, `admin`).

**Tech Stack:** Next.js 15, TypeScript, TailwindCSS, Drizzle ORM, Neon Postgres (`@neondatabase/serverless`), `@anthropic-ai/sdk` (Claude, brief only), ElevenLabs HTTP API (build-time), Web Speech API (browser STT), Vitest + `@electric-sql/pglite` (fast in-memory Postgres for store tests).

**Reference spec:** `docs/superpowers/specs/2026-06-10-melo-banana-conversational-interview-design.md`

---

## File Structure

```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs, tailwind config
drizzle.config.ts
.env.example
vitest.config.ts
scripts/
  generate-audio.ts                # Phase 2: build-time ElevenLabs TTS → /public/audio
src/
  lib/
    script/
      types.ts                     # Question/Section types
      questions.ts                 # the scripted interview (config-in-code)
      questions.test.ts            # validates script integrity + flow helpers
      flow.ts                      # pure helpers: firstQuestion, nextQuestion, progress
      flow.test.ts
    db/
      schema.ts                    # drizzle tables: sessions, answers, briefs
      client.ts                    # neon/drizzle client (runtime)
      store.ts                     # createSession, saveAnswer, getSession, completeSession...
      store.test.ts                # against pglite
    voice/
      types.ts                     # VoiceAdapter interface
      browser-voice.ts             # Web Speech API implementation
      fake-voice.ts                # deterministic test/dev implementation
    brief/
      prompt.ts                    # builds the Claude prompt from answers
      prompt.test.ts
      generator.ts                 # calls Claude → Brief (Phase 3)
      generator.test.ts            # with mocked Anthropic client
    admin/
      auth.ts                      # shared-password check (Phase 3)
  app/
    layout.tsx, globals.css
    page.tsx                       # landing → starts a session
    interview/[sessionId]/page.tsx # the interview runner (client component)
    admin/page.tsx                 # list of completed interviews
    admin/[sessionId]/page.tsx     # brief + raw answers
    api/
      sessions/route.ts                       # POST create
      sessions/[id]/answers/route.ts          # POST save answer
      sessions/[id]/complete/route.ts         # POST complete → generate brief
      sessions/[id]/brief/route.ts            # POST regenerate brief (admin)
  components/
    IdentityForm.tsx
    InterviewScreen.tsx            # question display + mic + text fallback + grid
    MicButton.tsx
    ImageGrid.tsx
    ProgressDots.tsx
    StatePill.tsx
public/
  projective/                      # curated images for the projective exercise
  audio/                           # generated question mp3s (Phase 2)
```

---

## Task 0: Project scaffold & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `vitest.config.ts`, `.env.example`, `.nvmrc`

- [ ] **Step 1: Scaffold Next.js app**

Run (in the repo root, accept defaults: TypeScript yes, Tailwind yes, App Router yes, `src/` dir yes, import alias `@/*`):

```bash
npx create-next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*" --eslint --no-turbopack
```

Expected: a Next.js project created in place. If it refuses because the dir is not empty, scaffold in a temp dir and copy `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/`, `eslint` config over, preserving existing `docs/`, `forms-pages/`, `inspo/`, `.gitignore`.

- [ ] **Step 2: Add dependencies**

Run:

```bash
npm install drizzle-orm @neondatabase/serverless @anthropic-ai/sdk
npm install -D drizzle-kit vitest @electric-sql/pglite @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom
```

Expected: installs succeed.

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    environmentMatchGlobs: [['**/*.tsx', 'jsdom']],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"db:push": "drizzle-kit push"`, `"gen:audio": "tsx scripts/generate-audio.ts"`.

- [ ] **Step 4: Create `.env.example`**

```
DATABASE_URL=postgres://...neon...
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ADMIN_PASSWORD=changeme
```

- [ ] **Step 5: Sanity test to prove the toolchain runs**

Create `src/lib/sanity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
describe('toolchain', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: PASS (1 test). Then delete `src/lib/sanity.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app + tooling (drizzle, vitest, neon)"
```

---

## PHASE 1 — Text interview (no audio, no STT)

### Task 1: Question script types & content

**Files:**
- Create: `src/lib/script/types.ts`, `src/lib/script/questions.ts`, `src/lib/script/questions.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/script/questions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { SCRIPT } from './questions'

describe('SCRIPT', () => {
  it('has unique question ids', () => {
    const ids = SCRIPT.flatMap(s => s.questions.map(q => q.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('covers the 5 sections from the form', () => {
    expect(SCRIPT.map(s => s.key)).toEqual([
      'identity', 'project', 'consumer', 'design', 'projective',
    ])
  })
  it('image-grid questions declare 2+ options, open questions declare none', () => {
    for (const s of SCRIPT) for (const q of s.questions) {
      if (q.type === 'image-grid') expect(q.options!.length).toBeGreaterThanOrEqual(2)
      else expect(q.options).toBeUndefined()
    }
  })
  it('every question has a non-empty prompt and audio path', () => {
    for (const s of SCRIPT) for (const q of s.questions) {
      expect(q.prompt.length).toBeGreaterThan(0)
      expect(q.audio).toMatch(/^\/audio\/.+\.mp3$/)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- questions`
Expected: FAIL ("Cannot find module './questions'").

- [ ] **Step 3: Write types**

`src/lib/script/types.ts`:

```typescript
export type QuestionType = 'open' | 'image-grid'

export interface ImageOption {
  id: string
  label: string
  src: string // path under /public, e.g. /projective/animal/lion.jpg
}

export interface Question {
  id: string
  type: QuestionType
  prompt: string
  /** key idea to underline in the UI (substring of prompt) */
  highlight?: string
  audio: string // /audio/<id>.mp3
  options?: ImageOption[] // only for image-grid
}

export interface Section {
  key: 'identity' | 'project' | 'consumer' | 'design' | 'projective'
  title: string
  questions: Question[]
}
```

- [ ] **Step 4: Write the script content**

`src/lib/script/questions.ts` (abbreviated options for projective; fill all 8 projective categories following the same shape):

```typescript
import type { Section } from './types'

const open = (id: string, prompt: string, highlight?: string) =>
  ({ id, type: 'open' as const, prompt, highlight, audio: `/audio/${id}.mp3` })

export const SCRIPT: Section[] = [
  {
    key: 'identity', title: 'Quién sos',
    questions: [
      open('nombre', 'Para arrancar, ¿cómo te llamás?', 'cómo te llamás'),
      open('empresa', '¿En qué empresa trabajás?', 'empresa'),
      open('cargo', '¿Y cuál es tu cargo?', 'cargo'),
      open('email', '¿A qué email te escribimos?', 'email'),
    ],
  },
  {
    key: 'project', title: 'Contexto del proyecto',
    questions: [
      open('descripcion', 'Hacé una breve descripción de la compañía o proyecto.', 'descripción'),
      open('historia', '¿Cuál es la historia de la compañía o del proyecto?', 'historia'),
      open('productos', '¿Qué productos o servicios ofrece?', 'productos o servicios'),
      open('porque_ahora', '¿Por qué es importante evolucionar la marca justo ahora?', 'evolucionar la marca'),
      open('si_nada', '¿Qué pasaría si no se hace nada?', 'si no se hace nada'),
      open('estrategia', '¿Cuál es la estrategia de negocio detrás del brief?', 'estrategia de negocio'),
      open('competencia_hace', '¿Qué está o qué no está haciendo la competencia?', 'la competencia'),
      open('kpis', '¿Cuáles son los KPI del proyecto?', 'KPI'),
      open('competidores', '¿Cuáles son los competidores directos e indirectos?', 'competidores'),
    ],
  },
  {
    key: 'consumer', title: 'Contexto del consumidor',
    questions: [
      open('problema', '¿Cuál es el problema clave que se resuelve para el consumidor?', 'problema clave'),
      open('target', '¿Quién es el target?', 'target'),
      open('piensan', '¿Qué piensan los consumidores de la marca?', 'piensan'),
      open('relacion', '¿Cómo se relacionan hoy los consumidores con la marca? (si aplica)', 'se relacionan'),
      open('uso', '¿Cómo usan el producto o servicio? (si aplica)', 'usan'),
      open('cambio', '¿Cuál es el cambio clave que se busca en el consumidor?', 'cambio clave'),
    ],
  },
  {
    key: 'design', title: 'Contexto de diseño',
    questions: [
      open('objetivos', '¿Cuáles son los objetivos principales del diseño?', 'objetivos'),
      open('donde_vive', '¿Dónde vivirá el diseño? (tiendas, online, eventos…)', 'Dónde vivirá'),
      open('marketing_mix', '¿Cómo encajará en el marketing mix cuando se lance?', 'marketing mix'),
    ],
  },
  {
    key: 'projective', title: 'Ejercicio proyectivo',
    questions: [
      {
        id: 'animal', type: 'image-grid',
        prompt: 'Si la marca fuera un animal, ¿cuál sería?', highlight: 'animal',
        audio: '/audio/animal.mp3',
        options: [
          { id: 'lion', label: 'León', src: '/projective/animal/lion.jpg' },
          { id: 'eagle', label: 'Águila', src: '/projective/animal/eagle.jpg' },
          { id: 'dolphin', label: 'Delfín', src: '/projective/animal/dolphin.jpg' },
          { id: 'fox', label: 'Zorro', src: '/projective/animal/fox.jpg' },
          { id: 'elephant', label: 'Elefante', src: '/projective/animal/elephant.jpg' },
          { id: 'wolf', label: 'Lobo', src: '/projective/animal/wolf.jpg' },
          { id: 'deer', label: 'Ciervo', src: '/projective/animal/deer.jpg' },
          { id: 'bee', label: 'Abeja', src: '/projective/animal/bee.jpg' },
          { id: 'turtle', label: 'Tortuga', src: '/projective/animal/turtle.jpg' },
        ],
      },
      // TODO-CONTENT (not a plan placeholder): replicate this exact shape for
      // color, genero, edad, planta, lugar, ciudad using the curated images the
      // M&B team provides in /public/projective/<category>/. Until images exist,
      // these may be left out; tests only require the shape above to hold.
    ],
  },
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- questions`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/script/
git commit -m "feat(script): interview question script + types"
```

---

### Task 2: Flow helpers (pure)

**Files:**
- Create: `src/lib/script/flow.ts`, `src/lib/script/flow.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/script/flow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { allQuestions, firstQuestionId, nextQuestionId, progress } from './flow'

describe('flow', () => {
  it('flattens questions in section order', () => {
    const ids = allQuestions().map(q => q.id)
    expect(ids[0]).toBe('nombre')
    expect(ids).toContain('animal')
  })
  it('firstQuestionId is nombre', () => {
    expect(firstQuestionId()).toBe('nombre')
  })
  it('nextQuestionId returns the following id, then null at the end', () => {
    expect(nextQuestionId('nombre')).toBe('empresa')
    const last = allQuestions().at(-1)!.id
    expect(nextQuestionId(last)).toBeNull()
  })
  it('progress is 1-based index and total', () => {
    expect(progress('nombre')).toEqual({ index: 1, total: allQuestions().length })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- flow`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/script/flow.ts`:

```typescript
import { SCRIPT } from './questions'
import type { Question } from './types'

export function allQuestions(): Question[] {
  return SCRIPT.flatMap(s => s.questions)
}
export function firstQuestionId(): string {
  return allQuestions()[0].id
}
export function getQuestion(id: string): Question | undefined {
  return allQuestions().find(q => q.id === id)
}
export function nextQuestionId(id: string): string | null {
  const qs = allQuestions()
  const i = qs.findIndex(q => q.id === id)
  if (i === -1 || i === qs.length - 1) return null
  return qs[i + 1].id
}
export function progress(id: string): { index: number; total: number } {
  const qs = allQuestions()
  return { index: qs.findIndex(q => q.id === id) + 1, total: qs.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- flow`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/script/flow.ts src/lib/script/flow.test.ts
git commit -m "feat(script): pure flow helpers"
```

---

### Task 3: DB schema + client

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/db/client.ts`, `drizzle.config.ts`

- [ ] **Step 1: Write the schema**

`src/lib/db/schema.ts`:

```typescript
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  company: text('company'),
  role: text('role'),
  email: text('email'),
  status: text('status').notNull().default('in_progress'), // 'in_progress' | 'completed'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
})

export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  questionId: text('question_id').notNull(),
  rawText: text('raw_text').notNull(),
  imageChoice: text('image_choice'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const briefs = pgTable('briefs', {
  sessionId: uuid('session_id').primaryKey().references(() => sessions.id),
  content: jsonb('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

- [ ] **Step 2: Write the runtime client**

`src/lib/db/client.ts`:

```typescript
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

- [ ] **Step 3: Write drizzle config**

`drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 4: Push schema to Neon (manual, needs DATABASE_URL)**

Run: `npm run db:push`
Expected: tables created. (If no Neon yet, create a free project at neon.tech, copy the connection string into `.env`, then re-run. Document the URL in `.env`, never commit it.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/client.ts drizzle.config.ts
git commit -m "feat(db): drizzle schema + neon client"
```

---

### Task 4: Store (against pglite)

**Files:**
- Create: `src/lib/db/store.ts`, `src/lib/db/store.test.ts`, `src/lib/db/testdb.ts`

- [ ] **Step 1: Write a pglite test harness**

`src/lib/db/testdb.ts`:

```typescript
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema'

export async function makeTestDb() {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  // create tables (mirror schema.ts)
  await client.exec(`
    CREATE TABLE sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text, company text, role text, email text,
      status text NOT NULL DEFAULT 'in_progress',
      created_at timestamp NOT NULL DEFAULT now(),
      completed_at timestamp
    );
    CREATE TABLE answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES sessions(id),
      question_id text NOT NULL,
      raw_text text NOT NULL,
      image_choice text,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE briefs (
      session_id uuid PRIMARY KEY REFERENCES sessions(id),
      content jsonb NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `)
  return db
}
export type TestDb = Awaited<ReturnType<typeof makeTestDb>>
```

- [ ] **Step 2: Write the failing test**

`src/lib/db/store.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testdb'
import { createSession, saveAnswer, getSessionWithAnswers, completeSession } from './store'

describe('store', () => {
  it('creates a session and reads it back', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, { name: 'Ana', company: 'Acme', role: 'CMO', email: 'a@x.com' })
    expect(s.id).toBeTruthy()
    expect(s.status).toBe('in_progress')
  })

  it('saves answers and completeSession flips status', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'Ana' })
    await saveAnswer(db, s.id, { questionId: 'animal', rawText: 'ágil', imageChoice: 'dolphin' })
    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.answers).toHaveLength(2)
    expect(full!.answers.find(a => a.questionId === 'animal')!.imageChoice).toBe('dolphin')

    const done = await completeSession(db, s.id)
    expect(done.status).toBe('completed')
    expect(done.completedAt).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- store`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the store (db passed in for testability)**

`src/lib/db/store.ts`:

```typescript
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
  const [row] = await db.insert(answers).values({ sessionId, ...a }).returning()
  return row
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- store`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/store.ts src/lib/db/store.test.ts src/lib/db/testdb.ts
git commit -m "feat(db): store fns with pglite tests"
```

---

### Task 5: API routes (create session, save answer, complete)

**Files:**
- Create: `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/answers/route.ts`, `src/app/api/sessions/[id]/complete/route.ts`

- [ ] **Step 1: POST /api/sessions — create**

`src/app/api/sessions/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { createSession } from '@/lib/db/store'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const s = await createSession(db, {
    name: body.name, company: body.company, role: body.role, email: body.email,
  })
  return NextResponse.json({ id: s.id })
}
```

- [ ] **Step 2: POST /api/sessions/[id]/answers — save answer**

`src/app/api/sessions/[id]/answers/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { saveAnswer } from '@/lib/db/store'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (!body.questionId || typeof body.rawText !== 'string') {
    return NextResponse.json({ error: 'questionId and rawText required' }, { status: 400 })
  }
  const row = await saveAnswer(db, id, {
    questionId: body.questionId, rawText: body.rawText, imageChoice: body.imageChoice,
  })
  return NextResponse.json({ id: row.id })
}
```

- [ ] **Step 3: POST /api/sessions/[id]/complete — mark done (brief wired in Phase 3)**

`src/app/api/sessions/[id]/complete/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { completeSession } from '@/lib/db/store'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await completeSession(db, id)
  // Phase 3 adds: await generateAndSaveBrief(id)
  return NextResponse.json({ status: s.status })
}
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, then in a second terminal:

```bash
curl -s -XPOST localhost:3000/api/sessions -d '{"name":"Ana"}' -H 'content-type: application/json'
# → {"id":"<uuid>"}
curl -s -XPOST localhost:3000/api/sessions/<uuid>/answers -d '{"questionId":"nombre","rawText":"Ana"}' -H 'content-type: application/json'
# → {"id":"<uuid>"}
curl -s -XPOST localhost:3000/api/sessions/<uuid>/complete
# → {"status":"completed"}
```

Expected: each returns the shown JSON (requires DATABASE_URL set).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/
git commit -m "feat(api): sessions create/answer/complete routes"
```

---

### Task 6: Interview UI (text mode) + components

**Files:**
- Create: `src/components/ProgressDots.tsx`, `src/components/StatePill.tsx`, `src/components/MicButton.tsx`, `src/components/ImageGrid.tsx`, `src/components/IdentityForm.tsx`, `src/components/InterviewScreen.tsx`, `src/app/interview/[sessionId]/page.tsx`, `src/app/page.tsx`
- Modify: `src/app/globals.css` (brand tokens)

- [ ] **Step 1: Brand tokens in CSS**

Append to `src/app/globals.css`:

```css
:root {
  --cream: #fffdf2;
  --ink: #1a1510;
  --banana: #ffd400;
}
.bg-cream { background: var(--cream); }
.text-ink { color: var(--ink); }
.underline-banana { box-shadow: inset 0 -0.36em 0 var(--banana); }
```

- [ ] **Step 2: ProgressDots**

`src/components/ProgressDots.tsx`:

```tsx
export function ProgressDots({ index, total }: { index: number; total: number }) {
  const pct = Math.round((index / total) * 100)
  return (
    <div className="flex items-center gap-2" aria-label={`Pregunta ${index} de ${total}`}>
      <div className="h-[3px] w-28 rounded-full bg-black/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--banana)' }} />
      </div>
      <span className="text-[10px] text-black/40">{index}/{total}</span>
    </div>
  )
}
```

- [ ] **Step 3: StatePill + MicButton (mic is visual-only in Phase 1)**

`src/components/StatePill.tsx`:

```tsx
export function StatePill({ mode }: { mode: 'agent' | 'you' }) {
  const agent = mode === 'agent'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider ${agent ? 'bg-[var(--ink)] text-white' : 'bg-[var(--banana)] text-[var(--ink)]'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {agent ? 'Banana está hablando' : 'Te escucho…'}
    </span>
  )
}
```

`src/components/MicButton.tsx`:

```tsx
export function MicButton({ active, onClick }: { active: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} aria-label="Hablar"
      className={`relative grid h-16 w-16 place-items-center rounded-full transition ${active ? 'bg-[var(--banana)]' : 'bg-[var(--ink)]'}`}>
      <svg viewBox="0 0 24 24" width="25" height="25" fill="none"
        stroke={active ? '#1a1404' : 'var(--banana)'} strokeWidth="1.9">
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  )
}
```

- [ ] **Step 4: ImageGrid**

`src/components/ImageGrid.tsx`:

```tsx
import type { ImageOption } from '@/lib/script/types'

export function ImageGrid({ options, selected, onSelect }: {
  options: ImageOption[]; selected?: string; onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 px-2">
      {options.map(o => (
        <button key={o.id} onClick={() => onSelect(o.id)}
          className={`relative aspect-square overflow-hidden rounded-2xl border-2 ${selected === o.id ? 'border-[var(--ink)]' : 'border-transparent'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.src} alt={o.label} className="h-full w-full object-cover" />
          {selected === o.id && (
            <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--banana)] text-[11px] font-bold text-[var(--ink)]">✓</span>
          )}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: IdentityForm**

`src/components/IdentityForm.tsx`:

```tsx
'use client'
import { useState } from 'react'

export function IdentityForm({ onSubmit }: {
  onSubmit: (v: { name: string; company: string; role: string; email: string }) => void
}) {
  const [v, setV] = useState({ name: '', company: '', role: '', email: '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: e.target.value })
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v) }}
      className="mx-auto flex w-full max-w-sm flex-col gap-3 px-6">
      <h1 className="mb-2 text-2xl font-semibold text-ink">Antes de arrancar, contanos quién sos</h1>
      {(['name', 'company', 'role', 'email'] as const).map(k => (
        <input key={k} required value={v[k]} onChange={set(k)}
          placeholder={{ name: 'Nombre', company: 'Empresa', role: 'Cargo', email: 'Email' }[k]}
          className="rounded-xl border border-black/10 bg-white px-4 py-3 text-ink outline-none" />
      ))}
      <button className="mt-2 rounded-xl bg-[var(--ink)] px-4 py-3 font-semibold text-white">Empezar</button>
    </form>
  )
}
```

- [ ] **Step 6: InterviewScreen (presentational; takes a question + handlers)**

`src/components/InterviewScreen.tsx`:

```tsx
'use client'
import { useState } from 'react'
import type { Question } from '@/lib/script/types'
import { ProgressDots } from './ProgressDots'
import { StatePill } from './StatePill'
import { MicButton } from './MicButton'
import { ImageGrid } from './ImageGrid'

function withHighlight(prompt: string, highlight?: string) {
  if (!highlight || !prompt.includes(highlight)) return prompt
  const [a, b] = prompt.split(highlight)
  return <>{a}<span className="underline-banana">{highlight}</span>{b}</>
}

export function InterviewScreen({ question, index, total, onAnswer }: {
  question: Question; index: number; total: number
  onAnswer: (a: { rawText: string; imageChoice?: string }) => void
}) {
  const [text, setText] = useState('')
  const [choice, setChoice] = useState<string | undefined>()
  const canSubmit = question.type === 'image-grid' ? !!choice && text.trim() : text.trim()
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between bg-cream px-6 py-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold tracking-wide text-ink">M&amp;B</span>
        <ProgressDots index={index} total={total} />
      </div>
      <div className="text-center">
        <StatePill mode="you" />
        <h2 className="mt-4 text-2xl font-semibold leading-tight text-ink">
          {withHighlight(question.prompt, question.highlight)}
        </h2>
        {question.type === 'image-grid' && question.options && (
          <div className="mt-5"><ImageGrid options={question.options} selected={choice} onSelect={setChoice} /></div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <MicButton active={false} />
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder="…o escribí tu respuesta"
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none" rows={2} />
        <button disabled={!canSubmit}
          onClick={() => onAnswer({ rawText: text.trim(), imageChoice: choice })}
          className="rounded-xl bg-[var(--ink)] px-5 py-2.5 font-semibold text-white disabled:opacity-40">
          Siguiente
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Landing page — creates a session and redirects**

`src/app/page.tsx`:

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { IdentityForm } from '@/components/IdentityForm'

export default function Home() {
  const router = useRouter()
  async function start(v: { name: string; company: string; role: string; email: string }) {
    const res = await fetch('/api/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v),
    })
    const { id } = await res.json()
    router.push(`/interview/${id}`)
  }
  return <main className="grid min-h-screen place-items-center bg-cream">
    <IdentityForm onSubmit={start} />
  </main>
}
```

- [ ] **Step 8: Interview runner page**

`src/app/interview/[sessionId]/page.tsx`:

```tsx
'use client'
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { allQuestions } from '@/lib/script/flow'
import { InterviewScreen } from '@/components/InterviewScreen'

export default function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const questions = allQuestions().filter(q => q.id !== 'nombre' && q.id !== 'empresa' && q.id !== 'cargo' && q.id !== 'email')
  const [i, setI] = useState(0)
  const q = questions[i]

  async function answer(a: { rawText: string; imageChoice?: string }) {
    await fetch(`/api/sessions/${sessionId}/answers`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, ...a }),
    })
    if (i + 1 < questions.length) setI(i + 1)
    else {
      await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' })
      router.push('/gracias')
    }
  }

  return <InterviewScreen question={q} index={i + 1} total={questions.length} onAnswer={answer} />
}
```

Also create `src/app/gracias/page.tsx`:

```tsx
export default function Gracias() {
  return <main className="grid min-h-screen place-items-center bg-cream px-6 text-center">
    <div><div className="text-5xl">🍌</div><h1 className="mt-4 text-2xl font-semibold text-ink">¡Gracias! Recibimos tus respuestas.</h1></div>
  </main>
}
```

> Note: identity (`nombre/empresa/cargo/email`) is captured by `IdentityForm` on the landing page and stored on the session, so the interview runner skips those question ids.

- [ ] **Step 9: Manual end-to-end check (text mode)**

Run `npm run dev`, open `http://localhost:3000`, fill identity → answer through every question (type text; for the projective one pick an image + type why) → land on `/gracias`. Verify rows in Neon (`select * from answers;`).
Expected: all answers persisted; session `completed`.

- [ ] **Step 10: Commit**

```bash
git add src/components src/app
git commit -m "feat(ui): text-mode interview flow end-to-end"
```

---

## PHASE 2 — Voice (pre-recorded audio + browser STT)

### Task 7: Voice adapter interface + fake + browser impl

**Files:**
- Create: `src/lib/voice/types.ts`, `src/lib/voice/fake-voice.ts`, `src/lib/voice/browser-voice.ts`, `src/lib/voice/fake-voice.test.ts`

- [ ] **Step 1: Interface**

`src/lib/voice/types.ts`:

```typescript
export interface VoiceAdapter {
  /** Play the agent's question audio; resolves when finished (or immediately if unavailable). */
  play(audioUrl: string): Promise<void>
  /** Listen to the user; resolves with the transcript, or rejects if STT unsupported/denied. */
  listen(): Promise<string>
  /** Whether speech-to-text is available in this environment. */
  isSTTSupported(): boolean
  /** Stop any in-progress playback or listening. */
  stop(): void
}
```

- [ ] **Step 2: Failing test for the fake**

`src/lib/voice/fake-voice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { FakeVoice } from './fake-voice'

describe('FakeVoice', () => {
  it('records played urls and returns scripted transcripts', async () => {
    const v = new FakeVoice(['hola', 'mundo'])
    await v.play('/audio/nombre.mp3')
    expect(v.played).toEqual(['/audio/nombre.mp3'])
    expect(await v.listen()).toBe('hola')
    expect(await v.listen()).toBe('mundo')
  })
  it('reports STT supported', () => {
    expect(new FakeVoice([]).isSTTSupported()).toBe(true)
  })
})
```

- [ ] **Step 3: Run to verify fail**

Run: `npm test -- fake-voice`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the fake**

`src/lib/voice/fake-voice.ts`:

```typescript
import type { VoiceAdapter } from './types'

export class FakeVoice implements VoiceAdapter {
  played: string[] = []
  private queue: string[]
  constructor(transcripts: string[]) { this.queue = [...transcripts] }
  async play(url: string) { this.played.push(url) }
  async listen() { return this.queue.shift() ?? '' }
  isSTTSupported() { return true }
  stop() {}
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- fake-voice`
Expected: PASS.

- [ ] **Step 6: Implement the browser adapter (manual-verified; not unit-tested)**

`src/lib/voice/browser-voice.ts`:

```typescript
import type { VoiceAdapter } from './types'

export class BrowserVoice implements VoiceAdapter {
  private audio?: HTMLAudioElement
  private rec?: any

  play(audioUrl: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.audio = new Audio(audioUrl)
        this.audio.onended = () => resolve()
        this.audio.onerror = () => resolve() // degrade silently; text is on screen
        void this.audio.play().catch(() => resolve())
      } catch { resolve() }
    })
  }

  isSTTSupported(): boolean {
    return typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  }

  listen(): Promise<string> {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) return Promise.reject(new Error('STT unsupported'))
    return new Promise((resolve, reject) => {
      const rec = new Ctor()
      this.rec = rec
      rec.lang = 'es-ES'
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.onresult = (e: any) => resolve(e.results[0][0].transcript)
      rec.onerror = (e: any) => reject(new Error(e.error))
      rec.onend = () => {} // resolved via onresult
      rec.start()
    })
  }

  stop() { this.audio?.pause(); this.rec?.stop?.() }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/voice
git commit -m "feat(voice): adapter interface, fake (tested), browser impl"
```

---

### Task 8: ElevenLabs audio generation script

**Files:**
- Create: `scripts/generate-audio.ts`
- Modify: `package.json` (add `tsx` dev dep)

- [ ] **Step 1: Add tsx**

Run: `npm install -D tsx`

- [ ] **Step 2: Write the generator**

`scripts/generate-audio.ts`:

```typescript
import { writeFile, mkdir } from 'node:fs/promises'
import { SCRIPT } from '../src/lib/script/questions'

const API = 'https://api.elevenlabs.io/v1/text-to-speech'
const KEY = process.env.ELEVENLABS_API_KEY!
const VOICE = process.env.ELEVENLABS_VOICE_ID!

async function tts(text: string): Promise<Buffer> {
  const res = await fetch(`${API}/${VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`)
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  await mkdir('public/audio', { recursive: true })
  for (const section of SCRIPT) {
    for (const q of section.questions) {
      const out = `public${q.audio}` // q.audio is /audio/<id>.mp3
      process.stdout.write(`→ ${q.id}… `)
      await writeFile(out, await tts(q.prompt))
      console.log('ok')
    }
  }
  console.log('Done. Audios in public/audio/')
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: Generate (manual, needs ElevenLabs keys)**

Run: `npm run gen:audio`
Expected: one `.mp3` per question in `public/audio/`. (Pick a Spanish voice in the ElevenLabs dashboard, copy its `ELEVENLABS_VOICE_ID` into `.env`. The whole script is ~4.5k chars → fits the cheapest tier.)

- [ ] **Step 4: Commit (commit the generated audio so deploy needs no keys)**

```bash
git add scripts/generate-audio.ts public/audio package.json
git commit -m "feat(voice): ElevenLabs audio generation + generated question audio"
```

---

### Task 9: Wire audio + STT into the interview

**Files:**
- Modify: `src/components/InterviewScreen.tsx`, `src/app/interview/[sessionId]/page.tsx`

- [ ] **Step 1: Make InterviewScreen drive the voice adapter**

Modify `src/components/InterviewScreen.tsx` to accept an optional `voice` and play the question on mount, and let the mic capture speech. Add at the top of the component body:

```tsx
// add imports
import { useEffect } from 'react'
import type { VoiceAdapter } from '@/lib/voice/types'

// extend props with: voice?: VoiceAdapter
// inside the component:
const [mode, setMode] = useState<'agent' | 'you'>('agent')
const [listening, setListening] = useState(false)

useEffect(() => {
  setMode('agent'); setText(''); setChoice(undefined)
  if (!voice) { setMode('you'); return }
  let cancelled = false
  voice.play(question.audio).then(() => { if (!cancelled) setMode('you') })
  return () => { cancelled = true; voice.stop() }
}, [question.id, voice])

async function speak() {
  if (!voice?.isSTTSupported()) return
  setListening(true)
  try { setText((await voice.listen()).trim()) }
  catch { /* fall back to typing */ }
  finally { setListening(false) }
}
```

Then change `<StatePill mode="you" />` → `<StatePill mode={mode} />` and `<MicButton active={false} />` → `<MicButton active={listening} onClick={speak} />`.

- [ ] **Step 2: Provide the browser voice to the runner**

Modify `src/app/interview/[sessionId]/page.tsx`: build the adapter once and pass it down.

```tsx
// add imports
import { useMemo } from 'react'
import { BrowserVoice } from '@/lib/voice/browser-voice'

// inside component, before return:
const voice = useMemo(() => new BrowserVoice(), [])

// pass to screen:
return <InterviewScreen question={q} index={i + 1} total={questions.length} voice={voice} onAnswer={answer} />
```

- [ ] **Step 3: Manual verification (Chrome)**

Run `npm run dev` in Chrome. Each question should play its audio (pill shows "Banana está hablando"), then flip to "Te escucho…". Tap the mic, speak → transcript fills the textarea. In Safari (no STT), the mic does nothing and typing still works.
Expected: voice playback + STT in Chrome; graceful text fallback elsewhere.

- [ ] **Step 4: Commit**

```bash
git add src/components/InterviewScreen.tsx src/app/interview/
git commit -m "feat(voice): play question audio + browser STT in interview"
```

---

## PHASE 3 — Brief generation + internal panel

### Task 10: Brief prompt + generator

**Files:**
- Create: `src/lib/brief/prompt.ts`, `src/lib/brief/prompt.test.ts`, `src/lib/brief/generator.ts`, `src/lib/brief/generator.test.ts`

- [ ] **Step 1: Failing test for the prompt builder**

`src/lib/brief/prompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildBriefPrompt } from './prompt'

describe('buildBriefPrompt', () => {
  it('includes section titles and each answer with its question prompt', () => {
    const p = buildBriefPrompt(
      { name: 'Ana', company: 'Acme' } as any,
      [{ questionId: 'porque_ahora', rawText: 'Para crecer', imageChoice: null } as any],
    )
    expect(p).toContain('Acme')
    expect(p).toContain('evolucionar la marca') // from the question prompt
    expect(p).toContain('Para crecer')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- prompt`
Expected: FAIL.

- [ ] **Step 3: Implement the prompt builder**

`src/lib/brief/prompt.ts`:

```typescript
import { SCRIPT } from '@/lib/script/questions'

const promptOf = (qid: string) =>
  SCRIPT.flatMap(s => s.questions).find(q => q.id === qid)?.prompt ?? qid

export function buildBriefPrompt(
  session: { name?: string; company?: string },
  answers: { questionId: string; rawText: string; imageChoice: string | null }[],
): string {
  const lines = answers.map(a =>
    `### ${promptOf(a.questionId)}\n${a.rawText}${a.imageChoice ? ` (eligió: ${a.imageChoice})` : ''}`)
  return [
    `Sos estratega de marca en Mellow & Banana. Resumí esta entrevista proyectiva de "${session.company ?? 'el cliente'}" en un brief claro y accionable.`,
    `Devolvé SOLO JSON con esta forma: {"resumen": string, "secciones": [{"titulo": string, "puntos": string[]}], "alertas": string[]}.`,
    `"alertas" = respuestas pobres o faltantes que el equipo debería repreguntar.`,
    ``,
    `## Respuestas`,
    ...lines,
  ].join('\n')
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- prompt`
Expected: PASS.

- [ ] **Step 5: Failing test for the generator (mock Anthropic)**

`src/lib/brief/generator.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { generateBrief } from './generator'

it('parses the model JSON into a Brief', async () => {
  const fakeClient = {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"resumen":"ok","secciones":[],"alertas":[]}' }],
      }),
    },
  } as any
  const brief = await generateBrief(fakeClient, { company: 'Acme' } as any, [])
  expect(brief.resumen).toBe('ok')
  expect(fakeClient.messages.create).toHaveBeenCalledOnce()
})
```

- [ ] **Step 6: Run to verify fail**

Run: `npm test -- generator`
Expected: FAIL.

- [ ] **Step 7: Implement the generator**

`src/lib/brief/generator.ts`:

```typescript
import type Anthropic from '@anthropic-ai/sdk'
import { buildBriefPrompt } from './prompt'

export interface Brief {
  resumen: string
  secciones: { titulo: string; puntos: string[] }[]
  alertas: string[]
}

export async function generateBrief(
  client: Anthropic,
  session: { name?: string; company?: string },
  answers: { questionId: string; rawText: string; imageChoice: string | null }[],
): Promise<Brief> {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildBriefPrompt(session, answers) }],
  })
  const text = res.content.map((b: any) => (b.type === 'text' ? b.text : '')).join('')
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(json) as Brief
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npm test -- generator`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/brief
git commit -m "feat(brief): prompt builder + Claude generator (tested with mock)"
```

---

### Task 11: Wire brief into completion + regenerate route

**Files:**
- Create: `src/lib/brief/service.ts`, `src/app/api/sessions/[id]/brief/route.ts`
- Modify: `src/app/api/sessions/[id]/complete/route.ts`

- [ ] **Step 1: Brief service (loads data, calls generator, saves)**

`src/lib/brief/service.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/client'
import { getSessionWithAnswers, saveBrief } from '@/lib/db/store'
import { generateBrief } from './generator'

export async function generateAndSaveBrief(sessionId: string) {
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) throw new Error('session not found')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const brief = await generateBrief(client, full,
    full.answers.map(a => ({ questionId: a.questionId, rawText: a.rawText, imageChoice: a.imageChoice })))
  await saveBrief(db, sessionId, brief)
  return brief
}
```

- [ ] **Step 2: Call it on complete (non-blocking failure)**

Modify `src/app/api/sessions/[id]/complete/route.ts` — replace the body with:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { completeSession } from '@/lib/db/store'
import { generateAndSaveBrief } from '@/lib/brief/service'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await completeSession(db, id)
  try { await generateAndSaveBrief(id) } catch (e) { console.error('brief failed', e) }
  return NextResponse.json({ status: s.status })
}
```

- [ ] **Step 3: Regenerate route (for the panel button)**

`src/app/api/sessions/[id]/brief/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { generateAndSaveBrief } from '@/lib/brief/service'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try { return NextResponse.json(await generateAndSaveBrief(id)) }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }) }
}
```

- [ ] **Step 4: Manual verification**

Complete an interview end-to-end (Task 6 flow). Then `select content from briefs;` in Neon → a JSON brief exists.
Expected: brief row present with `resumen/secciones/alertas`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/brief/service.ts src/app/api/sessions/
git commit -m "feat(brief): generate on complete + regenerate route"
```

---

### Task 12: Admin panel (list + detail, shared-password auth)

**Files:**
- Create: `src/lib/admin/auth.ts`, `src/middleware.ts`, `src/app/admin/page.tsx`, `src/app/admin/[sessionId]/page.tsx`, `src/app/admin/login/page.tsx`, `src/app/api/admin/login/route.ts`

- [ ] **Step 1: Auth helper + failing test**

`src/lib/admin/auth.ts`:

```typescript
import { createHmac } from 'node:crypto'

export function expectedToken(): string {
  return createHmac('sha256', process.env.ADMIN_PASSWORD ?? '').update('admin').digest('hex')
}
export function isValid(token?: string): boolean {
  return !!token && token === expectedToken()
}
```

`src/lib/admin/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { expectedToken, isValid } from './auth'

beforeEach(() => { process.env.ADMIN_PASSWORD = 'secret' })

describe('admin auth', () => {
  it('accepts the matching token, rejects others', () => {
    expect(isValid(expectedToken())).toBe(true)
    expect(isValid('nope')).toBe(false)
    expect(isValid(undefined)).toBe(false)
  })
})
```

Run: `npm test -- auth` → expect FAIL then (after the file above exists) PASS.

- [ ] **Step 2: Middleware guards /admin**

`src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isValid } from '@/lib/admin/auth'

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin') && !req.nextUrl.pathname.startsWith('/admin/login')) {
    if (!isValid(req.cookies.get('admin')?.value)) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }
  return NextResponse.next()
}
export const config = { matcher: ['/admin/:path*'] }
```

- [ ] **Step 3: Login page + route**

`src/app/admin/login/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
export default function Login() {
  const [pw, setPw] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = await fetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ pw }), headers: { 'content-type': 'application/json' } })
    if (r.ok) location.href = '/admin'; else alert('Contraseña incorrecta')
  }
  return <main className="grid min-h-screen place-items-center bg-cream">
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Contraseña del equipo"
        className="rounded-xl border border-black/10 bg-white px-4 py-3" />
      <button className="rounded-xl bg-[var(--ink)] px-4 py-3 font-semibold text-white">Entrar</button>
    </form>
  </main>
}
```

`src/app/api/admin/login/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { expectedToken } from '@/lib/admin/auth'

export async function POST(req: Request) {
  const { pw } = await req.json()
  if (pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'bad' }, { status: 401 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin', expectedToken(), { httpOnly: true, sameSite: 'lax', path: '/' })
  return res
}
```

- [ ] **Step 4: List page (server component)**

`src/app/admin/page.tsx`:

```tsx
import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listCompleted } from '@/lib/db/store'

export const dynamic = 'force-dynamic'

export default async function Admin() {
  const rows = await listCompleted(db)
  return <main className="mx-auto max-w-2xl p-8">
    <h1 className="mb-6 text-2xl font-bold text-ink">Entrevistas</h1>
    <ul className="divide-y">
      {rows.map(s => (
        <li key={s.id} className="py-3">
          <Link href={`/admin/${s.id}`} className="flex justify-between">
            <span>{s.company ?? '—'} · {s.name ?? '—'}</span>
            <span className="text-black/40">{s.completedAt?.toLocaleString?.() ?? ''}</span>
          </Link>
        </li>
      ))}
    </ul>
  </main>
}
```

- [ ] **Step 5: Detail page (brief + raw)**

`src/app/admin/[sessionId]/page.tsx`:

```tsx
import { db } from '@/lib/db/client'
import { getSessionWithAnswers, getBrief } from '@/lib/db/store'
import { SCRIPT } from '@/lib/script/questions'

export const dynamic = 'force-dynamic'
const promptOf = (qid: string) => SCRIPT.flatMap(s => s.questions).find(q => q.id === qid)?.prompt ?? qid

export default async function Detail({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const full = await getSessionWithAnswers(db, sessionId)
  const brief = await getBrief(db, sessionId)
  if (!full) return <main className="p-8">No encontrado.</main>
  const b = brief?.content as any
  return <main className="mx-auto max-w-2xl space-y-8 p-8">
    <h1 className="text-2xl font-bold text-ink">{full.company} · {full.name}</h1>
    {b && <section className="rounded-2xl bg-[var(--cream)] p-5">
      <h2 className="mb-2 font-bold">Brief</h2>
      <p className="mb-3">{b.resumen}</p>
      {b.secciones?.map((sec: any, i: number) => (
        <div key={i} className="mb-2"><strong>{sec.titulo}</strong>
          <ul className="list-disc pl-5">{sec.puntos?.map((p: string, j: number) => <li key={j}>{p}</li>)}</ul></div>
      ))}
      {b.alertas?.length > 0 && <p className="mt-2 text-amber-700">⚠ {b.alertas.join(' · ')}</p>}
    </section>}
    <section>
      <h2 className="mb-2 font-bold">Respuestas crudas</h2>
      {full.answers.map(a => (
        <div key={a.id} className="mb-3">
          <p className="text-sm text-black/50">{promptOf(a.questionId)}</p>
          <p>{a.rawText}{a.imageChoice ? ` (${a.imageChoice})` : ''}</p>
        </div>
      ))}
    </section>
  </main>
}
```

- [ ] **Step 6: Run unit tests + manual check**

Run: `npm test`
Expected: all unit tests PASS. Then `npm run dev`, visit `/admin` → redirected to login → enter `ADMIN_PASSWORD` → see the completed interview → open it → brief + raw answers render.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin src/middleware.ts src/app/admin src/app/api/admin
git commit -m "feat(admin): password-gated panel with brief + raw answers"
```

---

## Deployment (after Phase 3)

- [ ] Push branch, open Vercel project, set env vars (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`; ElevenLabs keys only needed locally for `gen:audio`). Generated audio is committed, so deploy needs no ElevenLabs access.
- [ ] Run `npm run db:push` against the production Neon branch.
- [ ] Smoke test: complete one interview on the deployed URL, confirm brief in `/admin`.

---

## Self-Review notes

- **Spec coverage:** identity capture (Task 6) · 6 sections / scripted questions (Task 1) · pre-recorded ElevenLabs audio (Task 8) replayed (Task 9) · browser STT + text fallback (Tasks 7,9) · projective image grid (Tasks 1,6) · persistence Neon/Drizzle (Tasks 3,4) · brief by Claude at end + regenerate (Tasks 10,11) · internal panel with auth (Task 12) · resumable-on-failure brief (Task 11 try/catch + regenerate) · cost model honored (no live LLM in interview). 
- **Open content task (not a code placeholder):** the projective categories beyond `animal` need the M&B team's curated images dropped into `/public/projective/<category>/` and the matching option blocks added to `questions.ts` (same shape as `animal`). Flagged in Task 1, Step 4.
- **Resume mid-interview** (spec §10) is supported at the data layer (answers persist per step); the client currently restarts from question 1 on reload. A full resume UI is a small follow-up (load existing answers, jump to first unanswered) — note for executing engineer, not required for Phase 1 acceptance.
