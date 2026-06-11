'use client'
import { useState } from 'react'

export function IdentityForm({ onSubmit }: {
  onSubmit: (v: { name: string; company: string; role: string; email: string }) => void
}) {
  const [v, setV] = useState({ name: '', company: '', role: '', email: '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: e.target.value })
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v) }}
      className="mx-auto flex w-full max-w-sm flex-col gap-3 px-6">
      <h1 className="mb-2 text-2xl font-semibold text-ink">Antes de arrancar, contanos quién sos</h1>
      {(['name', 'company', 'role', 'email'] as const).map(k => (
        <input key={k} required value={v[k]} onChange={set(k)}
          placeholder={{ name: 'Nombre', company: 'Empresa', role: 'Cargo', email: 'Email' }[k]}
          className="rounded-xl border border-black/10 bg-white px-4 py-3 text-ink outline-none" />
      ))}
      <button className="mt-2 rounded-xl bg-[var(--ink)] px-4 py-3 font-semibold text-white">Empezar</button>
    </form>
  )
}
