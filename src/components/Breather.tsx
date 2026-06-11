'use client'
import { Wordmark } from './Brand'

export function Breather({ message, closing, emoji, cta, onContinue }: {
  message: string; closing: boolean; emoji?: string; cta?: string; onContinue: () => void
}) {
  const icon = emoji ?? (closing ? '🎉' : '🍌')
  const label = cta ?? (closing ? 'Ver el cierre' : 'Seguir')
  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex min-h-screen w-full max-w-md flex-col justify-between bg-cream px-6 py-10 text-center md:min-h-[80vh] md:max-w-xl md:rounded-[2rem] md:px-10 md:py-12 md:shadow-2xl">
        <Wordmark className="text-base text-ink" />
        <div className="flex flex-col items-center gap-5">
          <div className="text-[34px]">{icon}</div>
          <p className="font-serif text-[26px] font-medium leading-snug text-ink md:text-[30px]">{message}</p>
        </div>
        <button onClick={onContinue}
          className="group mx-auto flex items-center gap-2 rounded-xl bg-[var(--ink)] px-7 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95">
          {label}
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2"
            className="transition-transform duration-200 group-hover:translate-x-1">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
