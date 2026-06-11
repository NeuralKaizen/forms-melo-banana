# Export de la entrevista a PDF (template determinista) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ GIT SAFETY:** Never run `git checkout`/`git switch`/`git reset` or check out a SHA. Only `git add` + `git commit` on the current branch.

**Goal:** Un PDF descargable (template fijo + respuestas literales del forms, sin IA) que el equipo de Mellow & Banana baja desde el panel admin.

**Architecture:** `@react-pdf/renderer` arma el PDF server-side. Lógica de mapeo en una función pura (`answers-view.ts`), template "tonto" en componentes react-pdf (`BriefDocument.tsx`), y un endpoint `GET /api/sessions/[id]/pdf` que renderiza al vuelo desde la base.

**Tech Stack:** Next 16 (route handler runtime node), React 19, `@react-pdf/renderer`, Vitest. Tests .ts corren en node; el test de PDF usa `// @vitest-environment node`.

Spec: `docs/superpowers/specs/2026-06-11-export-pdf-template-design.md`

---

## File Structure

- `src/lib/pdf/answers-view.ts` (+test) — función pura: `session`+`answers` → `BriefView`.
- `src/lib/pdf/BriefDocument.tsx` (+test) — `<Document>` react-pdf que pinta el `BriefView`.
- `src/app/api/sessions/[id]/pdf/route.ts` — endpoint GET de descarga.
- `src/app/admin/[sessionId]/page.tsx` — botón "Descargar PDF" (cambio mínimo).
- `package.json` — dependencia `@react-pdf/renderer`.

---

## Task 1: Instalar `@react-pdf/renderer`

**Files:** Modify `package.json`, `package-lock.json`.

- [ ] **Step 1: Instalar.** Run: `npm install @react-pdf/renderer`. Expected: se agrega a `dependencies` en package.json.

- [ ] **Step 2: Verificar import.** Run:
```bash
node -e "const r=require('@react-pdf/renderer'); console.log(typeof r.renderToBuffer, typeof r.Document)"
```
Expected: `function function` (si `renderToBuffer` no existiera en esta versión, reportarlo — el plan asume react-pdf v3+/v4 que lo exporta).

- [ ] **Step 3: Commit.** ⚠️ Si `git status` muestra cambios NO relacionados ya presentes en `package.json` (p. ej. un campo `engines`), NO los toques: stageá solo lo que agregó npm con cuidado. Si no podés aislar, reportá DONE_WITH_CONCERNS y no commitees package.json — avisá al controlador. Si el árbol estaba limpio salvo la dependencia:
```bash
git add package.json package-lock.json
git commit -m "chore(deps): @react-pdf/renderer para export a PDF"
```

---

## Task 2: View-model puro — `answers-view.ts`

**Files:**
- Create: `src/lib/pdf/answers-view.ts`
- Create: `src/lib/pdf/answers-view.test.ts`

- [ ] **Step 1: Escribir el test.** Crear `src/lib/pdf/answers-view.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildBriefView } from './answers-view'

// Date con constructor local (TZ-independiente): 11 jun 2026
const session = { name: 'Lucía', company: 'Frutaria', role: 'CMO', completedAt: new Date(2026, 5, 11) }

describe('buildBriefView', () => {
  it('mapea encabezado, secciones de texto (faltante → —) y chips proyectivos', () => {
    const answers = [
      { questionId: 'empresa_historia', rawText: 'Jugos desde 2018', imageChoice: null },
      { questionId: 'animal', rawText: '', imageChoice: 'leon' },
      { questionId: 'color', rawText: '', imageChoice: 'amarillo' },
      { questionId: 'genero', rawText: '', imageChoice: 'mujer' },
      { questionId: 'edad_mujer', rawText: '', imageChoice: '30s' },
      { questionId: 'edad_hombre', rawText: '', imageChoice: '40s' }, // stale: debe ignorarse
    ]
    const v = buildBriefView(session, answers)

    expect(v.company).toBe('Frutaria')
    expect(v.contact).toBe('Lucía · CMO')
    expect(v.date).toBe('11 jun 2026')

    const proj = v.sections.find(s => s.title === 'Contexto del proyecto')!
    expect(proj.items.find(i => i.prompt.includes('descripción'))!.answer).toBe('Jugos desde 2018')
    expect(proj.items.find(i => i.prompt.includes('estrategia'))!.answer).toBe('—')

    expect(v.projective.find(c => c.label === 'Animal')!.value).toBe('León')
    const color = v.projective.find(c => c.label === 'Color')!
    expect(color.value).toBe('Amarillo')
    expect(color.swatch).toBe('#EAB308')

    const edades = v.projective.filter(c => c.label === 'Edad')
    expect(edades).toHaveLength(1)
    expect(edades[0].value).toBe("30's")
  })

  it('empresa vacía y sin fecha degradan limpio', () => {
    const v = buildBriefView({ name: null, company: null, role: null, completedAt: null }, [])
    expect(v.company).toBe('(sin empresa)')
    expect(v.contact).toBe('')
    expect(v.date).toBe('')
    expect(v.projective).toEqual([])
  })
})
```

