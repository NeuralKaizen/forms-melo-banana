# Voz del usuario (demo): guion 15 + interacción por voz + respiros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la entrevista gire en torno a la voz del usuario — micrófono toggle con transcripción en vivo y auto-advance — sobre un guion reducido a 15 preguntas, con respiros anti-fatiga.

**Architecture:** Frontend Next.js (React 19) + TS. El STT vive detrás del seam `VoiceAdapter` (Web Speech para la demo, intercambiable luego). Sin voz del agente. El guion se edita en `SCRIPT`; el flujo y los respiros se derivan de él.

**Tech Stack:** Next 16, React 19, Tailwind v4, Vitest + Testing Library, Web Speech API.

**Fuera de este plan:** Fase 2 (limpiar transcripción con IA + brief desde texto pulido). Va a su propio plan; requiere `ANTHROPIC_API_KEY`.

Spec: `docs/superpowers/specs/2026-06-11-voz-usuario-y-proceso-design.md`

---

## File Structure

- `src/lib/script/questions.ts` — **modificar**: aplicar 3 fusiones (19 entradas en SCRIPT, 15 preguntas en la entrevista).
- `src/lib/script/questions.test.ts` — **modificar**: aserciones de las fusiones.
- `src/lib/script/flow.ts` — **modificar**: agregar `interviewQuestions()` (filtra identidad).
- `src/lib/script/flow.test.ts` — **modificar**: test de `interviewQuestions()` (15).
- `src/lib/voice/types.ts` — **modificar**: interfaz `VoiceAdapter` a `start/stop` + parcial.
- `src/lib/voice/fake-voice.ts` — **modificar**: reescribir al nuevo contrato.
- `src/lib/voice/fake-voice.test.ts` — **modificar**: al nuevo contrato.
- `src/lib/voice/browser-voice.ts` — **modificar**: `start(onPartial)`/`stop()`, `interimResults`, acumular finales.
- `src/lib/voice/browser-voice.test.ts` — **crear**: test con mock de SpeechRecognition.
- `src/components/MicButton.tsx` — **modificar**: squircle con dos estados.
- `src/components/MicButton.test.tsx` — **crear**.
- `src/components/InterviewScreen.tsx` — **modificar**: toggle, parcial en vivo, auto-advance, regrabar.
- `src/components/InterviewScreen.test.tsx` — **crear**.
- `src/components/Breather.tsx` — **crear**: pantalla interstitial de respiro/cierre.
- `src/lib/script/breathers.ts` — **crear**: helper `breatherAfter(humanIndex, total)`.
- `src/lib/script/breathers.test.ts` — **crear**.
- `src/app/interview/[sessionId]/page.tsx` — **modificar**: intercalar respiros (tras 7 y 12) y cierre (tras 15).

---

## Task 1: Guion reducido (3 fusiones) + `interviewQuestions()`

**Files:**
- Modify: `src/lib/script/questions.ts`
- Modify: `src/lib/script/questions.test.ts`
- Modify: `src/lib/script/flow.ts`
- Modify: `src/lib/script/flow.test.ts`

- [ ] **Step 1: Escribir tests de las fusiones (questions.test.ts)**

Agregar dentro del `describe('SCRIPT', …)` en `src/lib/script/questions.test.ts`:

```ts
  it('applies the approved merges', () => {
    const ids = SCRIPT.flatMap(s => s.questions.map(q => q.id))
    expect(ids).toContain('empresa_historia')
    expect(ids).toContain('porque_ahora')
    expect(ids).toContain('percepcion')
    for (const gone of ['descripcion', 'historia', 'si_nada', 'piensan', 'relacion', 'uso']) {
      expect(ids).not.toContain(gone)
    }
  })
```

- [ ] **Step 2: Escribir test de `interviewQuestions()` (flow.test.ts)**

Agregar a `src/lib/script/flow.test.ts` (importando `interviewQuestions` junto a lo ya importado):

```ts
import { interviewQuestions } from './flow'

describe('interviewQuestions', () => {
  it('excludes the 4 identity questions, leaving 15', () => {
    const qs = interviewQuestions()
    expect(qs).toHaveLength(15)
    for (const id of ['nombre', 'empresa', 'cargo', 'email']) {
      expect(qs.find(q => q.id === id)).toBeUndefined()
    }
  })
})
```

