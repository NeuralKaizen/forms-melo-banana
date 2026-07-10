# Layout ancho con paneles crema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La vista de proyecto se ensancha a 1024px y el documento organiza sus bloques en grilla de 2 columnas con paneles crema.

**Architecture:** Tres archivos: `AdminBar` gana prop `wide`; `page.tsx` del proyecto pasa a `max-w-5xl`; `DeliverableDocument` coloca los bloques en `grid md:grid-cols-2` (regla del impar: el último bloque de una cuenta impar ocupa el ancho; la tabla siempre a lo ancho) y cada bloque se vuelve panel `#fbf8ee`. Cero cambios de lógica. Spec: `docs/superpowers/specs/2026-07-10-layout-documento-ancho-design.md`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4.

## Global Constraints

- Solo presentación: sin cambios de lógica, datos, rutas ni endpoints.
- Motion mínimo: solo `animate-fade` y transiciones de color/opacidad.
- Español neutro.
- Paleta del documento: ink `#1a1510`, banana `#ffd400`, gris `#6b6155`, borde `#e6dfd0`, **panel crema `#fbf8ee`** (nuevo), errores `#fff4f4`/`#f0d0d0`/`#8a3a3a`.
- Lista de proyectos y página de sesión NO cambian de ancho (AdminBar sin `wide` = `max-w-3xl` como hoy).
- Transcripción byte a byte, incluidos caracteres especiales (comillas tipográficas “ ”, guion largo —, puntos suspensivos …).

---

### Task 1: `AdminBar` con prop `wide` + página de proyecto a `max-w-5xl`

**Files:**
- Modify: `src/components/AdminBar.tsx` (archivo completo)
- Modify: `src/app/admin/projects/[id]/page.tsx` (archivo completo)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `export function AdminBar({ wide }: { wide?: boolean })` — `wide` default `false`; con `wide` el header usa `max-w-5xl`. Las páginas existentes que usan `<AdminBar />` sin prop no cambian.

- [ ] **Step 1: Reemplazar el contenido completo de `src/components/AdminBar.tsx`**

