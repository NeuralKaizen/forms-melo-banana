'use client'
import { useState, useEffect } from 'react'
import type { Question } from '@/lib/script/types'
import { ImageGrid } from './ImageGrid'
import { ColorGrid } from './ColorGrid'
import { GenderChoice } from './GenderChoice'

export function ProjectiveScreen({ question, index, total, initial, canGoBack, onBack, onAnswer }: {
  question: Question; index: number; total: number
  initial?: { rawText: string; imageChoice?: string }
  canGoBack?: boolean
  onBack?: () => void
  onAnswer: (a: { rawText: string; imageChoice?: string }) => void
}) {
  const [choice, setChoice] = useState<string | undefined>()
  const [why, setWhy] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(initial?.imageChoice)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWhy(initial?.rawText ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id])

  const selectedLabel = question.options?.find(o => o.id === choice)?.label
  const followUp = question.followUp ?? '¿Por qué elegiste esa opción?'

  return (
    <>
      <div key={question.id} className="animate-q md:my-auto">
        <h2 className="text-center font-serif text-[26px] font-medium leading-snug text-ink md:text-3xl">
          {question.prompt}
        </h2>
        <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-start md:justify-center md:gap-8">
          <div className="md:max-w-md md:flex-1">
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

          {/* Panel "¿por qué?" — a la derecha en desktop, abajo en móvil. */}
          <aside className="md:w-72 md:shrink-0 md:self-stretch md:border-l md:border-black/5 md:pl-8">
            {choice ? (
              <div className="animate-fade text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#bcb29c]">
                  Elegiste {selectedLabel}
                </p>
                <p className="mt-1.5 font-serif text-[19px] leading-snug text-ink md:text-[21px]">
                  {followUp}
                </p>
                <textarea
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  aria-label="Por qué elegiste esa opción"
                  placeholder="Cuéntanos por qué… (opcional)"
                  rows={4}
                  className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-[#bcb29c] focus:border-[var(--banana)] focus:ring-2 focus:ring-[var(--banana)]/40"
                />
              </div>
            ) : (
              <p className="hidden text-[13px] leading-relaxed text-[#bcb29c] md:block">
                Toca una opción y te preguntamos por qué la elegiste.
              </p>
            )}
          </aside>
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
          onClick={() => onAnswer({ rawText: why.trim(), imageChoice: choice })}
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
}