- [ ] **Step 3: Correr los tests para verlos fallar**

Run: `npm test -- src/lib/script`
Expected: FAIL — `empresa_historia` no existe; `interviewQuestions` no está exportada.

- [ ] **Step 4: Aplicar las fusiones en `questions.ts`**

En `src/lib/script/questions.ts`, sección `project`, reemplazar las dos primeras líneas (`descripcion` y `historia`) por una sola, y las dos de `porque_ahora`/`si_nada` por una sola:

```ts
  {
    key: 'project', title: 'Contexto del proyecto',
    questions: [
      open('empresa_historia', 'Haz una breve descripción de la compañía o proyecto, incluyendo su historia.', 'compañía o proyecto'),
      open('productos', '¿Qué productos o servicios ofrece?', 'productos o servicios'),
      open('porque_ahora', '¿Por qué es importante evolucionar la marca justo ahora, y qué pasaría si no se hace nada?', 'evolucionar la marca'),
      open('estrategia', '¿Cuál es la estrategia de negocio detrás del brief?', 'estrategia de negocio'),
      open('competencia_hace', '¿Qué está o qué no está haciendo la competencia?', 'la competencia'),
      open('kpis', '¿Cuáles son los KPI del proyecto?', 'KPI'),
      open('competidores', '¿Cuáles son los competidores directos e indirectos?', 'competidores'),
    ],
  },
```

En la sección `consumer`, reemplazar `piensan`, `relacion` y `uso` por una sola:

```ts
  {
    key: 'consumer', title: 'Contexto del consumidor',
    questions: [
      open('problema', '¿Cuál es el problema clave que se resuelve para el consumidor?', 'problema clave'),
      open('target', '¿Quién es el target?', 'target'),
      open('percepcion', '¿Qué piensan hoy los consumidores de la marca y cómo se relacionan con ella o la usan? (si aplica)', 'piensan hoy'),
      open('cambio', '¿Cuál es el cambio clave que se busca en el consumidor?', 'cambio clave'),
    ],
  },
```

- [ ] **Step 5: Agregar `interviewQuestions()` en `flow.ts`**

En `src/lib/script/flow.ts`, agregar tras los imports y la función `allQuestions`:

```ts
const IDENTITY_IDS = new Set(['nombre', 'empresa', 'cargo', 'email'])

/** Preguntas que se hacen en el flujo de voz (sin las de identidad). */
export function interviewQuestions(): Question[] {
  return allQuestions().filter(q => !IDENTITY_IDS.has(q.id))
}
```

- [ ] **Step 6: Correr los tests para verlos pasar**

Run: `npm test -- src/lib/script`
Expected: PASS (todos, incluidos los existentes).

- [ ] **Step 7: Commit**

```bash
git add src/lib/script/questions.ts src/lib/script/questions.test.ts src/lib/script/flow.ts src/lib/script/flow.test.ts
git commit -m "feat(script): fusionar preguntas (19→15) y exponer interviewQuestions()"
```

---

## Task 2: Nueva interfaz `VoiceAdapter` + `FakeVoice`

**Files:**
- Modify: `src/lib/voice/types.ts`
- Modify: `src/lib/voice/fake-voice.ts`
- Modify: `src/lib/voice/fake-voice.test.ts`

- [ ] **Step 1: Reescribir el test de `FakeVoice` al nuevo contrato**

Reemplazar el contenido de `src/lib/voice/fake-voice.test.ts` por:

```ts
import { describe, it, expect, vi } from 'vitest'
import { FakeVoice } from './fake-voice'

describe('FakeVoice', () => {
  it('emits partials on start and resolves the final on stop', async () => {
    const v = new FakeVoice('hola mundo', ['hola', 'hola mundo'])
    const onPartial = vi.fn()
    v.start(onPartial)
    expect(onPartial).toHaveBeenNthCalledWith(1, 'hola')
    expect(onPartial).toHaveBeenNthCalledWith(2, 'hola mundo')
    expect(await v.stop()).toBe('hola mundo')
  })

  it('reports STT supported', () => {
    expect(new FakeVoice('').isSTTSupported()).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- src/lib/voice/fake-voice`
