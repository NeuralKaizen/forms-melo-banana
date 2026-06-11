# Ejercicio proyectivo completo + branching + navegación manual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ GIT SAFETY:** Never run `git checkout`/`git switch`/`git reset` or check out a SHA — it has detached HEAD and lost work before. Only `git add` + `git commit` on the current branch.

**Goal:** Completar el ejercicio proyectivo (7 preguntas mouse-only con branching género→edad), y cambiar la navegación para que grabar ya no avance solo.

**Architecture:** El script (`SCRIPT`) gana 6 preguntas proyectivas con un modelo de opción unificado (`Option` con `src?`/`colors?`). El flujo se vuelve dinámico vía `visibleQuestions(answers)` (predicado `showIf`). Un componente nuevo `ProjectiveScreen` (mouse-only) renderiza imagen/color/género; `InterviewScreen` queda solo para voz y deja de auto-avanzar.

**Tech Stack:** Next 16, React 19, Tailwind v4, Vitest + @testing-library/react (jsdom para .tsx, primer línea `// @vitest-environment jsdom`). Sin jest-dom: usar aserciones planas (`el.disabled`, `.value`, `getAttribute`).

Spec: `docs/superpowers/specs/2026-06-11-proyectiva-completa-design.md`

---

## File Structure

- `src/components/InterviewScreen.tsx` (+test) — quitar auto-advance; queda solo para `open`.
- `src/lib/script/types.ts` — `QuestionType` + `Option` + `Answers` + `showIf`.
- `src/components/ImageGrid.tsx` — tipar `Option`.
- `src/lib/script/questions.ts` (+test) — 7 preguntas proyectivas.
- `src/lib/script/flow.ts` (+test) — `visibleQuestions(answers)`.
- `src/components/ColorGrid.tsx` (+test) — nuevo, paletas CSS.
- `src/components/GenderChoice.tsx` (+test) — nuevo, siluetas SVG.
- `src/components/ProjectiveScreen.tsx` (+test) — nuevo, mouse-only.
- `src/app/interview/[sessionId]/page.tsx` — flujo dinámico + routeo voz/proyectiva.
- `scripts/fetch-projective-images.sh` + `public/projective/**` — assets.

---

## Task 1: Navegación manual (InterviewScreen solo-voz, sin auto-advance)

**Files:**
- Modify: `src/components/InterviewScreen.tsx`
- Modify: `src/components/InterviewScreen.test.tsx`

- [ ] **Step 1: Reescribir el test** — reemplazar el contenido de `src/components/InterviewScreen.test.tsx` por:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { InterviewScreen } from './InterviewScreen'
import { FakeVoice } from '@/lib/voice/fake-voice'
import type { Question } from '@/lib/script/types'

const q: Question = { id: 'demo', type: 'open', prompt: '¿Qué tal?', audio: '/audio/demo.mp3' }

