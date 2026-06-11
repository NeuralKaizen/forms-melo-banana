'use client'
import { useState } from 'react'
export default function Login() {
  const [pw, setPw] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = await fetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ pw }), headers: { 'content-type': 'application/json' } })
    if (r.ok) location.href = '/admin'; else alert('Contraseña incorrecta')
  }
  return <main className="grid min-h-screen place-items-center bg-cream">
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Contraseña del equipo"
        className="rounded-xl border border-black/10 bg-white px-4 py-3" />
      <button className="rounded-xl bg-[var(--ink)] px-4 py-3 font-semibold text-white">Entrar</button>
    </form>
  </main>
}
