# Panel documento del entregable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La vista de proyecto renderiza el entregable como el documento de 3 secciones del PDF del taller (reutilizando `buildDeckView`), y el nombre de cada respondiente abre el PDF de su entrevista.

**Architecture:** `page.tsx` obtiene el `DeckView` con `buildProjectDeckView(projectId)` (ya existe) y lo pasa a `DeliverablePanel`, que queda como shell interactivo (respondientes, generar, errores, personalidad plegada) y delega el render del documento al componente presentacional nuevo `DeliverableDocument`. Regenerar usa los mismos endpoints y recarga la página para que el servidor rearme el view-model. Spec: `docs/superpowers/specs/2026-07-10-panel-documento-entregable-design.md`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Vitest. Tipos existentes: `DeckView/DeckSection/DeckBlock/DeckItem` en `src/lib/deck/view-model.ts`; `PartKey/Part/Personalidad/Deliverable` en `src/lib/deliverable/schema.ts`.

## Global Constraints

- Sin rutas ni APIs nuevas; los endpoints `POST /api/projects/[id]/deliverable[?part=]` no cambian.
- Motion mínimo: solo `animate-fade` y transiciones de color/opacidad; `<details>` nativo sin animar. Nada se traslada ni pulsa (excepción heredada: `active:scale-[0.98]` solo en botones primarios).
- Español neutro en todo copy.
- Paleta del documento (cerrada): ink `#1a1510` (`--ink`), crema `#fffdf2` (`--cream`), banana `#ffd400` (`--banana`), gris `#6b6155`, borde `#e6dfd0`. Errores de contenido: fondo `#fff4f4`, borde `#f0d0d0`, texto `#8a3a3a`. Los grises `#8a8170`/`#a59c89` solo en el shell (respondientes, estados vacíos), no dentro del documento.
- El origen de un ítem se muestra como etiqueta de texto SOLO para `equipo` ("propuesta del equipo") y `pendiente` ("pendiente del taller"); los ítems `cliente` van sin etiqueta. No hay badges de colores.
- Sin cambios en login, lista de proyectos ni página de sesión (`/admin/[sessionId]` queda accesible solo por URL).

---

### Task 1: Mapeo sección→partes (`section-parts.ts`)

**Files:**
- Create: `src/app/admin/projects/[id]/section-parts.ts`
- Test: `src/app/admin/projects/[id]/section-parts.test.ts`

**Interfaces:**
- Consumes: `PartKey` de `@/lib/deliverable/schema`.
- Produces: `export type SectionNumber = 1 | 2 | 3` y `export function partsOfSection(numero: SectionNumber): { key: PartKey; label: string }[]` — los consume la Task 2.

- [ ] **Step 1: Escribir el test que falla** — crear `src/app/admin/projects/[id]/section-parts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { partsOfSection, type SectionNumber } from './section-parts'

describe('partsOfSection', () => {
  it('sección 1 regenera problema', () => {
    expect(partsOfSection(1)).toEqual([{ key: 'problema', label: 'Regenerar' }])
  })
  it('sección 2 regenera competencia', () => {
    expect(partsOfSection(2)).toEqual([{ key: 'competencia', label: 'Regenerar' }])
  })
  it('sección 3 regenera perfil y propuesta de valor por separado', () => {
    expect(partsOfSection(3)).toEqual([
      { key: 'perfil', label: 'Regenerar perfil' },
      { key: 'propuestaValor', label: 'Regenerar propuesta de valor' },
    ])
  })
  it('las tres secciones cubren exactamente las 4 partes imprimibles', () => {
    const keys = ([1, 2, 3] as SectionNumber[]).flatMap(n => partsOfSection(n).map(p => p.key))
    expect([...keys].sort()).toEqual(['competencia', 'perfil', 'problema', 'propuestaValor'])
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run "src/app/admin/projects/[id]/section-parts.test.ts"`
Expected: FAIL — no se puede resolver `./section-parts`.

- [ ] **Step 3: Implementación mínima** — crear `src/app/admin/projects/[id]/section-parts.ts`:

```ts
import type { PartKey } from '@/lib/deliverable/schema'

export type SectionNumber = 1 | 2 | 3

/** Qué partes del Deliverable alimentan cada sección impresa del documento, con el label de su botón de regenerar. */
export function partsOfSection(numero: SectionNumber): { key: PartKey; label: string }[] {
  if (numero === 1) return [{ key: 'problema', label: 'Regenerar' }]
  if (numero === 2) return [{ key: 'competencia', label: 'Regenerar' }]
  return [
    { key: 'perfil', label: 'Regenerar perfil' },
    { key: 'propuestaValor', label: 'Regenerar propuesta de valor' },
  ]
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run "src/app/admin/projects/[id]/section-parts.test.ts"`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/projects/[id]/section-parts.ts" "src/app/admin/projects/[id]/section-parts.test.ts"
git commit -m "feat(admin): mapeo sección→partes del documento con test"
```

---

### Task 2: `DeliverableDocument` (espejo HTML del deck)

**Files:**
- Create: `src/app/admin/projects/[id]/DeliverableDocument.tsx`

**Interfaces:**
- Consumes: `partsOfSection`, `SectionNumber` (Task 1); tipos `DeckView/DeckSection/DeckBlock/DeckItem` de `@/lib/deck/view-model`; `PartKey` de `@/lib/deliverable/schema`.
- Produces: `export function DeliverableDocument(props: { view: DeckView; busy: PartKey | 'full' | null; onRegenerate: (part: PartKey) => void }): JSX.Element` — lo consume la Task 3. Es presentacional puro (sin hooks, sin fetch); no lleva `'use client'` (lo importa un componente cliente).

- [ ] **Step 1: Crear `src/app/admin/projects/[id]/DeliverableDocument.tsx`**

```tsx
import type { DeckView, DeckSection, DeckBlock, DeckItem } from '@/lib/deck/view-model'
import type { PartKey } from '@/lib/deliverable/schema'
import { partsOfSection, type SectionNumber } from './section-parts'

const ORIGEN_LABEL: Partial<Record<DeckItem['origen'], string>> = {
  equipo: 'propuesta del equipo',
  pendiente: 'pendiente del taller',
}

function ErrorBox({ text }: { text: string }) {
  return <p className="mt-3 rounded-xl border border-[#f0d0d0] bg-[#fff4f4] px-4 py-3 text-sm text-[#8a3a3a]">{text}</p>
}

function ItemRow({ it }: { it: DeckItem }) {
  const pend = it.origen === 'pendiente'
  return (
    <div className="mt-3 flex gap-2.5">
      <span aria-hidden="true" className="shrink-0 text-[var(--banana)]">—</span>
      <div>
        <p className={`text-[15px] leading-relaxed ${pend ? 'text-[#6b6155]' : 'text-ink'}`}>{it.texto}</p>
        {!!it.cita && (
          <p className="mt-1.5 border-l-2 border-[var(--banana)] pl-2.5 text-sm leading-relaxed text-[#6b6155]">“{it.cita}”</p>
        )}
        {!!ORIGEN_LABEL[it.origen] && (
          <p className="mt-1 text-[10px] tracking-[0.08em] text-[#6b6155]">{ORIGEN_LABEL[it.origen]}</p>
        )}
      </div>
    </div>
  )
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="border-b border-[#e6dfd0] pb-1.5 font-serif text-base font-medium text-ink">{children}</h3>
}

function Block({ b }: { b: DeckBlock }) {
  return (
    <div className="mt-6 first:mt-0">
      <BlockTitle>{b.titulo}</BlockTitle>
      {b.error
        ? <ErrorBox text={`Esta parte no se pudo generar: ${b.error}`} />
        : (
          <>
            {!!b.parrafo && <p className="mt-3 text-[15px] leading-relaxed text-ink">{b.parrafo}</p>}
            {b.items.map((it, i) => <ItemRow key={i} it={it} />)}
          </>
        )}
    </div>
  )
}