describe('InterviewScreen', () => {
  it('toggle: 2do toque llena el texto y NO avanza; Siguiente avanza', async () => {
    const voice = new FakeVoice('una respuesta completa', ['una', 'una respuesta'])
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={1} total={20} voice={voice} onAnswer={onAnswer} />)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /hablar/i })) })
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(ta.value).toBe('una respuesta')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /cortar/i })) })
    expect(ta.value).toBe('una respuesta completa')
    expect(onAnswer).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onAnswer).toHaveBeenCalledWith({ rawText: 'una respuesta completa' })
  })

  it('regrabar limpia el texto y vuelve a escuchar (sin avanzar)', async () => {
    const voice = new FakeVoice('', [])
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={2} total={20} voice={voice}
      initial={{ rawText: 'texto previo' }} canGoBack onAnswer={onAnswer} />)

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('texto previo')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /regrabar/i })) })
    expect(voice.started).toBe(true)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('sin voz: oculta el micro y avanza al escribir + Siguiente', () => {
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={1} total={20} onAnswer={onAnswer} />)
    expect(screen.queryByRole('button', { name: /hablar/i })).toBeNull()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tecleado' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onAnswer).toHaveBeenCalledWith({ rawText: 'tecleado' })
  })
})
```

- [ ] **Step 2: Correr el test — debe fallar.** Run: `npm test -- src/components/InterviewScreen`. Expected: FAIL (hoy auto-avanza y onAnswer manda `imageChoice`).

- [ ] **Step 3: Reescribir `src/components/InterviewScreen.tsx`** (solo `open`, sin image-grid, sin auto-advance) — reemplazar todo el archivo por:

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import type { Question } from '@/lib/script/types'
import type { VoiceAdapter } from '@/lib/voice/types'
import { ProgressDots } from './ProgressDots'
import { MicButton } from './MicButton'
import { Wordmark } from './Brand'

function withHighlight(prompt: string, highlight?: string) {
  if (!highlight || !prompt.includes(highlight)) return prompt
  const [a, b] = prompt.split(highlight)
  return <>{a}<span className="underline-banana">{highlight}</span>{b}</>
}

export function InterviewScreen({ question, index, total, voice, initial, canGoBack, onBack, onAnswer }: {
  question: Question; index: number; total: number
  voice?: VoiceAdapter
  initial?: { rawText: string; imageChoice?: string }
  canGoBack?: boolean
  onBack?: () => void
  onAnswer: (a: { rawText: string }) => void
}) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const textRef = useRef('')
  const busy = useRef(false)

  useEffect(() => { textRef.current = text }, [text])

  useEffect(() => {
    // Reset intencional al cambiar de pregunta (carga la respuesta guardada si se vuelve atrás).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(initial?.rawText ?? ''); setListening(false)
    return () => { void voice?.stop() } // corta el micro al cambiar de pregunta/desmontar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id])

  const supported = !!voice?.isSTTSupported()

  function startListening() {
    setText(''); setListening(true)
    voice!.start(p => setText(p))
  }

  async function toggle() {
    if (!voice || !supported || busy.current) return
    busy.current = true
    try {
      if (listening) {
        const final = await voice.stop()
        setListening(false)
        setText(final || textRef.current) // solo llena el texto; NO avanza
      } else {
        startListening()
      }
    } finally {
      busy.current = false
    }
  }

  function regrabar() {
    if (!voice || !supported) return
    startListening()
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex min-h-screen w-full max-w-md flex-col justify-between bg-cream px-6 py-6 md:min-h-[80vh] md:max-w-xl md:rounded-[2rem] md:px-10 md:py-9 md:shadow-2xl">
        <div className="flex items-center justify-between">
          <Wordmark className="text-base text-ink" />
          <ProgressDots index={index} total={total} />
        </div>
        <div key={question.id} className="animate-q text-center">
          <h2 className="mt-8 font-serif text-[28px] font-medium leading-snug text-ink md:mt-10 md:text-4xl">
            {withHighlight(question.prompt, question.highlight)}
          </h2>
        </div>
        <div className="flex flex-col items-center gap-6 pt-4">
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
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Correr el test — debe pasar.** Run: `npm test -- src/components/InterviewScreen`. Expected: 3 passed.

- [ ] **Step 5: Commit**
```bash
git add src/components/InterviewScreen.tsx src/components/InterviewScreen.test.tsx
git commit -m "feat(ui): InterviewScreen solo-voz sin auto-advance (revisar y Siguiente a mano)"
```

---

## Task 2: Modelo de opción unificado (types + ImageGrid)

**Files:**
- Modify: `src/lib/script/types.ts`
- Modify: `src/components/ImageGrid.tsx`

Este es un refactor de tipos; se verifica con `tsc` + suite (no test nuevo).

- [ ] **Step 1: Reemplazar `src/lib/script/types.ts`** por:

```ts
export type QuestionType = 'open' | 'image-grid' | 'color-grid' | 'gender'

export interface Option {
  id: string
  label: string
  src?: string       // image-grid: ruta bajo /public
  colors?: string[]  // color-grid: rampa de shades CSS (claro→oscuro)
}

export type Answers = Record<string, { rawText: string; imageChoice?: string }>

export interface Question {
  id: string
  type: QuestionType
  prompt: string
  /** key idea to underline in the UI (substring of prompt) */
  highlight?: string
  audio: string // /audio/<id>.mp3
  options?: Option[]
  /** Si está y devuelve false, la pregunta se omite del flujo (branching). */
  showIf?: (answers: Answers) => boolean
}