Expected: FAIL — `start`/`stop` con esta firma no existen.

- [ ] **Step 3: Reescribir la interfaz `VoiceAdapter`**

Reemplazar el contenido de `src/lib/voice/types.ts` por:

```ts
export interface VoiceAdapter {
  /** Empieza a escuchar; llama onPartial con el texto acumulado en vivo. */
  start(onPartial: (text: string) => void): void
  /** Corta la escucha y resuelve con el texto final acumulado. */
  stop(): Promise<string>
  /** Si el STT está disponible; si no, la UI degrada a teclado. */
  isSTTSupported(): boolean
}
```

- [ ] **Step 4: Reescribir `FakeVoice`**

Reemplazar el contenido de `src/lib/voice/fake-voice.ts` por:

```ts
import type { VoiceAdapter } from './types'

export class FakeVoice implements VoiceAdapter {
  started = false
  constructor(private finalText: string, private partials: string[] = []) {}
  start(onPartial: (text: string) => void) {
    this.started = true
    for (const p of this.partials) onPartial(p)
  }
  async stop() {
    this.started = false
    return this.finalText
  }
  isSTTSupported() { return true }
}
```

- [ ] **Step 5: Correr el test para verlo pasar**

Run: `npm test -- src/lib/voice/fake-voice`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/voice/types.ts src/lib/voice/fake-voice.ts src/lib/voice/fake-voice.test.ts
git commit -m "feat(voice): contrato start/stop con parciales en VoiceAdapter + FakeVoice"
```

---

## Task 3: `BrowserVoice` con `start/stop` + parciales

**Files:**
- Modify: `src/lib/voice/browser-voice.ts`
- Create: `src/lib/voice/browser-voice.test.ts`

- [ ] **Step 1: Escribir el test con mock de SpeechRecognition**

Crear `src/lib/voice/browser-voice.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserVoice } from './browser-voice'

// Mock mínimo de Web Speech: guarda la última instancia para dispararle eventos.
class MockRecognition {
  static last: MockRecognition | null = null
  lang = ''
  interimResults = false
  continuous = false
  maxAlternatives = 1
  onresult: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  started = false
  constructor() { MockRecognition.last = this }
  start() { this.started = true }
  stop() { this.started = false }
}

// Construye un evento con la forma de SpeechRecognitionEvent.
function resultEvent(items: { transcript: string; isFinal: boolean }[], resultIndex = 0) {
  const results = items.map(it => {
    const r: any = [{ transcript: it.transcript }]
    r.isFinal = it.isFinal
    return r
  })
  return { resultIndex, results }
}

describe('BrowserVoice', () => {
  beforeEach(() => { (globalThis as any).webkitSpeechRecognition = MockRecognition })
  afterEach(() => { delete (globalThis as any).webkitSpeechRecognition; MockRecognition.last = null })

  it('reports support when the API exists', () => {
    expect(new BrowserVoice().isSTTSupported()).toBe(true)
  })

  it('configures es-ES with interim results and emits accumulated partials', () => {
    const v = new BrowserVoice()
    const partials: string[] = []
    v.start(t => partials.push(t))
    const rec = MockRecognition.last!
    expect(rec.lang).toBe('es-ES')
    expect(rec.interimResults).toBe(true)
    expect(rec.started).toBe(true)
    rec.onresult!(resultEvent([{ transcript: 'hola ', isFinal: true }]))
    rec.onresult!(resultEvent([{ transcript: 'mundo', isFinal: false }], 1))
    expect(partials.at(-1)).toBe('hola  mundo'.trim())
  })

  it('stop() resolves with the accumulated final text only', async () => {
    const v = new BrowserVoice()
    v.start(() => {})
    const rec = MockRecognition.last!
    rec.onresult!(resultEvent([{ transcript: 'una respuesta', isFinal: true }]))
    rec.onresult!(resultEvent([{ transcript: ' a medias', isFinal: false }], 1))
    expect(await v.stop()).toBe('una respuesta')
    expect(rec.started).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- src/lib/voice/browser-voice`
Expected: FAIL — `start`/`stop` con esta firma no existen.

- [ ] **Step 3: Reescribir `BrowserVoice`**

Reemplazar el contenido de `src/lib/voice/browser-voice.ts` por:

```ts
import type { VoiceAdapter } from './types'

export class BrowserVoice implements VoiceAdapter {
  private rec?: any
  private finalText = ''

  isSTTSupported(): boolean {
    return typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  }

  start(onPartial: (text: string) => void): void {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) return
    this.finalText = ''
    const rec = new Ctor()
    this.rec = rec
    rec.lang = 'es-ES'
    rec.interimResults = true
    rec.continuous = true
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) this.finalText += r[0].transcript
        else interim += r[0].transcript
      }
      onPartial((this.finalText + interim).trim())
    }
    rec.onerror = () => { /* degrada en silencio; el texto sigue editable a mano */ }
    rec.start()
  }

  async stop(): Promise<string> {
    this.rec?.stop?.()
    this.rec = undefined
    return this.finalText.trim()
  }
}
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `npm test -- src/lib/voice/browser-voice`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/voice/browser-voice.ts src/lib/voice/browser-voice.test.ts
git commit -m "feat(voice): BrowserVoice start/stop con interimResults y acumulado de finales"
```

---

## Task 4: `MicButton` squircle de dos estados

**Files:**
- Modify: `src/components/MicButton.tsx`
- Create: `src/components/MicButton.test.tsx`

- [ ] **Step 1: Escribir el test**

Crear `src/components/MicButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MicButton } from './MicButton'

