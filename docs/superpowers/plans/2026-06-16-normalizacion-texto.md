# Normalización de transcripciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limpiar las transcripciones de voz (puntuación, mayúsculas, errores obvios) con un modelo chico vía OpenRouter, de forma perezosa, para que el equipo lea respuestas legibles en `/admin` y el PDF, sin alterar el texto crudo.

**Architecture:** Nueva columna `normalized_text` en `answers` (el `raw_text` queda intacto). Un normalizador best-effort (`normalizeText`) llama a `google/gemini-2.5-flash-lite` por el endpoint OpenAI-compatible de OpenRouter. Un servicio `ensureNormalized` lo aplica perezosamente por sesión (idempotente) la primera vez que el equipo abre la sesión/brief/PDF. PDF, brief y panel admin leen `normalizedText ?? rawText`.

**Tech Stack:** Next.js 16, Drizzle ORM, Neon/pglite, OpenRouter (fetch), Vitest.

**Nota de contrato:** `normalizeText` devuelve `string | null`. `null` significa "no se pudo normalizar" (falta key o error de red/modelo) → el servicio saltea y reintenta en una apertura futura, sin "congelar" el crudo como normalizado. Esto realiza el principio best-effort del spec.

---

### Task 1: Columna `normalized_text` en el schema y en la testdb

**Files:**
- Modify: `src/lib/db/schema.ts:14-21`
- Modify: `src/lib/db/testdb.ts:16-24`

- [ ] **Step 1: Agregar la columna en el schema Drizzle**

En `src/lib/db/schema.ts`, dentro de `answers`, agregar `normalizedText` después de `rawText`:

```ts
export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  questionId: text('question_id').notNull(),
  rawText: text('raw_text').notNull(),
  normalizedText: text('normalized_text'),
  imageChoice: text('image_choice'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [unique('answers_session_question').on(t.sessionId, t.questionId)])
```

- [ ] **Step 2: Reflejar la columna en la testdb (pglite)**

En `src/lib/db/testdb.ts`, en el `CREATE TABLE answers`, agregar la columna:

```sql
    CREATE TABLE answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES sessions(id),
      question_id text NOT NULL,
      raw_text text NOT NULL,
      normalized_text text,
      image_choice text,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (session_id, question_id)
    );
```

- [ ] **Step 3: Verificar que compila y que los tests siguen verdes**

Run: `npm test`
Expected: PASS (los tests existentes no usan la columna nueva todavía).

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/testdb.ts
git commit -m "feat(db): columna normalized_text en answers"
```

---

### Task 2: Store helper `setNormalized`

**Files:**
- Modify: `src/lib/db/store.ts`
- Test: `src/lib/db/store.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final del `describe('store', ...)` en `src/lib/db/store.test.ts`:

```ts
  it('setNormalized guarda normalized_text sin tocar raw_text', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, {})
    const a = await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'hola me llamo ana' })
    await setNormalized(db, a.id, 'Hola, me llamo Ana.')
    const full = await getSessionWithAnswers(db, s.id)
    const row = full!.answers.find((r: AnswerRow) => r.id === a.id)!
    expect(row.normalizedText).toBe('Hola, me llamo Ana.')
    expect(row.rawText).toBe('hola me llamo ana')
  })
```

Y agregar `setNormalized` al import:

```ts
import { createSession, saveAnswer, getSessionWithAnswers, completeSession, setNormalized } from './store'
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- store`
Expected: FAIL ("setNormalized is not a function" o de import).

- [ ] **Step 3: Implementar `setNormalized`**

En `src/lib/db/store.ts`, agregar (usa el `eq` ya importado):

```ts
export async function setNormalized(db: AnyDb, answerId: string, text: string) {
  await db.update(answers).set({ normalizedText: text }).where(eq(answers.id, answerId))
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- store`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/store.ts src/lib/db/store.test.ts
git commit -m "feat(store): setNormalized para persistir texto normalizado"
```

---

### Task 3: Normalizador `normalizeText`

**Files:**
- Create: `src/lib/normalize/normalizer.ts`
- Test: `src/lib/normalize/normalizer.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/normalize/normalizer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeText } from './normalizer'

const okResponse = (content: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
})

