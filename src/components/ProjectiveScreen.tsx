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