describe('MicButton', () => {
  it('exposes its state and fires onClick', () => {
    const onClick = vi.fn()
    const { rerender } = render(<MicButton active={false} onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /hablar/i })
    expect(btn.getAttribute('data-state')).toBe('idle')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
    rerender(<MicButton active onClick={onClick} />)
    expect(btn.getAttribute('data-state')).toBe('listening')
  })
})
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- src/components/MicButton`
Expected: FAIL — `data-state` no existe en el botón.

- [ ] **Step 3: Reescribir `MicButton` al squircle**

Reemplazar el contenido de `src/components/MicButton.tsx` por:

```tsx
export function MicButton({ active, onClick }: { active: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} aria-label={active ? 'Cortar' : 'Hablar'} data-state={active ? 'listening' : 'idle'}
      className={`grid h-[72px] w-[72px] place-items-center rounded-[24px] transition active:scale-95 ${
        active
          ? 'bg-[var(--banana)] shadow-[0_5px_14px_rgba(217,158,34,0.4)]'
          : 'bg-cream shadow-[inset_0_0_0_2.5px_var(--ink),0_5px_12px_rgba(0,0,0,0.08)]'
      }`}>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--ink)" strokeWidth="2">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  )
}
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `npm test -- src/components/MicButton`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MicButton.tsx src/components/MicButton.test.tsx
git commit -m "feat(ui): MicButton squircle con estados reposo/escuchando"
```

---

## Task 5: `InterviewScreen` toggle + parcial en vivo + auto-advance + regrabar

**Files:**
- Modify: `src/components/InterviewScreen.tsx`
- Create: `src/components/InterviewScreen.test.tsx`

- [ ] **Step 1: Escribir el test con `FakeVoice`**

Crear `src/components/InterviewScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { InterviewScreen } from './InterviewScreen'
import { FakeVoice } from '@/lib/voice/fake-voice'
import type { Question } from '@/lib/script/types'

const q: Question = { id: 'demo', type: 'open', prompt: '¿Qué tal?', audio: '/audio/demo.mp3' }

