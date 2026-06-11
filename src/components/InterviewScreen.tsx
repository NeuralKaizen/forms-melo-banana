'use client'
import { useState } from 'react'
import type { Question } from '@/lib/script/types'
import { ProgressDots } from './ProgressDots'
import { StatePill } from './StatePill'
import { MicButton } from './MicButton'
import { ImageGrid } from './ImageGrid'

function withHighlight(prompt: string, highlight?: string) {
  if (!highlight || !prompt.includes(highlight)) return prompt
  const [a, b] = prompt.split(highlight)
  return <>{a}<span className="underline-banana">{highlight}</span>{b}</>
}

export function InterviewScreen({ question, index, total, onAnswer }: {
  question: Question; index: number; total: number
  onAnswer: (a: { rawText: string; imageChoice?: string }) => void
}) {
  const [text, setText] = useState('')
  const [choice, setChoice] = useState<string | undefined>()
  const canSubmit = question.type === 'image-grid' ? !!choice && text.trim() : text.trim()
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between bg-cream px-6 py-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold tracking-wide text-ink">M&amp;B</span>
        <ProgressDots index={index} total={total} />
      </div>
      <div className="text-center">
        <StatePill mode="you" />
        <h2 className="mt-4 text-2xl font-semibold leading-tight text-ink">
          {withHighlight(question.prompt, question.highlight)}
        </h2>
        {question.type === 'image-grid' && question.options && (
          <div className="mt-5"><ImageGrid options={question.options} selected={choice} onSelect={setChoice} /></div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <MicButton active={false} />
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder="…o escribí tu respuesta"
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none" rows={2} />
        <button disabled={!canSubmit}
          onClick={() => onAnswer({ rawText: text.trim(), imageChoice: choice })}
          className="rounded-xl bg-[var(--ink)] px-5 py-2.5 font-semibold text-white disabled:opacity-40">
          Siguiente
        </button>
      </div>
    </div>
  )
}
