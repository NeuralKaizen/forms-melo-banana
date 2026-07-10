# Rediseño visual del panel admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las 4 pantallas del admin (`/admin/login`, `/admin`, `/admin/projects/[id]`, `/admin/[sessionId]`) hereden el lenguaje visual de la parte pública de M&B, sin cambiar ninguna función.

**Architecture:** Cambios de JSX/Tailwind en las 4 páginas existentes + un componente nuevo `AdminBar`. Cero cambios en rutas, APIs, datos, auth o lógica. Spec: `docs/superpowers/specs/2026-07-10-admin-rediseno-visual-design.md`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 (tokens en `src/app/globals.css`: `--cream`, `--ink`, `--banana`, clases `.bg-cream`, `.text-ink`, `.underline-banana`, `.animate-fade`), fuentes `font-serif` (Fraunces) / Inter por defecto.

**Sobre los tests:** Este plan es 100% visual (classNames y estructura JSX). El repo no tiene tests de las páginas admin (solo `src/lib/admin/auth.test.ts`, que es lógica y no se toca). Escribir tests que afirmen clases de Tailwind sería testear detalles de implementación — mala práctica. El ciclo de verificación por tarea es: **editar → `npx tsc --noEmit` (type check) → commit**, y una tarea final corre la suite completa, `next build` y un click-through manual, como pide el spec.

## Global Constraints

- **Solo visual:** ninguna función, ruta, API ni link de navegación nuevo (excepción explícita del spec: el wordmark del `AdminBar` linkea a `/admin`, navegación ya existente de facto).
- **Motion mínimo:** solo `animate-fade` y transiciones de color (`transition-colors` / `transition` de opacidad). Nada se traslada ni pulsa.
- **Español neutro** en todo copy (tuteo: "intenta", no "intentá").
- **Paleta:** crema `#fffdf2` (`--cream`), ink `#1a1510` (`--ink`), banana `#ffd400` (`--banana`), dorado eyebrow `#b08a1e`, grises cálidos `#8a8170` / `#a59c89`, fondo exterior login `#ece4d2`.
- **Badges de origen:** cliente = `bg-[#fff3c4] text-[#8a6d00]`; equipo = `bg-[#1a1510]/8 text-[#1a1510]`; pendiente = `bg-[#eeeae0] text-[#8a8170]`.
- Mismos copys funcionales existentes salvo los indicados en el spec (error de login inline, labels de eyebrow).

---

### Task 1: Login rediseñado

**Files:**
- Modify: `src/app/admin/login/page.tsx` (archivo completo, 17 líneas hoy)

**Interfaces:**
- Consumes: `LogoBlock` de `src/components/Brand.tsx` (ya existe: `LogoBlock({ size = 92 })`).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/admin/login/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { LogoBlock } from '@/components/Brand'