describe('InterviewScreen', () => {
  it('toggle: 1er toque escucha (parcial en vivo), 2do toque guarda y avanza', async () => {
    const voice = new FakeVoice('una respuesta completa', ['una', 'una respuesta'])
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={1} total={15} voice={voice} onAnswer={onAnswer} />)

    const mic = screen.getByRole('button', { name: /hablar/i })
    await act(async () => { fireEvent.click(mic) })           // start
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('una respuesta')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /cortar/i })) }) // stop
    expect(onAnswer).toHaveBeenCalledWith({ rawText: 'una respuesta completa', imageChoice: undefined })
  })

  it('regrabar limpia el texto y vuelve a escuchar (sin avanzar)', async () => {
    const voice = new FakeVoice('', [])
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={2} total={15} voice={voice}
      initial={{ rawText: 'texto previo' }} canGoBack onAnswer={onAnswer} />)

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('texto previo')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /regrabar/i })) })
    expect(voice.started).toBe(true)
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- src/components/InterviewScreen`
Expected: FAIL — no hay botón "regrabar"; el flujo aún reproduce audio y no auto-avanza.

- [ ] **Step 3: Reescribir `InterviewScreen`**

Reemplazar el contenido de `src/components/InterviewScreen.tsx` por:

```tsx
'use client'
import { useState, useEffect } from 'react'
import type { Question } from '@/lib/script/types'
import type { VoiceAdapter } from '@/lib/voice/types'
import { ProgressDots } from './ProgressDots'
import { MicButton } from './MicButton'
import { ImageGrid } from './ImageGrid'
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
  onAnswer: (a: { rawText: string; imageChoice?: string }) => void
}) {
  const [text, setText] = useState('')
  const [choice, setChoice] = useState<string | undefined>()
  const [listening, setListening] = useState(false)

  useEffect(() => {
    setText(initial?.rawText ?? ''); setChoice(initial?.imageChoice); setListening(false)
  }, [question.id])

  const supported = !!voice?.isSTTSupported()

  function canSubmit(t: string, c?: string) {
    return question.type === 'image-grid' ? !!c && !!t.trim() : !!t.trim()
  }

  async function toggle() {
    if (!voice || !supported) return
    if (listening) {
      const final = await voice.stop()
      setListening(false)
      const next = final || text
      setText(next)
      if (canSubmit(next, choice)) onAnswer({ rawText: next.trim(), imageChoice: choice }) // avanza solo
    } else {
      setText(''); setListening(true)
      voice.start(p => setText(p))
    }
  }

  function regrabar() {
    if (!voice || !supported) return
    setText(''); setListening(true)
    voice.start(p => setText(p))
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
          {question.type === 'image-grid' && question.options && (
            <div className="mt-6"><ImageGrid options={question.options} selected={choice} onSelect={setChoice} /></div>
          )}
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
            <button disabled={!canSubmit(text, choice)}
              onClick={() => onAnswer({ rawText: text.trim(), imageChoice: choice })}
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

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `npm test -- src/components/InterviewScreen`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/InterviewScreen.tsx src/components/InterviewScreen.test.tsx
git commit -m "feat(ui): InterviewScreen toggle de voz con parcial en vivo, auto-advance y regrabar"
```

---

## Task 6: Respiros (tras 7 y 12) + cierre (tras 15)

**Files:**
- Create: `src/lib/script/breathers.ts`
- Create: `src/lib/script/breathers.test.ts`
- Create: `src/components/Breather.tsx`
- Modify: `src/app/interview/[sessionId]/page.tsx`

- [ ] **Step 1: Escribir el test del helper**

Crear `src/lib/script/breathers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { breatherAfter } from './breathers'

describe('breatherAfter', () => {
  it('da un respiro tras la 7 y la 12', () => {
    expect(breatherAfter(7, 15)).toEqual({ message: 'Vamos por la mitad de camino. Recuerda tomarte el tiempo que necesites.', closing: false })
    expect(breatherAfter(12, 15)).toEqual({ message: 'Doce preguntas y contando. Ya casi lo tenemos.', closing: false })
  })
  it('da el cierre tras la última', () => {
    expect(breatherAfter(15, 15)).toEqual({ message: '¡Eso es todo! Gracias por compartir tu visión con nosotros.', closing: true })
  })
  it('no da nada en otras posiciones', () => {
    expect(breatherAfter(3, 15)).toBeNull()
    expect(breatherAfter(8, 15)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- src/lib/script/breathers`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el helper**

Crear `src/lib/script/breathers.ts`:

```ts
export interface BreatherStep { message: string; closing: boolean }

/** Respiro anti-fatiga después de la pregunta `humanIndex` (1-based), o null. */
export function breatherAfter(humanIndex: number, total: number): BreatherStep | null {
  if (humanIndex === total) {
    return { message: '¡Eso es todo! Gracias por compartir tu visión con nosotros.', closing: true }
  }
  if (humanIndex === 7) {
    return { message: 'Vamos por la mitad de camino. Recuerda tomarte el tiempo que necesites.', closing: false }
  }
  if (humanIndex === 12) {
    return { message: 'Doce preguntas y contando. Ya casi lo tenemos.', closing: false }
  }
  return null
}
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `npm test -- src/lib/script/breathers`
Expected: PASS.

- [ ] **Step 5: Crear el componente `Breather`**

Crear `src/components/Breather.tsx`:

```tsx
'use client'
import { Wordmark } from './Brand'

export function Breather({ message, closing, onContinue }: {
  message: string; closing: boolean; onContinue: () => void
}) {
  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex min-h-screen w-full max-w-md flex-col justify-between bg-cream px-6 py-10 text-center md:min-h-[80vh] md:max-w-xl md:rounded-[2rem] md:px-10 md:py-12 md:shadow-2xl">
        <Wordmark className="text-base text-ink" />
        <div className="flex flex-col items-center gap-5">
          <div className="text-[34px]">{closing ? '🎉' : '🍌'}</div>
          <p className="font-serif text-[26px] font-medium leading-snug text-ink md:text-[30px]">{message}</p>
        </div>
        <button onClick={onContinue}
          className="group mx-auto flex items-center gap-2 rounded-xl bg-[var(--ink)] px-7 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95">
          {closing ? 'Ver el cierre' : 'Seguir'}
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2"
            className="transition-transform duration-200 group-hover:translate-x-1">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Cablear los respiros en la página de entrevista**

Reemplazar el contenido de `src/app/interview/[sessionId]/page.tsx` por:

```tsx
'use client'
import { use, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { interviewQuestions } from '@/lib/script/flow'
import { breatherAfter, type BreatherStep } from '@/lib/script/breathers'
import { InterviewScreen } from '@/components/InterviewScreen'
import { Breather } from '@/components/Breather'
import { BrowserVoice } from '@/lib/voice/browser-voice'

export default function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const questions = interviewQuestions()
  const [i, setI] = useState(0)
  const [saved, setSaved] = useState<Record<string, { rawText: string; imageChoice?: string }>>({})
  const [breather, setBreather] = useState<BreatherStep | null>(null)
  const q = questions[i]
  const voice = useMemo(() => new BrowserVoice(), [])

  async function finish() {
    await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' })
    router.push('/gracias')
  }

  async function answer(a: { rawText: string; imageChoice?: string }) {
    setSaved(prev => ({ ...prev, [q.id]: a }))
    await fetch(`/api/sessions/${sessionId}/answers`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, ...a }),
    })
    const human = i + 1
    const step = breatherAfter(human, questions.length)
    if (step) { setBreather(step); return }            // respiro o cierre
    setI(i + 1)                                        // sin respiro: avanza
  }

  if (breather) {
    return <Breather message={breather.message} closing={breather.closing}
      onContinue={() => {
        setBreather(null)
        if (breather.closing) void finish()
        else setI(i + 1)
      }} />
  }

  return <InterviewScreen
    question={q} index={i + 1} total={questions.length} voice={voice}
    initial={saved[q.id]} canGoBack={i > 0} onBack={() => setI(Math.max(0, i - 1))}
    onAnswer={answer} />
}
```

- [ ] **Step 7: Correr toda la suite**

Run: `npm test`
Expected: PASS (toda la suite).

- [ ] **Step 8: Commit**

```bash
git add src/lib/script/breathers.ts src/lib/script/breathers.test.ts src/components/Breather.tsx src/app/interview/[sessionId]/page.tsx
git commit -m "feat(ui): respiros tras la pregunta 7 y 12 + cierre tras la 15"
```

---

## Verificación final (manual)

- [ ] `npm run lint` sin errores.
- [ ] `npm run dev`, abrir una sesión nueva y recorrer la entrevista:
  - El micro squircle se ve en reposo (borde tinta) y al escuchar (relleno banana).
  - En Chrome/Safari: tocar el micro transcribe en vivo; al cortar, avanza solo.
  - Tras la pregunta 7 y la 12 aparece el respiro; tras la 15, el cierre → `/gracias`.
  - En Firefox: no aparece el micro, se puede escribir y avanzar con "Siguiente".
  - "Atrás" + "Regrabar" funcionan al volver a una pregunta.
