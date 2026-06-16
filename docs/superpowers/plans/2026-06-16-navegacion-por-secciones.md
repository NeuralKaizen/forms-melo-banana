# Navegación por secciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un riel lateral (desktop) / tira de segmentos (móvil) que muestra las secciones de la entrevista, indica la sección actual, permite volver a preguntas ya respondidas, y suma branding banana.

**Architecture:** Se extrae el shell compartido de `InterviewScreen`/`ProjectiveScreen` a un nuevo `InterviewLayout` de dos columnas. La columna izquierda es un `SectionNav` responsive alimentado por un nuevo helper `visibleSections(answers)` que agrupa las preguntas visibles por sección con índice global y número local. `page.tsx` calcula los datos y cablea todo; la navegación se limita a preguntas ya respondidas.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, Tailwind v4, Vitest + Testing Library (jsdom para `.tsx`). Sin jest-dom: usar props del DOM (`.disabled`, `.value`) en asserts.

**Convenciones del repo:**
- Tests con `globals: true` (no importar `describe/it/expect`… ya están, pero los tests existentes igual los importan explícitamente — seguir ese estilo).
- `.tsx` corre en jsdom automáticamente; añadir `// @vitest-environment jsdom` arriba igual que los tests existentes.
- Alias `@` → `src`.
- NO hay setup de jest-dom: usar `(el as HTMLButtonElement).disabled`, `.value`, `screen.queryBy…`, etc.
- Español neutro en todo el copy.
- Secciones del flujo de voz (identity excluida): `project` "Contexto del proyecto" (7), `consumer` "Contexto del consumidor" (4), `design` "Contexto de diseño" (3), `projective` "Ejercicio proyectivo" (6 visibles). Total visible = 20.

---

## File Structure

- **Crear** `src/components/SectionNav.tsx` — riel desktop + tira móvil. Responsabilidad: render de navegación y reglas de estado por pregunta/sección.
- **Crear** `src/components/SectionNav.test.tsx` — tests del componente.
- **Crear** `src/components/InterviewLayout.tsx` — shell de dos columnas que envuelve el `SectionNav` y el contenido de la pregunta.
- **Modificar** `src/lib/script/flow.ts` — añadir `SectionView` y `visibleSections(answers)`.
- **Modificar** `src/lib/script/flow.test.ts` — tests de `visibleSections`.
- **Modificar** `src/components/Brand.tsx` — añadir `BananaGlyph`.
- **Modificar** `src/components/InterviewScreen.tsx` — quitar shell propio; devolver solo contenido.
- **Modificar** `src/components/ProjectiveScreen.tsx` — quitar shell propio; devolver solo contenido.
- **Modificar** `src/app/interview/[sessionId]/page.tsx` — calcular `sections`/`answeredIds` y envolver con `InterviewLayout`.

---

### Task 1: Helper `visibleSections` en flow.ts

**Files:**
- Modify: `src/lib/script/flow.ts`
- Test: `src/lib/script/flow.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `src/lib/script/flow.test.ts`:

```ts
import { visibleSections } from './flow'

