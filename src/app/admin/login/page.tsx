'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LogoBlock } from '@/components/Brand'

function Login() {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const params = useSearchParams()
  // Solo rutas internas: un `next` que empiece con `//` o con un esquema convertiría
  // el login en un redirector abierto hacia otro dominio.
  const crudo = params.get('next') ?? ''
  const destino = crudo.startsWith('/') && !crudo.startsWith('//') ? crudo : '/admin'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(false)
    const r = await fetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ pw }), headers: { 'content-type': 'application/json' } })
    if (r.ok) { location.href = destino; return }
    setBusy(false); setError(true)
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-[#ece4d2] md:items-center md:p-8">
      <div className="flex w-full max-w-md flex-col items-center bg-cream px-7 py-10 text-center md:rounded-[2rem] md:px-12 md:py-12 md:shadow-2xl">
        <LogoBlock />
        <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">
          Panel interno
        </p>
        <h1 className="mt-3 font-serif text-3xl font-medium leading-tight text-ink">
          Hola de <span className="underline-banana">nuevo</span>
        </h1>
        <form onSubmit={submit} className="mt-8 flex w-full flex-col gap-3 text-left">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8a8170]">Contraseña del equipo</label>
            <input type="password" required autoFocus value={pw} onChange={e => setPw(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-4 py-3 text-ink outline-none transition focus:border-[var(--banana)] focus:ring-2 focus:ring-[var(--banana)]/40" />
          </div>
          {error && <p className="animate-fade text-sm text-red-600">Contraseña incorrecta, intenta de nuevo.</p>}
          <button disabled={busy}
            className="mt-3 rounded-xl bg-[var(--ink)] px-4 py-3.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50">
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  )
}