- [ ] **Step 2: Correr — falla.** Run: `npm test -- src/lib/pdf/answers-view`. Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar.** Crear `src/lib/pdf/answers-view.ts`:

```ts
import { SCRIPT } from '@/lib/script/questions'

export interface TextItem { prompt: string; answer: string }
export interface Chip { label: string; value: string; swatch?: string }
export interface BriefView {
  company: string
  contact: string
  date: string
  sections: { title: string; items: TextItem[] }[]
  projective: Chip[]
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fmtDate(d?: Date | null): string {
  if (!d) return ''
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const CHIP_LABEL: Record<string, string> = {
  animal: 'Animal', color: 'Color', genero: 'Género',
  edad_hombre: 'Edad', edad_mujer: 'Edad', olor: 'Olor', ciudad: 'Ciudad',
}

export function buildBriefView(
  session: { name?: string | null; company?: string | null; role?: string | null; completedAt?: Date | null },
  answers: { questionId: string; rawText: string; imageChoice?: string | null }[],
): BriefView {
  const byId = new Map(answers.map(a => [a.questionId, a]))
  const genero = byId.get('genero')?.imageChoice ?? undefined

  const sections: { title: string; items: TextItem[] }[] = []
  const projective: Chip[] = []

  for (const sec of SCRIPT) {
    if (sec.key === 'identity') continue

    if (sec.key === 'projective') {
      for (const q of sec.questions) {
        // edad: solo la variante que coincide con el género elegido (ignora la stale)
        if (q.id === 'edad_hombre' && genero === 'mujer') continue
        if (q.id === 'edad_mujer' && genero !== 'mujer') continue
        const a = byId.get(q.id)
        if (!a || (!a.rawText && !a.imageChoice)) continue
        const opt = q.options?.find(o => o.id === a.imageChoice)
        const chip: Chip = { label: CHIP_LABEL[q.id] ?? q.id, value: opt?.label ?? a.imageChoice ?? '' }
        if (q.type === 'color-grid' && opt?.colors?.length) {
          chip.swatch = opt.colors[Math.floor(opt.colors.length / 2)]
        }
        projective.push(chip)
      }
      continue
    }

    const items: TextItem[] = sec.questions
      .filter(q => q.type === 'open')
      .map(q => ({ prompt: q.prompt, answer: (byId.get(q.id)?.rawText ?? '').trim() || '—' }))
    sections.push({ title: sec.title, items })
  }

  return {
    company: session.company || '(sin empresa)',
    contact: [session.name, session.role].filter(Boolean).join(' · '),
    date: fmtDate(session.completedAt ?? null),
    sections,
    projective,
  }
}
```

- [ ] **Step 4: Correr — pasa.** Run: `npm test -- src/lib/pdf/answers-view`. Expected: PASS (2 tests).

- [ ] **Step 5: Commit.**
```bash
git add src/lib/pdf/answers-view.ts src/lib/pdf/answers-view.test.ts
git commit -m "feat(pdf): view-model puro de la entrevista (texto + chips proyectivos)"
```

---

## Task 3: Template PDF — `BriefDocument.tsx`

**Files:**
- Create: `src/lib/pdf/BriefDocument.tsx`
- Create: `src/lib/pdf/BriefDocument.test.tsx`

- [ ] **Step 1: Escribir el test** (corre en node, no jsdom). Crear `src/lib/pdf/BriefDocument.test.tsx`:

```tsx
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { BriefDocument } from './BriefDocument'
import type { BriefView } from './answers-view'

const view: BriefView = {
  company: 'Frutaria', contact: 'Lucía · CMO', date: '11 jun 2026',
  sections: [{ title: 'Contexto del proyecto', items: [
    { prompt: '¿Historia?', answer: 'Desde 2018' },
    { prompt: '¿KPIs?', answer: '—' },
  ] }],
  projective: [
    { label: 'Animal', value: 'León' },
    { label: 'Color', value: 'Amarillo', swatch: '#EAB308' },
  ],
}

describe('BriefDocument', () => {
  it('renderiza un PDF válido (empieza con %PDF)', async () => {
    const buf = await renderToBuffer(<BriefDocument view={view} />)
    expect(buf.length).toBeGreaterThan(0)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
})
```

- [ ] **Step 2: Correr — falla.** Run: `npm test -- src/lib/pdf/BriefDocument`. Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar.** Crear `src/lib/pdf/BriefDocument.tsx`:

```tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { BriefView } from './answers-view'

const C = { ink: '#1F1B14', gray: '#9A917D', cream: '#FAF6EC', banana: '#E9B949', border: '#ECE4D2', secGray: '#B9AF98', foot: '#BCB29C' }

const s = StyleSheet.create({
  page: { paddingBottom: 46, fontFamily: 'Helvetica', color: C.ink, fontSize: 11 },
  band: { height: 10, backgroundColor: C.banana },
  body: { paddingHorizontal: 40, paddingTop: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  logo: { width: 46, height: 46, borderRadius: 8, backgroundColor: C.banana, alignItems: 'center', justifyContent: 'center' },
  logoTxt: { fontFamily: 'Times-Roman', fontSize: 8, color: '#ffffff', textAlign: 'center' },
  title: { fontFamily: 'Times-Roman', fontSize: 20 },
  subtitle: { color: C.gray, fontSize: 10, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 24, marginBottom: 4 },
  metaLabel: { color: C.gray, fontSize: 9 },
  metaVal: { fontSize: 12 },
  secTitle: { fontFamily: 'Times-Roman', fontSize: 12, color: C.secGray, textTransform: 'uppercase', letterSpacing: 1, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4, marginTop: 18, marginBottom: 4 },
  q: { color: C.gray, fontSize: 10, marginTop: 8 },
  a: { fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.cream, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  chipLabel: { color: C.gray, fontSize: 9 },
  chipVal: { fontSize: 11 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  foot: { position: 'absolute', bottom: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, fontSize: 9, color: C.foot },
})

export function BriefDocument({ view }: { view: BriefView }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.band} />
        <View style={s.body}>
          <View style={s.header}>
            <View style={s.logo}><Text style={s.logoTxt}>Mellow{'\n'}& Banana</Text></View>
            <View>
              <Text style={s.title}>Brief de entrevista</Text>
              <Text style={s.subtitle}>Ejercicio proyectivo de marca</Text>
            </View>
          </View>

          <View style={s.metaRow}>
            <View><Text style={s.metaLabel}>Empresa</Text><Text style={s.metaVal}>{view.company}</Text></View>
            {!!view.contact && <View><Text style={s.metaLabel}>Contacto</Text><Text style={s.metaVal}>{view.contact}</Text></View>}
            {!!view.date && <View><Text style={s.metaLabel}>Fecha</Text><Text style={s.metaVal}>{view.date}</Text></View>}
          </View>

          {view.sections.map((sec, i) => (
            <View key={i} wrap={false}>
              <Text style={s.secTitle}>{sec.title}</Text>
              {sec.items.map((it, j) => (
                <View key={j}>
                  <Text style={s.q}>{it.prompt}</Text>
                  <Text style={s.a}>{it.answer}</Text>
                </View>
              ))}
            </View>
          ))}

          {view.projective.length > 0 && (
            <View wrap={false}>
              <Text style={s.secTitle}>Ejercicio proyectivo</Text>
              <View style={s.chips}>
                {view.projective.map((c, i) => (
                  <View key={i} style={s.chip}>
                    <Text style={s.chipLabel}>{c.label}</Text>
                    {!!c.swatch && <View style={[s.swatch, { backgroundColor: c.swatch }]} />}
                    <Text style={s.chipVal}>{c.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={s.foot} fixed>
          <Text>Mellow &amp; Banana · Branding</Text>
          <Text>Entrevista completada</Text>
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 4: Correr — pasa.** Run: `npm test -- src/lib/pdf/BriefDocument`. Expected: PASS. (Si react-pdf rechaza la prop `gap`, reemplazá los `gap` por márgenes en los hijos y volvé a correr; reportá si hubo que hacerlo.)

- [ ] **Step 5: Commit.**
```bash
git add src/lib/pdf/BriefDocument.tsx src/lib/pdf/BriefDocument.test.tsx
git commit -m "feat(pdf): template BriefDocument (encabezado + secciones + chips)"
```

---

## Task 4: Endpoint de descarga — `route.ts`

**Files:** Create `src/app/api/sessions/[id]/pdf/route.ts`.

(No unit test — necesita base. Se verifica con tsc/build y descarga manual.)

- [ ] **Step 1: Crear `src/app/api/sessions/[id]/pdf/route.ts`:**

```ts
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { db } from '@/lib/db/client'
import { getSessionWithAnswers } from '@/lib/db/store'
import { buildBriefView } from '@/lib/pdf/answers-view'
import { BriefDocument } from '@/lib/pdf/BriefDocument'