export default function Login() {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(false)
    const r = await fetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ pw }), headers: { 'content-type': 'application/json' } })
    if (r.ok) { location.href = '/admin'; return }
    setBusy(false); setError(true)
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex w-full max-w-md flex-col items-center bg-cream px-7 py-10 text-center md:rounded-[2rem] md:px-12 md:py-12 md:shadow-2xl">
        <LogoBlock />
        <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">
          Panel interno
        </p>
        <h1 className="mt-3 font-serif text-3xl font-medium leading-tight text-ink">
          Hola de <span className="underline-banana">nuevo</span>
        </h1>
        <form onSubmit={submit} className="mt-8 flex w-full flex-col gap-3 text-left">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8a8170]">Contraseña del equipo</label>
            <input type="password" required autoFocus value={pw} onChange={e => setPw(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-4 py-3 text-ink outline-none transition focus:border-[var(--banana)] focus:ring-2 focus:ring-[var(--banana)]/40" />
          </div>
          {error && <p className="animate-fade text-sm text-red-600">Contraseña incorrecta, intenta de nuevo.</p>}
          <button disabled={busy}
            className="mt-3 rounded-xl bg-[var(--ink)] px-4 py-3.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50">
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/login/page.tsx
git commit -m "feat(admin): login con identidad M&B y error inline"
```

---

### Task 2: `AdminBar` + lista de proyectos

**Files:**
- Create: `src/components/AdminBar.tsx`
- Modify: `src/app/admin/page.tsx` (archivo completo, 20 líneas hoy)

**Interfaces:**
- Consumes: `Wordmark` de `src/components/Brand.tsx` (ya existe: `Wordmark({ className = '' })`).
- Produces: `export function AdminBar(): JSX.Element` (sin props) — la consumen las Tasks 3 y 5.

- [ ] **Step 1: Crear `src/components/AdminBar.tsx`**

```tsx
import Link from 'next/link'
import { Wordmark } from './Brand'

/** Barra superior mínima de las páginas autenticadas del admin. Quieta: sin sticky, sin sombra, sin motion. */
export function AdminBar() {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-8 pt-6">
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

- [ ] **Step 2: Reemplazar el contenido completo de `src/app/admin/page.tsx`**

```tsx
import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listProjects } from '@/lib/db/store'
import { AdminBar } from '@/components/AdminBar'

export const dynamic = 'force-dynamic'

export default async function Admin() {
  const projects = await listProjects(db) as { id: string; name: string }[]
  return <>
    <AdminBar />
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="font-serif text-3xl font-medium text-ink">
        <span className="underline-banana">Proyectos</span>
      </h1>
      {projects.length === 0 && (
        <p className="mt-16 text-center text-[15px] text-[#8a8170]">
          Todavía no hay proyectos. Se crean al completarse una entrevista.
        </p>
      )}
      <ul className="mt-8 space-y-3">
        {projects.map(p => (
          <li key={p.id}>
            <Link href={`/admin/projects/${p.id}`}
              className="flex items-center justify-between rounded-2xl border border-black/5 bg-white px-5 py-4 shadow-sm transition-colors hover:border-[var(--banana)]">
              <span className="font-medium text-ink">{p.name}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#a59c89]">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  </>
}
```

Nota: el spec pedía eyebrow "Panel interno" también sobre el título, pero la pill del `AdminBar` ya dice exactamente eso a centímetros — duplicarlo es ruido; se omite el eyebrow de página aquí (queda registrado como desviación menor consciente del spec).

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminBar.tsx src/app/admin/page.tsx
git commit -m "feat(admin): AdminBar y lista de proyectos como cards M&B"
```

---

### Task 3: Header de la vista de proyecto

**Files:**
- Modify: `src/app/admin/projects/[id]/page.tsx` (archivo completo, 26 líneas hoy)

**Interfaces:**
- Consumes: `AdminBar` (Task 2); `DeliverablePanel` existente (sus props no cambian).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/admin/projects/[id]/page.tsx`**

```tsx
import { db } from '@/lib/db/client'
import { getProjectWithSessions, getDeliverable, listProjects } from '@/lib/db/store'
import type { Deliverable } from '@/lib/deliverable/schema'
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
        initial={deliverable ?? null}
        sessions={sessions}
        projects={allProjects}
      />
    </main>
  </>
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/projects/[id]/page.tsx"
git commit -m "feat(admin): header de proyecto con eyebrow y Fraunces"
```

---

### Task 4: Restyle de `DeliverablePanel`

**Files:**
- Modify: `src/app/admin/projects/[id]/DeliverablePanel.tsx` (archivo completo, 153 líneas hoy)

**Interfaces:**
- Consumes: nada nuevo. Props y lógica (`generate`, `reassign`, `PARTS`, `PartBody`) idénticas.
- Produces: mismo `export function DeliverablePanel` con las mismas props — Task 3 ya la consume sin cambios.

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/admin/projects/[id]/DeliverablePanel.tsx`**

Solo cambian classNames, el link del deck (pasa a botón secundario con icono) y los bloques de error/badges. Toda la lógica queda byte a byte igual. **Importante:** el commit `fafa4dc` (de otra sesión) agregó el link de cada respondiente a `/admin/${s.id}` — el código de abajo lo preserva, restilizado; no debe perderse al reescribir el archivo.

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
  o === 'cliente' ? 'bg-[#fff3c4] text-[#8a6d00]'
  : o === 'equipo' ? 'bg-[#1a1510]/8 text-[#1a1510]'
  : 'bg-[#eeeae0] text-[#8a8170]'
const badgeLabel = (o: Item['origen']) => o === 'cliente' ? 'cliente' : o === 'equipo' ? 'equipo' : 'pendiente'

function ItemList({ items }: { items: Item[] }) {
  if (!items?.length) return <p className="text-sm text-[#a59c89]">— pendiente del taller —</p>
  return <ul className="space-y-1">{items.map((i, k) => (
    <li key={k} className="flex gap-2 text-sm">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge(i.origen)}`}>{badgeLabel(i.origen)}</span>
      <span>{i.texto}{i.cita ? <em className="text-[#8a8170]"> — “{i.cita}”</em> : null}</span>
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

  return <div className="space-y-6">
    <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-ink">Respondientes ({sessions.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!!d && (
            <a href={`/api/projects/${projectId}/deck`}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--ink)]/20 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-[var(--ink)]">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
              </svg>
              PDF del taller
            </a>
          )}
          <button onClick={() => generate()} disabled={busy !== null}
            className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
            {busy === 'full' ? 'Generando…' : d ? 'Regenerar todo' : 'Generar entregable'}
          </button>
        </div>
      </div>
      <ul className="divide-y divide-black/5">
        {sessions.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span>
              <a href={`/admin/${s.id}`} className="font-medium text-ink underline decoration-black/20 underline-offset-2 transition-colors hover:decoration-[var(--banana)]">{s.name}</a>
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

    {PARTS.map(({ key, label }) => {
      const part = d?.[key]
      return <section key={key} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">{label}</h2>
          {d && <button onClick={() => generate(key)} disabled={busy !== null}
            className="rounded-lg border border-black/10 px-3 py-1 text-xs font-medium text-[#8a8170] transition-colors hover:border-[var(--ink)]/30 hover:text-ink disabled:opacity-50">
            {busy === key ? 'Regenerando…' : 'Regenerar'}</button>}
        </div>
        {!part && <p className="text-sm text-[#a59c89]">Sin generar.</p>}
        {part?.meta.error && <p className="animate-fade rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{part.meta.error}</p>}
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
        <li key={i}>{r.marca} <span className="text-[#a59c89]">({r.tipo}, {r.origen})</span></li>)}</ul></div>
    <div><strong>Ejes de comparación:</strong>
      <ul className="space-y-1">{data.ejes.map((e: any, i: number) =>
        <li key={i}>{e.nombre}: {e.extremoIzquierdo} ↔ {e.extremoDerecho} <span className="text-[#a59c89]">({e.origen})</span></li>)}</ul></div>
    <p><strong>Posición actual:</strong> {data.posicionActual.texto} <span className="text-[#a59c89]">({data.posicionActual.origen})</span></p>
    <p><strong>Posición ideal:</strong> {data.posicionIdeal.texto} <span className="text-[#a59c89]">({data.posicionIdeal.origen})</span></p>
  </div>
  if (k === 'perfil') return <div className="space-y-3 text-sm">
    <div><strong>Jobs to be done:</strong><ItemList items={data.jobs} /></div>
    <div><strong>Gains:</strong><ItemList items={data.gains} /></div>
    <div><strong>Pains:</strong><ItemList items={data.pains} /></div>
  </div>
  // propuestaValor
  return <div className="space-y-3 text-sm">
    <p className="rounded-lg border-l-4 border-[var(--banana)] bg-[var(--cream)] p-3">
      En <strong>{data.formula.marca}</strong>, {data.formula.verbo} {data.formula.razonDeSer}. Somos {data.formula.beneficioCentral}.
    </p>
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-black/10 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8a8170]">
          <th className="py-1.5 pr-2">Job</th><th className="py-1.5 pr-2">Solución</th><th className="py-1.5">Cómo se resuelve</th>
        </tr>
      </thead>
      <tbody>{data.filas.map((f: any, i: number) => (
        <tr key={i} className="border-b border-black/5 align-top"><td className="py-1.5 pr-2">{f.job}</td><td className="py-1.5 pr-2">{f.solucion}</td><td className="py-1.5">{f.comoSeResuelve}</td></tr>
      ))}</tbody>
    </table>
  </div>
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/projects/[id]/DeliverablePanel.tsx"
git commit -m "feat(admin): DeliverablePanel con cards blancas, badges M&B y botón de deck"
```

---

### Task 5: Detalle de sesión

**Files:**
- Modify: `src/app/admin/[sessionId]/page.tsx` (archivo completo, 35 líneas hoy)

**Interfaces:**
- Consumes: `AdminBar` (Task 2).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/admin/[sessionId]/page.tsx`**

```tsx
import { db } from '@/lib/db/client'
import { getSessionWithAnswers } from '@/lib/db/store'
import { ensureNormalized } from '@/lib/normalize/service'
import { SCRIPT } from '@/lib/script/questions'
import { AdminBar } from '@/components/AdminBar'

export const dynamic = 'force-dynamic'
const promptOf = (qid: string) => SCRIPT.flatMap(s => s.questions).find(q => q.id === qid)?.prompt ?? qid

type Answer = { id: string; questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }

export default async function Detail({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) return <>
    <AdminBar />
    <main className="mx-auto max-w-2xl p-8 pt-24 text-center text-[15px] text-[#8a8170]">No encontrado.</main>
  </>
  await ensureNormalized(db, sessionId)
  const fresh = await getSessionWithAnswers(db, sessionId)
  return <>
    <AdminBar />
    <main className="mx-auto w-full max-w-2xl space-y-8 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">Respondiente</p>
          <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">{full.company} · {full.name}</h1>
        </header>
        <a href={`/api/sessions/${sessionId}/pdf`}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--ink)]/20 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-[var(--ink)]">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
          </svg>
          Descargar PDF
        </a>
      </div>
      <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="divide-y divide-black/5">
          {(fresh!.answers as Answer[]).map(a => (
            <div key={a.id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8170]">{promptOf(a.questionId)}</p>
              <p className="mt-1 text-[15px] text-ink">{(a.normalizedText ?? a.rawText)}{a.imageChoice ? ` (${a.imageChoice})` : ''}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  </>
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/[sessionId]/page.tsx"
git commit -m "feat(admin): detalle de sesión como transcripción con identidad M&B"
```

---

### Task 6: Verificación final

**Files:** ninguno (solo verificación).

**Interfaces:** n/a.

- [ ] **Step 1: Suite de tests completa**

Run: `npm test`
Expected: todos los tests en verde (nota conocida: el test de store con pglite puede timeoutear una vez en frío; re-correr si pasa).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build limpio, sin errores de tipos ni de lint.

- [ ] **Step 3: Click-through manual en dev**

Run: `npm run dev` y verificar en el navegador:
1. `/admin/login` — card centrada con LogoBlock; contraseña errónea muestra error inline (no `alert`); contraseña correcta entra.
2. `/admin` — AdminBar arriba, título Fraunces subrayado, proyectos como cards blancas con hover banana.
3. `/admin/projects/<id>` — header con eyebrow "Proyecto", card de respondientes blanca, "PDF del taller" como botón con icono, badges en paleta M&B, fórmula con borde banana.
4. `/admin/<sessionId>` — header "Respondiente", respuestas como transcripción con labels uppercase.

Expected: las 4 pantallas coherentes con la portada pública; sin movimiento salvo fades.

- [ ] **Step 4: Commit final (si hubo ajustes del click-through)**

```bash
git add -A && git commit -m "fix(admin): ajustes visuales post click-through"
```
