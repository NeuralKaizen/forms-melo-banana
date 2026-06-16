'use client'
import { useState, useEffect, useRef } from 'react'
import type { Question } from '@/lib/script/types'
import type { VoiceAdapter } from '@/lib/voice/types'
import { MicButton } from './MicButton'

function withHighlight(prompt: string, highlight?: string) {
  if (!highlight || !prompt.includes(highlight)) return prompt
  const [a, b] = prompt.split(highlight)
  return <>{a}<span className="underline-banana">{highlight}</span>{b}</>
}

export function InterviewScreen({ question, index, total, voice, initial, canGoBack, onBack, onAnswer }: {
  question: Question; index: number; total: number
  voice?: VoiceAdapter
  initial?: { rawText: string }
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
}
