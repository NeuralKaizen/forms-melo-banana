'use client'
import { useState, useEffect } from 'react'
import type { Question } from '@/lib/script/types'
import type { VoiceAdapter } from '@/lib/voice/types'
import { ProgressDots } from './ProgressDots'
import { StatePill } from './StatePill'
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
  const [mode, setMode] = useState<'agent' | 'you'>('agent')
  const [listening, setListening] = useState(false)

  useEffect(() => {
    setMode('agent'); setText(initial?.rawText ?? ''); setChoice(initial?.imageChoice)
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
  const canSubmit = question.type === 'image-grid' ? !!choice && text.trim() : text.trim()
  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex min-h-screen w-full max-w-md flex-col justify-between bg-cream px-6 py-6 md:min-h-[80vh] md:max-w-xl md:rounded-[2rem] md:px-10 md:py-9 md:shadow-2xl">
      <div className="flex items-center justify-between">
        <Wordmark className="text-base text-ink" />
        <ProgressDots index={index} total={total} />
      </div>
      <div key={question.id} className="animate-q text-center">
        <StatePill mode={mode} />
        <h2 className="mt-8 font-serif text-[28px] font-medium leading-snug text-ink md:mt-10 md:text-4xl">
          {withHighlight(question.prompt, question.highlight)}
        </h2>
        {question.type === 'image-grid' && question.options && (
          <div className="mt-6"><ImageGrid options={question.options} selected={choice} onSelect={setChoice} /></div>
        )}
      </div>
      <div className="flex flex-col items-center gap-6 pt-4">
        <div className="flex flex-col items-center gap-2.5">
          <MicButton active={listening} onClick={speak} />
          <span className="text-[12px] font-medium text-[#8a8170]">
            {listening ? 'Grabando…' : 'Toca para hablar'}
          </span>
        </div>
        <div className="flex w-full items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#bcb29c]">
          <span className="h-px flex-1 bg-black/10" /> o escribe <span className="h-px flex-1 bg-black/10" />
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
          <button disabled={!canSubmit}
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