function Tabla({ filas, error }: { filas: DeckSection['tabla']; error: DeckSection['tablaError'] }) {
  if (error) {
    return (
      <div className="mt-6">
        <BlockTitle>Cómo lo resolvemos, trabajo por trabajo</BlockTitle>
        <ErrorBox text={`La tabla de JTBD no se pudo generar: ${error}`} />
      </div>
    )
  }
  if (!filas.length) return null
  const th = 'py-2 pr-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6b6155]'
  return (
    <div className="mt-6">
      <BlockTitle>Cómo lo resolvemos, trabajo por trabajo</BlockTitle>
      <table className="mt-3 w-full text-left">
        <thead>
          <tr className="border-b border-[var(--ink)]">
            <th className={`w-[30%] ${th}`}>Job to be done</th>
            <th className={`w-[30%] ${th}`}>Solución</th>
            <th className={`w-[40%] ${th} pr-0`}>Cómo se resuelve</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-[#e6dfd0] align-top">
              <td className="py-2.5 pr-3 text-sm leading-relaxed text-ink">{f.job}</td>
              <td className="py-2.5 pr-3 text-sm leading-relaxed text-ink">{f.solucion}</td>
              <td className="py-2.5 text-sm leading-relaxed text-ink">
                {f.comoSeResuelve}
                {!!ORIGEN_LABEL[f.origen] && (
                  <span className="mt-1 block text-[10px] tracking-[0.08em] text-[#6b6155]">{ORIGEN_LABEL[f.origen]}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionHeader({ sec, busy, onRegenerate }: {
  sec: DeckSection
  busy: PartKey | 'full' | null
  onRegenerate: (part: PartKey) => void
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[var(--banana)] px-6 py-5">
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-5 right-4 select-none font-serif text-7xl font-medium text-[var(--ink)]/10">
        {`0${sec.numero}`}
      </span>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink)]/60">Taller Propuesta de Valor</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-medium leading-tight text-ink">{sec.titulo}</h2>
        <div className="flex flex-wrap gap-2">
          {partsOfSection(sec.numero as SectionNumber).map(({ key, label }) => (
            <button key={key} onClick={() => onRegenerate(key)} disabled={busy !== null}
              className="rounded-lg border border-[var(--ink)]/25 px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-[var(--ink)] disabled:opacity-50">
              {busy === key ? 'Regenerando…' : label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Section({ sec, busy, onRegenerate }: {
  sec: DeckSection
  busy: PartKey | 'full' | null
  onRegenerate: (part: PartKey) => void
}) {
  return (
    <section className="space-y-3">
      <SectionHeader sec={sec} busy={busy} onRegenerate={onRegenerate} />
      <div className="rounded-2xl border border-[#e6dfd0] bg-white p-6 shadow-sm">
        {sec.error
          ? <ErrorBox text={`Esta parte no se pudo generar: ${sec.error}`} />
          : (
            <>
              {sec.blocks.map((b, i) => <Block key={i} b={b} />)}
              <Tabla filas={sec.tabla} error={sec.tablaError} />
            </>
          )}
      </div>
    </section>
  )
}

/** Espejo HTML de DeckDocument (el PDF del taller): las 3 secciones numeradas del entregable. */
export function DeliverableDocument({ view, busy, onRegenerate }: {
  view: DeckView
  busy: PartKey | 'full' | null
  onRegenerate: (part: PartKey) => void
}) {
  return (
    <div className="space-y-6">
      {view.secciones.map(sec => (
        <Section key={sec.numero} sec={sec} busy={busy} onRegenerate={onRegenerate} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: sin errores. (El componente aún no se usa; la integración llega en la Task 3.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/projects/[id]/DeliverableDocument.tsx"
git commit -m "feat(admin): DeliverableDocument, espejo HTML del deck del taller"
```

---

### Task 3: Shell nuevo de `DeliverablePanel` + integración en `page.tsx`

**Files:**
- Modify: `src/app/admin/projects/[id]/DeliverablePanel.tsx` (archivo completo)
- Modify: `src/app/admin/projects/[id]/page.tsx` (archivo completo)

**Interfaces:**
- Consumes: `DeliverableDocument` (Task 2); `buildProjectDeckView(projectId: string): Promise<DeckView | null>` de `@/lib/deck/service`; tipos `Part`, `Personalidad`, `PartKey`, `Deliverable` de `@/lib/deliverable/schema`; `AdminBar` existente.
- Produces: `DeliverablePanel` con props nuevas `{ projectId: string; view: DeckView | null; personalidad: Part<Personalidad> | null; sessions: { id: string; name: string; role: string }[]; projects: { id: string; name: string }[] }`.

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/admin/projects/[id]/DeliverablePanel.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { PartKey, Part, Personalidad } from '@/lib/deliverable/schema'
import type { DeckView } from '@/lib/deck/view-model'
import { DeliverableDocument } from './DeliverableDocument'

function Linea({ label, value }: { label: string; value: string }) {
  return <p className="text-[15px] leading-relaxed text-ink"><strong className="font-medium">{label}:</strong> {value || '—'}</p>
}

export function DeliverablePanel({ projectId, view, personalidad, sessions, projects }: {
  projectId: string
  view: DeckView | null
  personalidad: Part<Personalidad> | null
  sessions: { id: string; name: string; role: string }[]
  projects: { id: string; name: string }[]
}) {
  const [busy, setBusy] = useState<PartKey | 'full' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate(part?: PartKey) {
    setBusy(part ?? 'full'); setError(null)
    try {
      const url = `/api/projects/${projectId}/deliverable${part ? `?part=${part}` : ''}`
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'error')
      }
      // El view-model se rearma en el servidor (corpus + citas verificadas).
      location.reload()
    } catch (e) { setError(String(e)); setBusy(null) }
  }

  async function reassign(sessionId: string, newProjectId: string) {
    if (!newProjectId || newProjectId === projectId) return
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: newProjectId }),
    })
    location.reload()
  }

  const pers = personalidad?.data ?? null

  return <div className="space-y-6">
    <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-ink">Respondientes ({sessions.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!!view && (
            <a href={`/api/projects/${projectId}/deck`}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--ink)]/20 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-[var(--ink)]">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
              </svg>
              Descargar PDF del taller
            </a>
          )}
          <button onClick={() => generate()} disabled={busy !== null}
            className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
            {busy === 'full' ? 'Generando…' : view ? 'Regenerar todo' : 'Generar entregable'}
          </button>
        </div>
      </div>
      <ul className="divide-y divide-black/5">
        {sessions.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex items-center gap-1.5">
              <a href={`/api/sessions/${s.id}/pdf`} target="_blank" rel="noopener"
                className="flex items-center gap-1.5 font-medium text-ink underline decoration-black/20 underline-offset-2 transition-colors hover:decoration-[var(--banana)]">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="text-[#8a8170]">
                  <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
                  <path d="M14 3v4h4" />
                </svg>
                {s.name}
              </a>
              {' · '}<span className="text-[#8a8170]">{s.role}</span>
            </span>
            <select defaultValue="" onChange={e => reassign(s.id, e.target.value)}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs text-[#8a8170] outline-none transition focus:border-[var(--banana)]">
              <option value="">mover a…</option>
              {projects.filter(p => p.id !== projectId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </section>

    {error && <div className="animate-fade rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

    {view
      ? <DeliverableDocument view={view} busy={busy} onRegenerate={k => generate(k)} />
      : (
        <section className="rounded-2xl border border-black/5 bg-white p-8 text-center shadow-sm">
          <p className="text-[15px] text-[#8a8170]">Todavía no hay entregable. Genera el documento cuando las entrevistas estén completas.</p>
        </section>
      )}

    {!!view && (
      <details className="rounded-2xl border border-[#e6dfd0] bg-white px-6 py-4 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[#6b6155]">
          Personalidad (insumo interno)
          <button onClick={e => { e.preventDefault(); generate('personalidad') }} disabled={busy !== null}
            className="rounded-lg border border-black/10 px-3 py-1 text-xs font-medium text-[#6b6155] transition-colors hover:border-[var(--ink)]/30 hover:text-ink disabled:opacity-50">
            {busy === 'personalidad' ? 'Regenerando…' : 'Regenerar'}
          </button>
        </summary>
        <div className="mt-4 space-y-2">
          {personalidad?.meta.error && (
            <p className="rounded-xl border border-[#f0d0d0] bg-[#fff4f4] px-4 py-3 text-sm text-[#8a3a3a]">{personalidad.meta.error}</p>
          )}
          {pers && (
            <>
              <Linea label="Arquetipo" value={pers.arquetipo} />
              <Linea label="Atributos" value={pers.atributos.join(', ')} />
              <Linea label="Qué NO quiere ser" value={pers.queNoQuiereSer.join(', ')} />
              <Linea label="Tensiones" value={pers.tensiones.join(' · ')} />
            </>
          )}
          {!pers && !personalidad?.meta.error && <p className="text-sm text-[#6b6155]">Sin generar.</p>}
        </div>
      </details>
    )}
  </div>
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `src/app/admin/projects/[id]/page.tsx`**

```tsx
import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, listProjects } from '@/lib/db/store'
import type { Deliverable } from '@/lib/deliverable/schema'
import { buildProjectDeckView } from '@/lib/deck/service'
import { AdminBar } from '@/components/AdminBar'
import { DeliverablePanel } from './DeliverablePanel'

export const dynamic = 'force-dynamic'

export default async function ProjectView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) return <>
    <AdminBar />
    <main className="mx-auto max-w-3xl p-8 pt-24 text-center text-[15px] text-[#8a8170]">Proyecto no encontrado.</main>
  </>
  const deliverable = (await getDeliverable(db, id))?.content as Deliverable | null
  const deckView = await buildProjectDeckView(id)
  const allProjects = await listProjects(db) as { id: string; name: string }[]
  const sessions = (project.sessions as { id: string; name?: string | null; role?: string | null }[])
    .map(s => ({ id: s.id, name: s.name ?? '—', role: s.role ?? '—' }))

  return <>
    <AdminBar />
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">Proyecto</p>
        <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">{project.name}</h1>
      </header>
      <DeliverablePanel
        projectId={id}
        view={deckView}
        personalidad={deliverable?.personalidad ?? null}
        sessions={sessions}
        projects={allProjects}
      />
    </main>
  </>
}
```

- [ ] **Step 3: Type check y suite**

Run: `npx tsc --noEmit && npx vitest run "src/app/admin/projects/[id]/section-parts.test.ts"`
Expected: tsc sin errores; 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/projects/[id]/DeliverablePanel.tsx" "src/app/admin/projects/[id]/page.tsx"
git commit -m "feat(admin): el panel muestra el documento del taller y los respondientes abren su PDF"
```

---

### Task 4: Verificación final

**Files:** ninguno (solo verificación).

**Interfaces:** n/a.

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: todo verde (nota: los tests con pglite pueden dar timeout con la máquina cargada; re-correr el archivo es suficiente).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 3: Click-through en dev** (`npm run dev`, proyecto Cafe Lunar):

1. `/admin/projects/<id>` — el entregable se ve como documento: 3 bandas banana numeradas (01/02/03), bloques con título serif y línea, ítems con guion banana, citas colgando con borde amarillo, etiquetas de origen solo en equipo/pendiente, tabla JTBD aireada. Sin badges de colores.
2. Card "Personalidad (insumo interno)" plegada al final; se abre y muestra arquetipo/atributos/no-quiere-ser/tensiones.
3. Click al nombre de un respondiente → abre el PDF de su entrevista en pestaña nueva.
4. (Si hay crédito de OpenRouter) Regenerar una sección → recarga y persiste.
5. El botón "Descargar PDF del taller" sigue funcionando.

Expected: coherencia visual documento↔PDF; sin movimiento salvo fades.

- [ ] **Step 4: Commit final (si hubo ajustes del click-through)**

```bash
git add -A && git commit -m "fix(admin): ajustes del documento post click-through"
```