describe('normalizeText', () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = 'test-key' })
  afterEach(() => { delete process.env.OPENROUTER_API_KEY })

  it('devuelve el texto corregido del modelo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('Hola, me llamo Ana.'))
    const out = await normalizeText('hola me llamo ana', { fetchImpl: fetchImpl as any })
    expect(out).toBe('Hola, me llamo Ana.')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('google/gemini-2.5-flash-lite')
    expect(body.temperature).toBe(0)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].content).toBe('hola me llamo ana')
    expect(init.headers.Authorization).toBe('Bearer test-key')
  })

  it('devuelve null sin OPENROUTER_API_KEY y no llama al fetch', async () => {
    delete process.env.OPENROUTER_API_KEY
    const fetchImpl = vi.fn()
    const out = await normalizeText('algo', { fetchImpl: fetchImpl as any })
    expect(out).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('devuelve null si la respuesta no es ok (no lanza)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    const out = await normalizeText('algo', { fetchImpl: fetchImpl as any })
    expect(out).toBeNull()
  })

  it('devuelve null si el fetch lanza', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'))
    const out = await normalizeText('algo', { fetchImpl: fetchImpl as any })
    expect(out).toBeNull()
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm test -- normalizer`
Expected: FAIL (no existe `./normalizer`).

- [ ] **Step 3: Implementar `normalizeText`**

Crear `src/lib/normalize/normalizer.ts`:

```ts
const SYSTEM = [
  'Recibís una transcripción de voz a texto en español.',
  'Tu única tarea es hacerla más legible: agregá puntuación y mayúsculas correctas,',
  'y corregí errores obvios de transcripción (homófonos, palabras mal separadas o pegadas).',
  'NO cambies el significado, NO agregues ni quites información, NO reformules ni resumas, NO traduzcas.',
  'Si el texto ya está bien, devolvelo igual.',
  'Devolvé SOLO el texto corregido, sin comillas ni comentarios.',
].join(' ')

// Best-effort: devuelve el texto normalizado, o null si no se pudo (sin key / error).
export async function normalizeText(
  text: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  try {
    const res = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'Melo & Banana',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const out = data?.choices?.[0]?.message?.content
    return typeof out === 'string' && out.trim() ? out.trim() : null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -- normalizer`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/normalize/normalizer.ts src/lib/normalize/normalizer.test.ts
git commit -m "feat(normalize): normalizeText via OpenRouter (gemini flash lite), best-effort"
```

---

### Task 4: Servicio `ensureNormalized`

**Files:**
- Create: `src/lib/normalize/service.ts`
- Test: `src/lib/normalize/service.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/normalize/service.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { makeTestDb } from '../db/testdb'
import { createSession, saveAnswer, getSessionWithAnswers } from '../db/store'
import { ensureNormalized } from './service'
import * as normalizer from './normalizer'

describe('ensureNormalized', () => {
  it('rellena normalized_text en las respuestas pendientes', async () => {
    const spy = vi.spyOn(normalizer, 'normalizeText')
      .mockImplementation(async (t: string) => t.toUpperCase())
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'ana' })
    await saveAnswer(db, s.id, { questionId: 'empresa', rawText: 'acme' })

    await ensureNormalized(db, s.id)

    const full = await getSessionWithAnswers(db, s.id)
    const texts = full!.answers.map((a: any) => a.normalizedText).sort()
    expect(texts).toEqual(['ACME', 'ANA'])
    spy.mockRestore()
  })

  it('es idempotente: no re-normaliza lo ya hecho', async () => {
    const spy = vi.spyOn(normalizer, 'normalizeText')
      .mockImplementation(async (t: string) => t.toUpperCase())
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'ana' })

    await ensureNormalized(db, s.id)
    await ensureNormalized(db, s.id)

    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('saltea respuestas vacías o placeholder', async () => {
    const spy = vi.spyOn(normalizer, 'normalizeText')
      .mockImplementation(async (t: string) => t.toUpperCase())
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'a', rawText: '—' })
    await saveAnswer(db, s.id, { questionId: 'b', rawText: '   ' })

    await ensureNormalized(db, s.id)

    expect(spy).not.toHaveBeenCalled()
    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.answers.every((a: any) => a.normalizedText == null)).toBe(true)
    spy.mockRestore()
  })

  it('si normalizeText devuelve null, no persiste (reintenta luego)', async () => {
    const spy = vi.spyOn(normalizer, 'normalizeText').mockResolvedValue(null)
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'ana' })

    await ensureNormalized(db, s.id)

    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.answers[0].normalizedText).toBeNull()
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm test -- service`
Expected: FAIL (no existe `./service`).

- [ ] **Step 3: Implementar `ensureNormalized`**

Crear `src/lib/normalize/service.ts`:

```ts
import { getSessionWithAnswers, setNormalized } from '../db/store'
import { normalizeText } from './normalizer'

type AnyDb = any

// Normaliza perezosamente las respuestas de una sesión que aún no lo están.
// Best-effort e idempotente. Devuelve las respuestas con normalizedText poblado.
export async function ensureNormalized(db: AnyDb, sessionId: string) {
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) return []
  for (const a of full.answers) {
    if (a.normalizedText != null) continue
    const raw = (a.rawText ?? '').trim()
    if (!raw || raw === '—') continue
    const norm = await normalizeText(a.rawText)
    if (norm == null) continue
    await setNormalized(db, a.id, norm)
    a.normalizedText = norm
  }
  return full.answers
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -- service`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/normalize/service.ts src/lib/normalize/service.test.ts
git commit -m "feat(normalize): ensureNormalized perezoso e idempotente por sesión"
```

---

### Task 5: `buildBriefView` prefiere `normalizedText`

**Files:**
- Modify: `src/lib/pdf/answers-view.ts:27` y `:55-57`
- Test: `src/lib/pdf/answers-view.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `src/lib/pdf/answers-view.test.ts` (dentro del describe existente):

```ts
  it('usa normalizedText cuando está presente, con fallback a rawText', () => {
    const view = buildBriefView({ company: 'Acme' }, [
      { questionId: 'productos', rawText: 'cafe sin puntuacion', normalizedText: 'Café, con puntuación.' },
      { questionId: 'estrategia', rawText: 'solo cruda' },
    ])
    const proj = view.sections.find(s => s.title === 'Contexto del proyecto')!
    const productos = proj.items.find(i => i.prompt.includes('productos o servicios'))!
    const estrategia = proj.items.find(i => i.prompt.includes('estrategia de negocio'))!
    expect(productos.answer).toBe('Café, con puntuación.')
    expect(estrategia.answer).toBe('solo cruda')
  })
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- answers-view`
Expected: FAIL (usa rawText, ignora normalizedText).

- [ ] **Step 3: Actualizar `buildBriefView`**

En `src/lib/pdf/answers-view.ts`, cambiar la firma del parámetro `answers` (línea ~27) para incluir `normalizedText`:

```ts
  answers: { questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }[],
```

Y en el `.map` de items (línea ~55-57), preferir el normalizado:

```ts
    const items: TextItem[] = sec.questions
      .filter(q => q.type === 'open')
      .map(q => {
        const a = byId.get(q.id)
        return { prompt: q.prompt, answer: ((a?.normalizedText ?? a?.rawText) ?? '').trim() || '—' }
      })
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- answers-view`
Expected: PASS (y los tests previos del archivo siguen verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/answers-view.ts src/lib/pdf/answers-view.test.ts
git commit -m "feat(pdf): buildBriefView prefiere texto normalizado"
```

---

### Task 6: `buildBriefPrompt` prefiere `normalizedText`

**Files:**
- Modify: `src/lib/brief/prompt.ts:8` y `:10-11`
- Modify: `src/lib/brief/generator.ts:13`
- Test: `src/lib/brief/prompt.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `src/lib/brief/prompt.test.ts`:

```ts
import { buildBriefPrompt } from './prompt'
import { it, expect } from 'vitest'

it('usa normalizedText en el prompt cuando existe', () => {
  const out = buildBriefPrompt({ company: 'Acme' }, [
    { questionId: 'productos', rawText: 'cafe crudo', normalizedText: 'Café normalizado.', imageChoice: null },
  ])
  expect(out).toContain('Café normalizado.')
  expect(out).not.toContain('cafe crudo')
})
```

(Si el archivo ya tiene imports de vitest, no los dupliques.)

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- prompt`
Expected: FAIL (usa rawText).

- [ ] **Step 3: Actualizar `buildBriefPrompt`**

En `src/lib/brief/prompt.ts`, ampliar la firma (línea ~8) y el map (línea ~10-11):

```ts
export function buildBriefPrompt(
  session: { name?: string; company?: string },
  answers: { questionId: string; rawText: string; normalizedText?: string | null; imageChoice: string | null }[],
): string {
  const lines = answers.map(a =>
    `### ${promptOf(a.questionId)}\n${a.normalizedText ?? a.rawText}${a.imageChoice ? ` (eligió: ${a.imageChoice})` : ''}`)
```

- [ ] **Step 4: Alinear el tipo en `generateBrief`**

En `src/lib/brief/generator.ts`, ampliar el tipo del parámetro `answers` (línea ~13):

```ts
  answers: { questionId: string; rawText: string; normalizedText?: string | null; imageChoice: string | null }[],
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `npm test -- prompt`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/brief/prompt.ts src/lib/brief/generator.ts src/lib/brief/prompt.test.ts
git commit -m "feat(brief): el prompt usa texto normalizado cuando está disponible"
```

---

### Task 7: Cablear `ensureNormalized` en PDF, brief y admin

**Files:**
- Modify: `src/app/api/sessions/[id]/pdf/route.ts:23-25`
- Modify: `src/lib/brief/service.ts:7-17`
- Modify: `src/app/admin/[sessionId]/page.tsx:11-13`, `:33-41`

- [ ] **Step 1: PDF route — normalizar antes de construir la vista**

En `src/app/api/sessions/[id]/pdf/route.ts`, importar el servicio y usarlo:

```ts
import { ensureNormalized } from '@/lib/normalize/service'
```

Reemplazar el bloque de carga + vista:

```ts
  const full = await getSessionWithAnswers(db, id)
  if (!full) return new Response('No encontrado', { status: 404 })
  const answers = await ensureNormalized(db, id)
  const view = buildBriefView(full, answers)
```

- [ ] **Step 2: Brief service — normalizar y pasar el normalizado al prompt**

En `src/lib/brief/service.ts`, importar el servicio y normalizar antes de generar:

```ts
import { ensureNormalized } from '@/lib/normalize/service'
```

Reemplazar el cuerpo relevante de `generateAndSaveBrief`:

```ts
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) throw new Error('session not found')
  await ensureNormalized(db, sessionId)
  const refreshed = await getSessionWithAnswers(db, sessionId)
  // ... cliente Anthropic/OpenRouter sin cambios ...
  const brief = await generateBrief(client, refreshed!,
    refreshed!.answers.map((a: { questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }) =>
      ({ questionId: a.questionId, rawText: a.rawText, normalizedText: a.normalizedText, imageChoice: a.imageChoice })))
```

- [ ] **Step 3: Admin page — normalizar y mostrar el texto limpio**

En `src/app/admin/[sessionId]/page.tsx`:

Importar el servicio y ampliar el tipo `Answer`:

```ts
import { ensureNormalized } from '@/lib/normalize/service'
```

```ts
type Answer = { id: string; questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }
```

Tras cargar la sesión, normalizar (línea ~11-14):

```ts
  const { sessionId } = await params
  const full = await getSessionWithAnswers(db, sessionId)
  const brief = await getBrief(db, sessionId)
  if (!full) return <main className="p-8">No encontrado.</main>
  await ensureNormalized(db, sessionId)
  const fresh = await getSessionWithAnswers(db, sessionId)
```

Cambiar la sección de respuestas (línea ~33-41) para usar `fresh` y el texto normalizado, y renombrar el título:

```ts
    <section>
      <h2 className="mb-2 font-bold">Respuestas</h2>
      {(fresh!.answers as Answer[]).map(a => (
        <div key={a.id} className="mb-3">
          <p className="text-sm text-black/50">{promptOf(a.questionId)}</p>
          <p>{(a.normalizedText ?? a.rawText)}{a.imageChoice ? ` (${a.imageChoice})` : ''}</p>
        </div>
      ))}
    </section>
```

- [ ] **Step 4: Verificar typecheck y tests**

Run: `npx tsc --noEmit 2>&1 | grep -v '.next/dev/types' ; npm test`
Expected: sin errores de tsc en `src/`; todos los tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sessions/[id]/pdf/route.ts src/lib/brief/service.ts src/app/admin/[sessionId]/page.tsx
git commit -m "feat(normalize): cablear ensureNormalized en pdf, brief y panel admin"
```

---

### Task 8: Migración de DB y verificación end-to-end

**Files:** ninguno (operacional)

- [ ] **Step 1: Aplicar el schema a Neon**

Run: `npm run db:push`
Expected: drizzle-kit agrega la columna `normalized_text` a `answers` sin pérdida de datos.

- [ ] **Step 2: Build de producción (lo que corre en Vercel)**

Run: `rm -rf .next && node_modules/.bin/next build`
Expected: build OK, ruta `/api/sessions/[id]/pdf` listada.

- [ ] **Step 3: Verificación manual del flujo (opcional, requiere OPENROUTER_API_KEY)**

Con `OPENROUTER_API_KEY` en `.env`, levantar `next start`, abrir una sesión completada en `/admin/[sessionId]` y exportar el PDF. Confirmar que el texto se ve con puntuación/mayúsculas y que `raw_text` sigue intacto en la DB. Sin la key, confirmar que admin/PDF siguen funcionando sobre el crudo (best-effort).

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git add -A && git commit -m "chore(normalize): migración db y verificación e2e"
```