export interface Section {
  key: 'identity' | 'project' | 'consumer' | 'design' | 'projective'
  title: string
  questions: Question[]
}
```

- [ ] **Step 2: Verificar quién importaba `ImageOption`.** Run: `grep -rn "ImageOption" src`. Expected: solo `src/components/ImageGrid.tsx` (ya no existe en types). Si aparece otro archivo, actualizarlo a `Option` igual que ImageGrid.

- [ ] **Step 3: Actualizar `src/components/ImageGrid.tsx`** — cambiar la primera línea de import:
```tsx
import type { Option } from '@/lib/script/types'
```
y la firma de props:
```tsx
export function ImageGrid({ options, selected, onSelect }: {
  options: Option[]; selected?: string; onSelect: (id: string) => void
}) {
```
(el resto del componente no cambia.)

- [ ] **Step 4: Verificar tipos y suite.** Run: `npx tsc --noEmit` → solo el error pre-existente `store.test.ts(20,31) TS7006` es aceptable; nada más. Run: `npm test` → todo verde.

- [ ] **Step 5: Commit**
```bash
git add src/lib/script/types.ts src/components/ImageGrid.tsx
git commit -m "refactor(script): unificar opciones en Option (src?/colors?) + Answers + showIf"
```

---

## Task 3: Guion proyectivo (7 preguntas)

**Files:**
- Modify: `src/lib/script/questions.ts`
- Modify: `src/lib/script/questions.test.ts`
- Modify: `src/lib/script/flow.test.ts`

- [ ] **Step 1: Actualizar tests.** En `src/lib/script/questions.test.ts`, reemplazar el test `'image-grid questions declare 2+ options, open questions declare none'` por:

```ts
  it('opciones coinciden con el tipo de pregunta', () => {
    for (const s of SCRIPT) for (const q of s.questions) {
      if (q.type === 'open') { expect(q.options).toBeUndefined() }
      else { expect(q.options!.length).toBeGreaterThanOrEqual(2) }
      if (q.type === 'image-grid') for (const o of q.options!) expect(o.src).toBeTruthy()
      if (q.type === 'color-grid') for (const o of q.options!) expect((o.colors ?? []).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('la sección proyectiva tiene las 7 preguntas', () => {
    const proj = SCRIPT.find(s => s.key === 'projective')!
    expect(proj.questions.map(q => q.id)).toEqual([
      'animal', 'color', 'genero', 'edad_hombre', 'edad_mujer', 'olor', 'ciudad',
    ])
  })
```

En `src/lib/script/flow.test.ts`, el test `'excludes the 4 identity questions, leaving 15'` ahora son **21** (14 no-proyectivas + 7 proyectivas). Cambiar el `toHaveLength(15)` por `toHaveLength(21)` y el texto del `it` a `'excludes the 4 identity questions, leaving 21'`.

- [ ] **Step 2: Correr — deben fallar.** Run: `npm test -- src/lib/script`. Expected: FAIL (la sección projective hoy tiene solo `animal` con opciones viejas; `leaving 21` falla con 15).

- [ ] **Step 3: Reemplazar la sección `projective` en `src/lib/script/questions.ts`.** Localizar el bloque `{ key: 'projective', ... }` (último de `SCRIPT`) y reemplazarlo COMPLETO por:

```ts
  {
    key: 'projective', title: 'Ejercicio proyectivo',
    questions: [
      {
        id: 'animal', type: 'image-grid', highlight: 'animal', audio: '/audio/animal.mp3',
        prompt: 'Si la compañía fuera un animal, ¿cuál sería?',
        options: [
          { id: 'conejo', label: 'Conejo', src: '/projective/animal/conejo.jpg' },
          { id: 'caballo', label: 'Caballo', src: '/projective/animal/caballo.jpg' },
          { id: 'leon', label: 'León', src: '/projective/animal/leon.jpg' },
          { id: 'delfin', label: 'Delfín', src: '/projective/animal/delfin.jpg' },
          { id: 'aguila', label: 'Águila', src: '/projective/animal/aguila.jpg' },
          { id: 'iguana', label: 'Iguana', src: '/projective/animal/iguana.jpg' },
          { id: 'perro', label: 'Perro', src: '/projective/animal/perro.jpg' },
          { id: 'gato', label: 'Gato', src: '/projective/animal/gato.jpg' },
          { id: 'flamenco', label: 'Flamenco', src: '/projective/animal/flamenco.jpg' },
        ],
      },
      {
        id: 'color', type: 'color-grid', highlight: 'color', audio: '/audio/color.mp3',
        prompt: 'Si la compañía fuera un color, ¿cuál sería?',
        options: [
          { id: 'amarillo', label: 'Amarillo', colors: ['#FEF9C3', '#FDE047', '#EAB308', '#CA8A04', '#854D0E'] },
          { id: 'violeta', label: 'Violeta', colors: ['#F3E8FF', '#D8B4FE', '#A855F7', '#7E22CE', '#581C87'] },
          { id: 'naranja', label: 'Naranja', colors: ['#FFEDD5', '#FDBA74', '#F97316', '#EA580C', '#9A3412'] },
          { id: 'rojo', label: 'Rojo', colors: ['#FEE2E2', '#FCA5A5', '#EF4444', '#DC2626', '#7F1D1D'] },
          { id: 'marron', label: 'Marrón', colors: ['#EFE2D2', '#C9A27A', '#92633B', '#5C3A1E', '#3B2412'] },
          { id: 'verde', label: 'Verde', colors: ['#ECFCCB', '#BEF264', '#84CC16', '#4D7C0F', '#365314'] },
          { id: 'azul', label: 'Azul', colors: ['#DBEAFE', '#60A5FA', '#2563EB', '#1D4ED8', '#0C2A66'] },
          { id: 'gris', label: 'Gris', colors: ['#F3F4F6', '#9CA3AF', '#4B5563', '#1F2937', '#030712'] },
          { id: 'teal', label: 'Teal', colors: ['#CCFBF1', '#5EEAD4', '#14B8A6', '#0F766E', '#134E4A'] },
        ],
      },
      {
        id: 'genero', type: 'gender', highlight: 'género', audio: '/audio/genero.mp3',
        prompt: 'Si la compañía tuviera un género, ¿cuál sería?',
        options: [
          { id: 'hombre', label: 'Hombre' },
          { id: 'mujer', label: 'Mujer' },
        ],
      },
      {
        id: 'edad_hombre', type: 'image-grid', highlight: 'edad', audio: '/audio/edad_hombre.mp3',
        prompt: 'Si la compañía tuviera una edad, ¿cuál sería?',
        showIf: (a) => a['genero']?.imageChoice !== 'mujer',
        options: [
          { id: '20s', label: "20's", src: '/projective/edad-hombre/20s.jpg' },
          { id: '30s', label: "30's", src: '/projective/edad-hombre/30s.jpg' },
          { id: '40s', label: "40's", src: '/projective/edad-hombre/40s.jpg' },
          { id: '50s', label: "50's", src: '/projective/edad-hombre/50s.jpg' },
          { id: '60s', label: "60's", src: '/projective/edad-hombre/60s.jpg' },
        ],
      },
      {
        id: 'edad_mujer', type: 'image-grid', highlight: 'edad', audio: '/audio/edad_mujer.mp3',
        prompt: 'Si la compañía tuviera una edad, ¿cuál sería?',
        showIf: (a) => a['genero']?.imageChoice === 'mujer',
        options: [
          { id: '20s', label: "20's", src: '/projective/edad-mujer/20s.jpg' },
          { id: '30s', label: "30's", src: '/projective/edad-mujer/30s.jpg' },
          { id: '40s', label: "40's", src: '/projective/edad-mujer/40s.jpg' },
          { id: '50s', label: "50's", src: '/projective/edad-mujer/50s.jpg' },
          { id: '60s', label: "60's", src: '/projective/edad-mujer/60s.jpg' },
        ],
      },
      {
        id: 'olor', type: 'image-grid', highlight: 'olor', audio: '/audio/olor.mp3',
        prompt: 'Si la compañía tuviera un olor, ¿cuál sería?',
        options: [
          { id: 'cerezo', label: 'Cerezo', src: '/projective/olor/cerezo.jpg' },
          { id: 'pina', label: 'Piña', src: '/projective/olor/pina.jpg' },
          { id: 'cesped', label: 'Césped', src: '/projective/olor/cesped.jpg' },
          { id: 'rio', label: 'Río', src: '/projective/olor/rio.jpg' },
          { id: 'caramelos', label: 'Caramelos', src: '/projective/olor/caramelos.jpg' },
          { id: 'madera', label: 'Madera', src: '/projective/olor/madera.jpg' },
          { id: 'hierba', label: 'Hierba', src: '/projective/olor/hierba.jpg' },
          { id: 'naranjas', label: 'Naranjas', src: '/projective/olor/naranjas.jpg' },
          { id: 'rosas', label: 'Rosas', src: '/projective/olor/rosas.jpg' },
        ],
      },
      {
        id: 'ciudad', type: 'image-grid', highlight: 'ciudad', audio: '/audio/ciudad.mp3',
        prompt: 'Si la compañía fuera una ciudad, ¿cuál sería?',
        options: [
          { id: 'bali', label: 'Bali', src: '/projective/ciudad/bali.jpg' },
          { id: 'ny', label: 'New York', src: '/projective/ciudad/ny.jpg' },
          { id: 'barcelona', label: 'Barcelona', src: '/projective/ciudad/barcelona.jpg' },
          { id: 'delhi', label: 'Delhi', src: '/projective/ciudad/delhi.jpg' },
          { id: 'lasvegas', label: 'Las Vegas', src: '/projective/ciudad/lasvegas.jpg' },
          { id: 'berlin', label: 'Berlín', src: '/projective/ciudad/berlin.jpg' },
          { id: 'paris', label: 'París', src: '/projective/ciudad/paris.jpg' },
          { id: 'dubai', label: 'Dubai', src: '/projective/ciudad/dubai.jpg' },
          { id: 'marrakech', label: 'Marrakech', src: '/projective/ciudad/marrakech.jpg' },
        ],
      },
    ],
  },
```

- [ ] **Step 4: Correr — deben pasar.** Run: `npm test -- src/lib/script`. Expected: PASS (todos).

- [ ] **Step 5: Commit**
```bash
git add src/lib/script/questions.ts src/lib/script/questions.test.ts src/lib/script/flow.test.ts
git commit -m "feat(script): 7 preguntas proyectivas (animal/color/genero/edad/olor/ciudad) con branching"
```

---

## Task 4: Flujo dinámico `visibleQuestions(answers)`

**Files:**
- Modify: `src/lib/script/flow.ts`
- Modify: `src/lib/script/flow.test.ts`

- [ ] **Step 1: Agregar el test** en `src/lib/script/flow.test.ts` (importar `visibleQuestions` junto a lo ya importado de `./flow` y `Answers` de `./types`):

```ts
import type { Answers } from './types'
// ... y agregar visibleQuestions al import existente de './flow'

describe('visibleQuestions', () => {
  it('muestra edad_hombre por defecto y oculta edad_mujer (total 20)', () => {
    const qs = visibleQuestions({})
    expect(qs).toHaveLength(20)
    expect(qs.find(q => q.id === 'edad_hombre')).toBeDefined()
    expect(qs.find(q => q.id === 'edad_mujer')).toBeUndefined()
  })
  it('con género mujer muestra edad_mujer y oculta edad_hombre (total 20)', () => {
    const answers: Answers = { genero: { rawText: '', imageChoice: 'mujer' } }
    const qs = visibleQuestions(answers)
    expect(qs).toHaveLength(20)
    expect(qs.find(q => q.id === 'edad_mujer')).toBeDefined()
    expect(qs.find(q => q.id === 'edad_hombre')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Correr — debe fallar.** Run: `npm test -- src/lib/script/flow`. Expected: FAIL (`visibleQuestions` no existe).

- [ ] **Step 3: Agregar a `src/lib/script/flow.ts`** (debajo de `interviewQuestions`), importando `Answers`:

Al tope del archivo, sumar `Answers` al import de types:
```ts
import type { Question, Answers } from './types'
```
(si hoy importa solo `Question`, agregá `Answers`.) Y agregar la función:
```ts
/** Preguntas visibles según las respuestas (aplica branching vía showIf). */
export function visibleQuestions(answers: Answers): Question[] {
  return interviewQuestions().filter(q => !q.showIf || q.showIf(answers))
}
```

- [ ] **Step 4: Correr — debe pasar.** Run: `npm test -- src/lib/script/flow`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/script/flow.ts src/lib/script/flow.test.ts
git commit -m "feat(script): visibleQuestions aplica branching género→edad (total estable 20)"
```

---

## Task 5: Componentes proyectivos (ColorGrid, GenderChoice, ProjectiveScreen)

**Files:**
- Create: `src/components/ColorGrid.tsx` (+`.test.tsx`)
- Create: `src/components/GenderChoice.tsx` (+`.test.tsx`)
- Create: `src/components/ProjectiveScreen.tsx` (+`.test.tsx`)

- [ ] **Step 1: Test de ColorGrid** — crear `src/components/ColorGrid.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColorGrid } from './ColorGrid'

describe('ColorGrid', () => {
  it('clic en una paleta llama onSelect con su id', () => {
    const onSelect = vi.fn()
    render(<ColorGrid options={[
      { id: 'amarillo', label: 'Amarillo', colors: ['#fff', '#ff0'] },
      { id: 'rojo', label: 'Rojo', colors: ['#f00', '#900'] },
    ]} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Amarillo' }))
    expect(onSelect).toHaveBeenCalledWith('amarillo')
  })
})
```

- [ ] **Step 2: Correr — falla.** Run: `npm test -- src/components/ColorGrid`. Expected: FAIL (módulo no existe).

- [ ] **Step 3: Crear `src/components/ColorGrid.tsx`:**

```tsx
import type { Option } from '@/lib/script/types'

export function ColorGrid({ options, selected, onSelect }: {
  options: Option[]; selected?: string; onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 px-2">
      {options.map(o => (
        <button key={o.id} onClick={() => onSelect(o.id)} aria-label={o.label}
          className={`relative flex aspect-square overflow-hidden rounded-2xl border-2 ${selected === o.id ? 'border-[var(--ink)]' : 'border-transparent'}`}>
          {(o.colors ?? []).map((c, i) => (
            <span key={i} className="h-full flex-1" style={{ background: c }} />
          ))}
          {selected === o.id && (
            <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--banana)] text-[11px] font-bold text-[var(--ink)]">✓</span>
          )}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Correr — pasa.** Run: `npm test -- src/components/ColorGrid`. Expected: PASS.

- [ ] **Step 5: Test de GenderChoice** — crear `src/components/GenderChoice.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GenderChoice } from './GenderChoice'

describe('GenderChoice', () => {
  it('clic en una opción llama onSelect con su id', () => {
    const onSelect = vi.fn()
    render(<GenderChoice options={[
      { id: 'hombre', label: 'Hombre' },
      { id: 'mujer', label: 'Mujer' },
    ]} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mujer' }))
    expect(onSelect).toHaveBeenCalledWith('mujer')
  })
})
```

- [ ] **Step 6: Correr — falla.** Run: `npm test -- src/components/GenderChoice`. Expected: FAIL.

- [ ] **Step 7: Crear `src/components/GenderChoice.tsx`:**

```tsx
import type { Option } from '@/lib/script/types'

function Silhouette({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" fill="var(--ink)" aria-hidden="true">
      <circle cx="32" cy="12" r="9" />
      {id === 'mujer'
        ? <><path d="M32 22 L46 48 H18 Z" /><rect x="27" y="46" width="5" height="14" rx="2" /><rect x="33" y="46" width="5" height="14" rx="2" /></>
        : <><rect x="22" y="24" width="20" height="22" rx="4" /><rect x="24" y="44" width="6" height="16" rx="2" /><rect x="34" y="44" width="6" height="16" rx="2" /></>}
    </svg>
  )
}

export function GenderChoice({ options, selected, onSelect }: {
  options: Option[]; selected?: string; onSelect: (id: string) => void
}) {
  return (
    <div className="flex justify-center gap-5">
      {options.map(o => (
        <button key={o.id} onClick={() => onSelect(o.id)} aria-label={o.label}
          className={`flex w-32 flex-col items-center gap-3 rounded-3xl border-2 px-4 py-6 transition ${selected === o.id ? 'border-[var(--ink)] bg-[var(--banana)]/15' : 'border-black/10 hover:border-black/25'}`}>
          <Silhouette id={o.id} />
          <span className="font-semibold text-ink">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Correr — pasa.** Run: `npm test -- src/components/GenderChoice`. Expected: PASS.

- [ ] **Step 9: Test de ProjectiveScreen** — crear `src/components/ProjectiveScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectiveScreen } from './ProjectiveScreen'
import type { Question } from '@/lib/script/types'

const animal: Question = {
  id: 'animal', type: 'image-grid', prompt: '¿Animal?', audio: '/audio/animal.mp3',
  options: [
    { id: 'leon', label: 'León', src: '/x.jpg' },
    { id: 'gato', label: 'Gato', src: '/y.jpg' },
  ],
}

describe('ProjectiveScreen', () => {
  it('Siguiente arranca deshabilitado; elegir lo habilita y onAnswer lleva el imageChoice', () => {
    const onAnswer = vi.fn()
    render(<ProjectiveScreen question={animal} index={5} total={20} onAnswer={onAnswer} />)
    const next = screen.getByRole('button', { name: /siguiente/i }) as HTMLButtonElement
    expect(next.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'León' }))
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
    expect(onAnswer).toHaveBeenCalledWith({ rawText: '', imageChoice: 'leon' })
  })

  it('precarga la selección inicial', () => {
    const onAnswer = vi.fn()
    render(<ProjectiveScreen question={animal} index={5} total={20} initial={{ rawText: '', imageChoice: 'gato' }} onAnswer={onAnswer} />)
    const next = screen.getByRole('button', { name: /siguiente/i }) as HTMLButtonElement
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
    expect(onAnswer).toHaveBeenCalledWith({ rawText: '', imageChoice: 'gato' })
  })
})
```

- [ ] **Step 10: Correr — falla.** Run: `npm test -- src/components/ProjectiveScreen`. Expected: FAIL.

- [ ] **Step 11: Crear `src/components/ProjectiveScreen.tsx`:**

```tsx
'use client'
import { useState, useEffect } from 'react'
import type { Question } from '@/lib/script/types'
import { ProgressDots } from './ProgressDots'
import { ImageGrid } from './ImageGrid'
import { ColorGrid } from './ColorGrid'
import { GenderChoice } from './GenderChoice'
import { Wordmark } from './Brand'

export function ProjectiveScreen({ question, index, total, initial, canGoBack, onBack, onAnswer }: {
  question: Question; index: number; total: number
  initial?: { rawText: string; imageChoice?: string }
  canGoBack?: boolean
  onBack?: () => void
  onAnswer: (a: { rawText: string; imageChoice?: string }) => void
}) {
  const [choice, setChoice] = useState<string | undefined>()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(initial?.imageChoice)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id])

  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex min-h-screen w-full max-w-md flex-col justify-between bg-cream px-6 py-6 md:min-h-[80vh] md:max-w-xl md:rounded-[2rem] md:px-10 md:py-9 md:shadow-2xl">
        <div className="flex items-center justify-between">
          <Wordmark className="text-base text-ink" />
          <ProgressDots index={index} total={total} />
        </div>
        <div key={question.id} className="animate-q text-center">
          <h2 className="mt-6 font-serif text-[26px] font-medium leading-snug text-ink md:mt-8 md:text-3xl">
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
        <div className="flex w-full items-center justify-center gap-3 pt-4">
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
      </div>
    </div>
  )
}
```

- [ ] **Step 12: Correr — pasa.** Run: `npm test -- src/components/ProjectiveScreen src/components/ColorGrid src/components/GenderChoice`. Expected: todos PASS.

- [ ] **Step 13: Commit**
```bash
git add src/components/ColorGrid.tsx src/components/ColorGrid.test.tsx src/components/GenderChoice.tsx src/components/GenderChoice.test.tsx src/components/ProjectiveScreen.tsx src/components/ProjectiveScreen.test.tsx
git commit -m "feat(ui): ProjectiveScreen mouse-only + ColorGrid + GenderChoice"
```

---

## Task 6: Cableado en la página (flujo dinámico + routeo)

**Files:**
- Modify: `src/app/interview/[sessionId]/page.tsx`

(La lógica de branching/visibilidad ya está testeada en `flow.test.ts`; la página integra. No se unit-testea la página.)

- [ ] **Step 1: Reemplazar `src/app/interview/[sessionId]/page.tsx`** por:

```tsx
'use client'
import { use, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { visibleQuestions } from '@/lib/script/flow'
import { breatherAfter, type BreatherStep } from '@/lib/script/breathers'
import { InterviewScreen } from '@/components/InterviewScreen'
import { ProjectiveScreen } from '@/components/ProjectiveScreen'
import { Breather } from '@/components/Breather'
import { BrowserVoice } from '@/lib/voice/browser-voice'
import type { Answers } from '@/lib/script/types'

export default function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [i, setI] = useState(0)
  const [saved, setSaved] = useState<Answers>({})
  const [breather, setBreather] = useState<BreatherStep | null>(null)
  const finishing = useRef(false)
  const voice = useMemo(() => new BrowserVoice(), [])

  const questions = visibleQuestions(saved)
  const q = questions[i]

  async function finish() {
    if (finishing.current) return
    finishing.current = true
    await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' })
    router.push('/gracias')
  }

  async function answer(a: { rawText: string; imageChoice?: string }) {
    setSaved(prev => ({ ...prev, [q.id]: a }))
    await fetch(`/api/sessions/${sessionId}/answers`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, ...a }),
    })
    const step = breatherAfter(i + 1, questions.length)
    if (step) { setBreather(step); return }   // respiro o cierre
    setI(i + 1)
  }

  if (breather) {
    return <Breather message={breather.message} closing={breather.closing}
      onContinue={() => {
        setBreather(null)
        if (breather.closing) void finish()
        else setI(i + 1)
      }} />
  }

  const common = {
    question: q, index: i + 1, total: questions.length,
    initial: saved[q.id], canGoBack: i > 0,
    onBack: () => setI(Math.max(0, i - 1)), onAnswer: answer,
  }

  return q.type === 'open'
    ? <InterviewScreen {...common} voice={voice} />
    : <ProjectiveScreen {...common} />
}
```

- [ ] **Step 2: Verificar tipos, lint y suite completa.**
  - Run: `npx tsc --noEmit` → solo el `store.test.ts(20,31) TS7006` pre-existente es aceptable.
  - Run: `npx eslint "src/app/interview/[sessionId]/page.tsx" src/components/ProjectiveScreen.tsx` → exit 0 (sin errores nuevos).
  - Run: `npm test` → todo verde.

- [ ] **Step 3: Commit**
```bash
git add "src/app/interview/[sessionId]/page.tsx"
git commit -m "feat(ui): flujo dinámico con branching + routeo voz/proyectiva en la entrevista"
```

---

## Task 7: Imágenes de las opciones (assets)

**Files:**
- Create: `scripts/fetch-projective-images.sh`
- Create: `public/projective/**` (37 imágenes)

- [ ] **Step 1: Crear `scripts/fetch-projective-images.sh`:**

```bash
#!/usr/bin/env bash
# Descarga fotos libres (LoremFlickr, CC) para las opciones proyectivas.
# Determinista por ?lock=. Reemplazá cualquier archivo a mano si no te gusta.
set -uo pipefail
base="public/projective"
fail=0

dl() { # dl <subdir> <id> <keyword> <lock>
  local dir="$base/$1" out
  mkdir -p "$dir"
  out="$dir/$2.jpg"
  if curl -fsSL "https://loremflickr.com/600/600/$3?lock=$4" -o "$out" && [ -s "$out" ]; then
    echo "ok    $out"
  else
    echo "FALTA $out (keyword=$3)"; fail=$((fail+1)); rm -f "$out"
  fi
}

# animal
dl animal conejo rabbit 11
dl animal caballo horse 12
dl animal leon lion 13
dl animal delfin dolphin 14
dl animal aguila eagle 15
dl animal iguana iguana 16
dl animal perro dog 17
dl animal gato cat 18
dl animal flamenco flamingo 19
# olor
dl olor cerezo cherry,blossom 21
dl olor pina pinecone 22
dl olor cesped grass 23
dl olor rio river 24
dl olor caramelos candy 25
dl olor madera wood,logs 26
dl olor hierba mint 27
dl olor naranjas oranges 28
dl olor rosas roses 29
# ciudad
dl ciudad bali bali 31
dl ciudad ny newyork 32
dl ciudad barcelona barcelona 33
dl ciudad delhi delhi 34
dl ciudad lasvegas lasvegas 35
dl ciudad berlin berlin 36
dl ciudad paris paris 37
dl ciudad dubai dubai 38
dl ciudad marrakech marrakech 39
# edad hombre (retratos genéricos; la etiqueta de década va en la UI)
dl edad-hombre 20s man,portrait 41
dl edad-hombre 30s man,portrait 42
dl edad-hombre 40s man,portrait 43
dl edad-hombre 50s man,portrait 44
dl edad-hombre 60s man,portrait 45
# edad mujer
dl edad-mujer 20s woman,portrait 51
dl edad-mujer 30s woman,portrait 52
dl edad-mujer 40s woman,portrait 53
dl edad-mujer 50s woman,portrait 54
dl edad-mujer 60s woman,portrait 55

echo "---"
total=$(find "$base" -name '*.jpg' | wc -l | tr -d ' ')
echo "descargadas: $total/37  (faltaron: $fail)"
exit 0
```

- [ ] **Step 2: Ejecutar el script.** Run: `bash scripts/fetch-projective-images.sh`. Esperado: idealmente `descargadas: 37/37`. Si alguna marca `FALTA` (keyword sin resultado o red), volver a correr el script (los `ok` ya bajados se re-bajan rápido) o, si persiste, dejar ese archivo para reemplazo manual — la UI muestra el `alt` si falta la imagen. Reportar cuántas faltaron.

- [ ] **Step 3: Verificar que se sirven.** Run: `ls public/projective/*/ | head` y confirmar que existen subcarpetas animal/olor/ciudad/edad-hombre/edad-mujer con `.jpg` no vacíos: `find public/projective -name '*.jpg' -size 0` debe devolver vacío.

- [ ] **Step 4: Commit** (los assets se versionan; `public/` se sirve estático)
```bash
git add scripts/fetch-projective-images.sh public/projective
git commit -m "chore(assets): fotos libres para opciones proyectivas (animal/olor/ciudad/edad)"
```

---

## Verificación final (manual)

- [ ] `npm test` → todo verde. `npx tsc --noEmit` → solo el TS7006 pre-existente.
- [ ] `npm run dev`, sesión nueva, recorrer en Chrome/Safari:
  - Las 14 preguntas de voz: grabar llena el texto y **no avanza**; se revisa/edita y se toca Siguiente.
  - Proyectivas mouse-only: animal/olor/ciudad/edad muestran fotos; color muestra paletas; género muestra siluetas; Siguiente se habilita al elegir.
  - **Branching:** elegir Hombre → aparece edad-hombre (no mujer); volver Atrás, elegir Mujer → aparece edad-mujer. El contador queda en /20.
  - Respiros tras 7 y 12; cierre tras la 20 → `/gracias`.

## Fuera de alcance
- Mejorar respiros (cadencia/copys) — después.
- Curaduría fina de imágenes de producción / caras por década reales — reemplazo manual de archivos.
- Fase 2 (limpieza de transcripción + brief) — su propio plan.
