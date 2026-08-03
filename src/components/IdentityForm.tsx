'use client'
import { useState } from 'react'
import { LogoBlock } from './Brand'

export function IdentityForm({ onSubmit }: {
  onSubmit: (v: { name: string; company: string; role: string; email: string }) => void
}) {
  const [v, setV] = useState({ name: '', company: '', role: '', email: '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: e.target.value })
  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex w-full max-w-md flex-col items-center bg-cream px-7 py-10 text-center md:max-w-lg md:rounded-[2rem] md:px-12 md:py-12 md:shadow-2xl">
        <LogoBlock />
        <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">
          Entrevista Proyectiva
        </p>
        <h1 className="mt-3 font-serif text-3xl font-medium leading-tight text-ink md:text-4xl">
          Cuéntanos sobre tu&nbsp;<span className="underline-banana">marca</span>
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[#7a7060]">
          Queremos conocer a profundidad tu proyecto, tus necesidades y expectativas.
          Responde estas preguntas de forma individual y recuerda, no hay respuestas
          correctas ni incorrectas.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(v) }}
          className="mt-8 flex w-full flex-col gap-3 text-left">
          {(['name', 'company', 'role', 'email'] as const).map(k => (
            <div key={k} className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#8a8170]">
                {{ name: 'Nombre', company: 'Empresa', role: 'Cargo', email: 'Email' }[k]}
              </label>
              <input required value={v[k]} onChange={set(k)} type={k === 'email' ? 'email' : 'text'}
                className="rounded-xl border border-black/10 bg-white px-4 py-3 text-ink outline-none transition focus:border-[var(--banana)] focus:ring-2 focus:ring-[var(--banana)]/40" />
            </div>
          ))}
          <button className="group mt-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98]">
            Comenzar la entrevista
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2"
              className="transition-transform duration-200 group-hover:translate-x-1">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>

        <p className="mt-6 text-[12px] text-[#a59c89]">
          Te tomará aprox 10 minutos
        </p>
      </div>
    </div>
  )
}