describe('visibleSections', () => {
  it('agrupa por sección (excluye identity) con numeración local y global', () => {
    const secs = visibleSections({})
    expect(secs.map(s => s.key)).toEqual(['project', 'consumer', 'design', 'projective'])
    expect(secs[0].title).toBe('Contexto del proyecto')
    expect(secs[0].questions[0]).toMatchObject({ index: 0, localNumber: 1 })
    expect(secs[0].questions[0].question.id).toBe('empresa_historia')
    expect(secs[0].questions.map(q => q.localNumber)).toEqual([1, 2, 3, 4, 5, 6, 7])
    const allIdx = secs.flatMap(s => s.questions.map(q => q.index))
    expect(allIdx).toEqual([...Array(20).keys()])
  })

  it('respeta el branching de género en la numeración', () => {
    const secs = visibleSections({ genero: { rawText: '', imageChoice: 'mujer' } })
    const projective = secs.find(s => s.key === 'projective')!
    const ids = projective.questions.map(q => q.question.id)
    expect(ids).toContain('edad_mujer')
    expect(ids).not.toContain('edad_hombre')
    expect(projective.questions.map(q => q.localNumber)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/script/flow.test.ts`
Expected: FAIL — `visibleSections is not a function` / import sin export.

- [ ] **Step 3: Implementar el helper**

En `src/lib/script/flow.ts`, cambiar la primera línea de import para incluir `Section`:

```ts
import type { Question, Answers, Section } from './types'
```

Y añadir al final del archivo:

```ts
export interface SectionView {
  key: Section['key']
  title: string
  questions: { question: Question; index: number; localNumber: number }[]
}

/** Preguntas visibles agrupadas por sección del flujo de voz (identity excluida). */
export function visibleSections(answers: Answers): SectionView[] {
  let globalIndex = 0
  const views: SectionView[] = []
  for (const section of SCRIPT) {
    if (section.key === 'identity') continue
    const visible = section.questions.filter(q => !q.showIf || q.showIf(answers))
    if (visible.length === 0) continue
    views.push({
      key: section.key,
      title: section.title,
      questions: visible.map((question, i) => ({
        question,
        index: globalIndex++,
        localNumber: i + 1,
      })),
    })
  }
  return views
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/script/flow.test.ts`
Expected: PASS (todos, incluidos los previos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/script/flow.ts src/lib/script/flow.test.ts
git commit -m "feat(flow): visibleSections agrupa preguntas visibles por sección"
```

---

### Task 2: `BananaGlyph` en Brand.tsx

**Files:**
- Modify: `src/components/Brand.tsx`

- [ ] **Step 1: Añadir el componente**

Al final de `src/components/Brand.tsx`:

```tsx
/** Glyph de banana — acento de marca recurrente (no emoji). */
export function BananaGlyph({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M5 4c-1 8 5 16 14 15.6.9-.05 1.4-1.1.7-1.7-.2-.2-.5-.3-.8-.4C13.4 15.6 10.2 10.6 9.6 5 9.5 4.4 9 4 8.4 4H6c-.5 0-.9.4-1 .9Z"
        fill="var(--banana)" stroke="#1a1510" strokeWidth="1.2" strokeLinejoin="round"
      />
      <path d="M5 4.2c1.1-.5 2.2-.5 3.2-.1" stroke="#1a1510" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 2: Verificar que compila/typechecks**

Run: `npx tsc --noEmit`
Expected: PASS (sin errores nuevos).

- [ ] **Step 3: Commit**

```bash
git add src/components/Brand.tsx
git commit -m "feat(brand): glyph de banana reutilizable"
```

---

### Task 3: Componente `SectionNav`

**Files:**
- Create: `src/components/SectionNav.tsx`
- Test: `src/components/SectionNav.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/SectionNav.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SectionNav } from './SectionNav'
import { visibleSections } from '@/lib/script/flow'

const sections = visibleSections({})

describe('SectionNav', () => {
  it('una pregunta respondida llama onJump con su índice global', () => {
    // empresa_historia (index 0) y productos (index 1) respondidas; actual = index 2
    const answered = new Set(['empresa_historia', 'productos'])
    const onJump = vi.fn()
    render(<SectionNav sections={sections} currentIndex={2} answeredIds={answered} onJump={onJump} />)
    const rail = screen.getByRole('navigation', { name: /preguntas/i })
    fireEvent.click(within(rail).getByRole('button', { name: /Contexto del proyecto: pregunta 1/i }))
    expect(onJump).toHaveBeenCalledWith(0)
  })

  it('una pregunta futura está deshabilitada y no navega', () => {
    const onJump = vi.fn()
    render(<SectionNav sections={sections} currentIndex={0} answeredIds={new Set()} onJump={onJump} />)
    const rail = screen.getByRole('navigation', { name: /preguntas/i })
    const future = within(rail).getByRole('button', { name: /Contexto del proyecto: pregunta 3/i })
    expect((future as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(future)
    expect(onJump).not.toHaveBeenCalled()
  })

  it('marca la sección actual con aria-current en su título de riel', () => {
    render(<SectionNav sections={sections} currentIndex={0} answeredIds={new Set()} onJump={() => {}} />)
    const rail = screen.getByRole('navigation', { name: /preguntas/i })
    const current = within(rail).getByText('Contexto del proyecto')
    expect(current.getAttribute('aria-current')).toBe('step')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/components/SectionNav.test.tsx`
Expected: FAIL — no existe `./SectionNav`.

- [ ] **Step 3: Implementar el componente**

Crear `src/components/SectionNav.tsx`:

```tsx
'use client'
import type { SectionView } from '@/lib/script/flow'
import { Wordmark, BananaGlyph } from './Brand'

export function SectionNav({ sections, currentIndex, answeredIds, onJump }: {
  sections: SectionView[]
  currentIndex: number
  answeredIds: Set<string>
  onJump: (index: number) => void
}) {
  const activeKey = sections.find(s => s.questions.some(q => q.index === currentIndex))?.key
  const active = sections.find(s => s.key === activeKey)
  const activeLocal = active?.questions.find(q => q.index === currentIndex)?.localNumber ?? 1

  return (
    <>
      {/* Desktop: riel vertical */}
      <nav aria-label="Navegación por preguntas" className="hidden md:flex md:flex-col md:gap-6">
        <div className="flex items-center gap-2">
          <BananaGlyph size={22} />
          <Wordmark className="text-sm text-ink" />
        </div>
        {sections.map(section => (
          <div key={section.key}>
            <p
              aria-current={section.key === activeKey ? 'step' : undefined}
              className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                section.key === activeKey ? 'text-ink' : 'text-[#bcb29c]'
              }`}
            >
              {section.title}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {section.questions.map(({ question, index, localNumber }) => {
                const isCurrent = index === currentIndex
                const clickable = answeredIds.has(question.id) && !isCurrent
                return (
                  <button
                    key={question.id}
                    type="button"
                    disabled={!clickable && !isCurrent}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`${section.title}: pregunta ${localNumber}`}
                    onClick={() => { if (clickable) onJump(index) }}
                    className={[
                      'grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition',
                      isCurrent
                        ? 'bg-[var(--banana)] text-ink'
                        : clickable
                          ? 'bg-black/[0.06] text-ink hover:bg-black/10 active:scale-95'
                          : 'cursor-not-allowed bg-black/[0.03] text-[#cfc7b4]',
                    ].join(' ')}
                  >
                    {localNumber}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Móvil: tira de segmentos por sección */}
      <nav aria-label="Progreso por secciones" className="md:hidden">
        <div className="flex gap-1.5">
          {sections.map(section => {
            const total = section.questions.length
            const isActive = section.key === activeKey
            const isPast = !isActive && section.questions.every(q => answeredIds.has(q.question.id))
            const fillPct = isActive
              ? Math.round((activeLocal / total) * 100)
              : isPast ? 100 : 0
            return (
              <button
                key={section.key}
                type="button"
                disabled={!isPast}
                aria-label={section.title}
                onClick={() => { if (isPast) onJump(section.questions[0].index) }}
                style={{ flexGrow: total, flexBasis: 0 }}
              >
                <span className="block h-[5px] overflow-hidden rounded-full bg-black/10">
                  <span className="block h-full rounded-full bg-[var(--banana)]" style={{ width: `${fillPct}%` }} />
                </span>
              </button>
            )
          })}
        </div>
        {active && (
          <div className="mt-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
              <BananaGlyph size={14} /> {active.title}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#bcb29c]">
              {activeLocal} de {active.questions.length}
            </span>
          </div>
        )}
      </nav>
    </>
  )
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/components/SectionNav.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SectionNav.tsx src/components/SectionNav.test.tsx
git commit -m "feat(nav): SectionNav riel desktop + tira móvil por secciones"
```

---

### Task 4: Shell `InterviewLayout`

**Files:**
- Create: `src/components/InterviewLayout.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/InterviewLayout.tsx`:

```tsx
import type { ReactNode } from 'react'
import type { SectionView } from '@/lib/script/flow'
import { SectionNav } from './SectionNav'

export function InterviewLayout({ sections, currentIndex, answeredIds, onJump, children }: {
  sections: SectionView[]
  currentIndex: number
  answeredIds: Set<string>
  onJump: (index: number) => void
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex min-h-screen w-full max-w-md flex-col bg-cream px-6 py-6 md:min-h-[80vh] md:max-w-3xl md:flex-row md:gap-8 md:rounded-[2rem] md:px-10 md:py-9 md:shadow-2xl">
        <aside className="md:w-56 md:shrink-0 md:border-r md:border-black/5 md:pr-6">
          <SectionNav sections={sections} currentIndex={currentIndex} answeredIds={answeredIds} onJump={onJump} />
        </aside>
        <div className="flex flex-1 flex-col justify-between pt-6 md:pt-0">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/InterviewLayout.tsx
git commit -m "feat(layout): InterviewLayout de dos columnas con SectionNav"
```

---

### Task 5: Quitar shell de `InterviewScreen`

**Files:**
- Modify: `src/components/InterviewScreen.tsx`
- Test: `src/components/InterviewScreen.test.tsx` (debe seguir verde sin cambios)

- [ ] **Step 1: Quitar imports del shell**

En `src/components/InterviewScreen.tsx`, borrar estas dos líneas de import:

```tsx
import { ProgressDots } from './ProgressDots'
import { Wordmark } from './Brand'
```

- [ ] **Step 2: Reemplazar el `return`**

Sustituir todo el bloque `return ( … )` (desde `return (` hasta el cierre `)` final del componente) por:

```tsx
  return (
    <>
      <div key={question.id} className="animate-q text-center md:my-auto">
        <h2 className="font-serif text-[28px] font-medium leading-snug text-ink md:text-4xl">
          {withHighlight(question.prompt, question.highlight)}
        </h2>
      </div>
      <div key={`${question.id}-controls`} className="animate-q-late flex flex-col items-center gap-6 pt-8">
        {supported && (
          <div className="flex flex-col items-center gap-2.5">
            <MicButton active={listening} onClick={toggle} />
            <span className="text-[12px] font-medium text-[#8a8170]">
              {listening ? 'Toca para cortar' : 'Toca para hablar'}
            </span>
          </div>
        )}
        <div className="flex w-full items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#bcb29c]">
          <span className="h-px flex-1 bg-black/10" /> {supported ? 'o escribe' : 'escribe'} <span className="h-px flex-1 bg-black/10" />
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          aria-label="Tu respuesta"
          placeholder="Escribe tu respuesta aquí…"
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-[var(--banana)] focus:ring-2 focus:ring-[var(--banana)]/40" rows={2} />
        <div className="mt-1 flex w-full items-center justify-center gap-3">
          {canGoBack && (
            <button onClick={onBack}
              className="rounded-xl border border-black/15 px-5 py-2.5 font-semibold text-ink transition hover:bg-black/5 active:scale-95">
              Atrás
            </button>
          )}
          {supported && !listening && text.trim() && (
            <button onClick={regrabar}
              className="rounded-xl border border-black/15 px-5 py-2.5 font-semibold text-ink transition hover:bg-black/5 active:scale-95">
              Regrabar
            </button>
          )}
          <button disabled={!text.trim()}
            onClick={() => onAnswer({ rawText: text.trim() })}
            className="group flex items-center gap-2 rounded-xl bg-[var(--ink)] px-6 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:active:scale-100">
            {index === total ? 'Finalizar' : 'Siguiente'}
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2"
              className="transition-transform duration-200 group-hover:translate-x-1">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
```

Nota: `index` y `total` siguen siendo props (se usan en el texto del botón "Siguiente/Finalizar"), así que NO se quitan de la firma.

- [ ] **Step 3: Correr los tests del componente y verificar que pasan**

Run: `npx vitest run src/components/InterviewScreen.test.tsx`
Expected: PASS (3 tests, sin cambios en el test — no dependían del shell).

- [ ] **Step 4: Commit**

```bash
git add src/components/InterviewScreen.tsx
git commit -m "refactor(interview): InterviewScreen devuelve solo contenido (sin shell)"
```

---

### Task 6: Quitar shell de `ProjectiveScreen`

**Files:**
- Modify: `src/components/ProjectiveScreen.tsx`
- Test: `src/components/ProjectiveScreen.test.tsx` (debe seguir verde sin cambios)

- [ ] **Step 1: Quitar imports del shell**

En `src/components/ProjectiveScreen.tsx`, borrar estas dos líneas de import:

```tsx
import { ProgressDots } from './ProgressDots'
import { Wordmark } from './Brand'
```

- [ ] **Step 2: Reemplazar el `return`**

Sustituir todo el bloque `return ( … )` por:

```tsx
  return (
    <>
      <div key={question.id} className="animate-q text-center md:my-auto">
        <h2 className="font-serif text-[26px] font-medium leading-snug text-ink md:text-3xl">
          {question.prompt}
        </h2>
        <div className="mt-6">
          {question.type === 'image-grid' && question.options && (
            <ImageGrid options={question.options} selected={choice} onSelect={setChoice} />
          )}
          {question.type === 'color-grid' && question.options && (
            <ColorGrid options={question.options} selected={choice} onSelect={setChoice} />
          )}
          {question.type === 'gender' && question.options && (
            <GenderChoice options={question.options} selected={choice} onSelect={setChoice} />
          )}
        </div>
      </div>
      <div key={`${question.id}-controls`} className="animate-q-late flex w-full items-center justify-center gap-3 pt-8">
        {canGoBack && (
          <button onClick={onBack}
            className="rounded-xl border border-black/15 px-5 py-2.5 font-semibold text-ink transition hover:bg-black/5 active:scale-95">
            Atrás
          </button>
        )}
        <button disabled={!choice}
          onClick={() => onAnswer({ rawText: '', imageChoice: choice })}
          className="group flex items-center gap-2 rounded-xl bg-[var(--ink)] px-6 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:active:scale-100">
          {index === total ? 'Finalizar' : 'Siguiente'}
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2"
            className="transition-transform duration-200 group-hover:translate-x-1">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </>
  )
```

- [ ] **Step 3: Correr los tests del componente y verificar que pasan**

Run: `npx vitest run src/components/ProjectiveScreen.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProjectiveScreen.tsx
git commit -m "refactor(projective): ProjectiveScreen devuelve solo contenido (sin shell)"
```

---

### Task 7: Cablear `InterviewLayout` en la página

**Files:**
- Modify: `src/app/interview/[sessionId]/page.tsx`

- [ ] **Step 1: Añadir imports**

En `src/app/interview/[sessionId]/page.tsx`, junto a los imports existentes, añadir:

```tsx
import { visibleQuestions, visibleSections } from '@/lib/script/flow'
import { InterviewLayout } from '@/components/InterviewLayout'
```

(la línea actual `import { visibleQuestions } from '@/lib/script/flow'` se reemplaza por la de arriba).

- [ ] **Step 2: Calcular sections y answeredIds**

Justo después de la línea `const q = questions[i]`, añadir:

```tsx
  const sections = visibleSections(saved)
  const answeredIds = new Set(Object.keys(saved))
```

- [ ] **Step 3: Envolver la pantalla de pregunta con `InterviewLayout`**

Reemplazar el bloque final:

```tsx
  return q.type === 'open'
    ? <InterviewScreen {...common} voice={voice} />
    : <ProjectiveScreen {...common} />
```

por:

```tsx
  return (
    <InterviewLayout sections={sections} currentIndex={i} answeredIds={answeredIds} onJump={setI}>
      {q.type === 'open'
        ? <InterviewScreen {...common} voice={voice} />
        : <ProjectiveScreen {...common} />}
    </InterviewLayout>
  )
```

(Los `Breather` de intro de sección y cierre siguen retornándose ANTES, fuera del `InterviewLayout`, sin cambios.)

- [ ] **Step 4: Verificar typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS — typecheck limpio y build de Next sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/interview/[sessionId]/page.tsx
git commit -m "feat(interview): cablear InterviewLayout con navegación por secciones"
```

---

### Task 8: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npx vitest run`
Expected: PASS — toda la suite verde (incluye los nuevos `visibleSections` y `SectionNav`).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: PASS — sin errores de typecheck ni de Next.

- [ ] **Step 3: Verificación manual en navegador (checklist)**

Run: `npm run dev` y abrir una sesión de entrevista.
Verificar:
- Desktop: el riel izquierdo muestra las 4 secciones con chips numerados; la pregunta actual en banana; el banana glyph + wordmark arriba.
- Avanzar varias preguntas y volver clic en un chip anterior → vuelve a esa pregunta con su respuesta cargada.
- Un chip de pregunta futura está atenuado y no clickeable.
- Móvil (DevTools responsive): tira de 4 segmentos arriba; el activo muestra "🍌 {sección} · n/total"; tocar un segmento de sección pasada vuelve a su inicio.

---

## Self-Review

**Spec coverage:**
- "Volver a preguntas anteriores desde riel por secciones, numeradas" → Task 1 (datos) + Task 3 (riel/chips) + Task 7 (cableado `onJump`). ✓
- "Ver en qué sección está" → Task 3 (sección activa resaltada desktop; segmento con nombre móvil). ✓
- "Branding banana" → Task 2 (`BananaGlyph`) usado en Task 3. ✓
- Layout dos columnas desktop / tira móvil → Task 4 + Task 3. ✓
- Solo navegar a respondidas → Task 3 (reglas `clickable`/`disabled`) + tests. ✓
- Breathers full-screen sin riel → Task 7 (se retornan fuera del layout). ✓
- Branching de género en numeración → Task 1 (test específico). ✓

**Placeholder scan:** Sin TBD/TODO; todo el código está completo en cada step. ✓

**Type consistency:** `SectionView { key, title, questions: { question, index, localNumber }[] }` definido en Task 1 y consumido idéntico en Tasks 3, 4, 7. `visibleSections`/`answeredIds: Set<string>`/`onJump: (index: number) => void` consistentes en `SectionNav`, `InterviewLayout` y `page.tsx`. ✓