```tsx
import Link from 'next/link'
import { Wordmark } from './Brand'

/** Barra superior mínima de las páginas autenticadas del admin. Quieta: sin sticky, sin sombra, sin motion. */
export function AdminBar({ wide = false }: { wide?: boolean }) {
  return (
    <header className={`mx-auto flex w-full items-center justify-between px-8 pt-6 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <Link href="/admin" className="text-lg font-medium text-ink">
        <Wordmark />
      </Link>
      <span className="rounded-full border border-[#b08a1e]/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">
        Panel interno
      </span>
    </header>
  )
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
    <AdminBar wide />
    <main className="mx-auto max-w-5xl p-8 pt-24 text-center text-[15px] text-[#8a8170]">Proyecto no encontrado.</main>
  </>
  const deliverable = (await getDeliverable(db, id))?.content as Deliverable | null
  const deckView = await buildProjectDeckView(id)
  const allProjects = await listProjects(db) as { id: string; name: string }[]
  const sessions = (project.sessions as { id: string; name?: string | null; role?: string | null }[])
    .map(s => ({ id: s.id, name: s.name ?? '—', role: s.role ?? '—' }))

  return <>
    <AdminBar wide />
    <main className="mx-auto w-full max-w-5xl space-y-8 p-8">
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

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminBar.tsx "src/app/admin/projects/[id]/page.tsx"
git commit -m "feat(admin): vista de proyecto ancha con AdminBar alineada"
```

---

### Task 2: Grilla de bloques y paneles crema en `DeliverableDocument`

**Files:**
- Modify: `src/app/admin/projects/[id]/DeliverableDocument.tsx` (archivo completo)

**Interfaces:**
- Consumes: sin cambios — mismos tipos e imports (`partsOfSection`, `SectionNumber`, tipos del view-model).
- Produces: mismo `export function DeliverableDocument({ view, busy, onRegenerate })`; `DeliverablePanel` no cambia.

Qué cambia respecto al archivo actual: `Block` recibe `wide?: boolean` y se vuelve panel crema (`rounded-xl bg-[#fbf8ee] p-5`, con `md:col-span-2` si `wide`); `BlockTitle` pierde `border-b`/`pb-1.5`; `Tabla` se envuelve en panel crema a lo ancho; `Section` coloca bloques y tabla en `grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8` aplicando la regla del impar; desaparecen los `mt-6 first:mt-0` (el gap de la grilla da el espacio). Ítems, citas, tags, `ErrorBox`, `SectionHeader` y `DeliverableDocument` quedan idénticos.

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/admin/projects/[id]/DeliverableDocument.tsx`**

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
  return <h3 className="font-serif text-base font-medium text-ink">{children}</h3>
}

function Block({ b, wide = false }: { b: DeckBlock; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-[#fbf8ee] p-5${wide ? ' md:col-span-2' : ''}`}>
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
      <div className="rounded-xl bg-[#fbf8ee] p-5 md:col-span-2">
        <BlockTitle>Cómo lo resolvemos, trabajo por trabajo</BlockTitle>
        <ErrorBox text={`La tabla de JTBD no se pudo generar: ${error}`} />
      </div>
    )
  }
  if (!filas.length) return null
  const th = 'py-2 pr-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6b6155]'
  return (
    <div className="rounded-xl bg-[#fbf8ee] p-5 md:col-span-2">
      <BlockTitle>Cómo lo resolvemos, trabajo por trabajo</BlockTitle>
      <table className="mt-3 w-full text-left">
        <thead>
          <tr className="border-b border-[var(--ink)]">
            <th scope="col" className={`w-[30%] ${th}`}>Job to be done</th>
            <th scope="col" className={`w-[30%] ${th}`}>Solución</th>
            <th scope="col" className={`w-[40%] ${th} pr-0`}>Cómo se resuelve</th>
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
  const impar = sec.blocks.length % 2 === 1
  return (
    <section className="space-y-3">
      <SectionHeader sec={sec} busy={busy} onRegenerate={onRegenerate} />
      <div className="rounded-2xl border border-[#e6dfd0] bg-white p-6 shadow-sm">
        {sec.error
          ? <ErrorBox text={`Esta parte no se pudo generar: ${sec.error}`} />
          : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8">
              {sec.blocks.map((b, i) => (
                <Block key={i} b={b} wide={impar && i === sec.blocks.length - 1} />
              ))}
              <Tabla filas={sec.tabla} error={sec.tablaError} />
            </div>
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
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/projects/[id]/DeliverableDocument.tsx"
git commit -m "feat(admin): bloques en grilla de dos columnas con paneles crema"
```

---

### Task 3: Verificación final

**Files:** ninguno (solo verificación).

**Interfaces:** n/a.

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: todo verde (nota: los tests con pglite pueden dar timeout con la máquina cargada; re-correr esos archivos es suficiente).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 3: Click-through en dev** (`npm run dev`, proyecto Cafe Lunar):

1. Vista de proyecto a 1024px con AdminBar alineada al mismo ancho.
2. Sección 01: [mundo | marca], [consumidor | cómo], [relevante a lo ancho]. Sección 02: pares y [posición ideal a lo ancho]. Sección 03: [jobs | gains], [pains | síntesis], tabla a lo ancho.
3. Cada bloque en panel crema `#fbf8ee`, título serif sin línea inferior.
4. Viewport angosto (móvil): todo en 1 columna, mismo orden.
5. Lista de proyectos y página de sesión siguen en `max-w-3xl`.

Expected: sin movimiento salvo fades; nada de lógica cambiada.

- [ ] **Step 4: Commit final (si hubo ajustes del click-through)**

```bash
git add -A && git commit -m "fix(admin): ajustes del layout ancho post click-through"
```