export const runtime = 'nodejs'

function slug(company: string): string {
  const out = (company || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out || 'entrevista'
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const full = await getSessionWithAnswers(db, id)
  if (!full) return new Response('No encontrado', { status: 404 })
  const view = buildBriefView(full, full.answers)
  const buffer = await renderToBuffer(createElement(BriefDocument, { view }))
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="brief-${slug(full.company ?? '')}.pdf"`,
    },
  })
}
```

(Se usa `createElement` en vez de JSX para que el handler quede como `route.ts` sin ambigüedad de extensión.)

- [ ] **Step 2: Verificar tipos.** Run: `npx tsc --noEmit`. Expected: solo el error pre-existente `store.test.ts(20,31) TS7006`; ninguno en el route nuevo.

- [ ] **Step 3: Commit.**
```bash
git add "src/app/api/sessions/[id]/pdf/route.ts"
git commit -m "feat(pdf): endpoint GET /api/sessions/[id]/pdf que descarga el brief"
```

---

## Task 5: Botón "Descargar PDF" en el admin

**Files:** Modify `src/app/admin/[sessionId]/page.tsx`.

- [ ] **Step 1: Editar el encabezado.** En `src/app/admin/[sessionId]/page.tsx`, reemplazar la línea del título:

```tsx
    <h1 className="text-2xl font-bold text-ink">{full.company} · {full.name}</h1>
```

por:

```tsx
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-bold text-ink">{full.company} · {full.name}</h1>
      <a href={`/api/sessions/${sessionId}/pdf`}
        className="shrink-0 rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
        Descargar PDF
      </a>
    </div>
```

- [ ] **Step 2: Verificar tipos + build.** Run: `npx tsc --noEmit` (solo el TS7006 pre-existente) y `npm run build` (compila sin error — confirma que el route con react-pdf empaqueta bien para producción).

- [ ] **Step 3: Commit.**
```bash
git add "src/app/admin/[sessionId]/page.tsx"
git commit -m "feat(admin): botón Descargar PDF en el detalle de sesión"
```

---

## Verificación final (manual)

- [ ] `npm test` → todo verde. `npx tsc --noEmit` → solo el TS7006 pre-existente. `npm run build` → compila.
- [ ] `npm run dev`; crear/elegir una sesión con respuestas; abrir `/admin/login`, entrar al detalle, tocar "Descargar PDF". Abrir el archivo: encabezado con empresa/contacto/fecha, secciones de texto con las respuestas (faltantes → "—"), y los chips proyectivos con etiqueta/valor (color con su swatch).
- [ ] Probar también `GET /api/sessions/<id>/pdf` directo en el navegador (descarga `brief-<empresa>.pdf`).

## Fuera de alcance
- Brief de IA en el PDF — diferido.
- Miniaturas de imágenes — se eligieron chips.
- Fuente de marca custom — Times/Helvetica built-in por ahora.
