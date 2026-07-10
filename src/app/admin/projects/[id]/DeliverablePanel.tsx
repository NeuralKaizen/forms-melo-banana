'use client'
import { useState } from 'react'
import type { Deliverable, PartKey, Item } from '@/lib/deliverable/schema'

const PARTS: { key: PartKey; label: string }[] = [
  { key: 'personalidad', label: 'Personalidad (apoyo)' },
  { key: 'problema', label: 'Declaración del problema' },
  { key: 'competencia', label: 'Panorama de la categoría' },
  { key: 'perfil', label: 'Perfil de usuario' },
  { key: 'propuestaValor', label: 'Propuesta de valor' },
]

const badge = (o: Item['origen']) =>
  o === 'cliente' ? 'bg-[#fff3c4] text-[#8a6d00]'
  : o === 'equipo' ? 'bg-[#1a1510]/8 text-[#1a1510]'
  : 'bg-[#eeeae0] text-[#8a8170]'
const badgeLabel = (o: Item['origen']) => o === 'cliente' ? 'cliente' : o === 'equipo' ? 'equipo' : 'pendiente'

function ItemList({ items }: { items: Item[] }) {
  if (!items?.length) return <p className="text-sm text-[#a59c89]">— pendiente del taller —</p>
  return <ul className="space-y-1">{items.map((i, k) => (
    <li key={k} className="flex gap-2 text-sm">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge(i.origen)}`}>{badgeLabel(i.origen)}</span>
      <span>{i.texto}{i.cita ? <em className="text-[#8a8170]"> — “{i.cita}”</em> : null}</span>
    </li>
  ))}</ul>
}

export function DeliverablePanel({ projectId, initial, sessions, projects }: {
  projectId: string
  initial: Deliverable | null
  sessions: { id: string; name: string; role: string }[]
  projects: { id: string; name: string }[]
}) {
  const [d, setD] = useState<Deliverable | null>(initial)
  const [busy, setBusy] = useState<PartKey | 'full' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate(part?: PartKey) {
    setBusy(part ?? 'full'); setError(null)
    try {
      const url = `/api/projects/${projectId}/deliverable${part ? `?part=${part}` : ''}`
      const res = await fetch(url, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'error')
      setD(json as Deliverable)
    } catch (e) { setError(String(e)) } finally { setBusy(null) }
  }

  async function reassign(sessionId: string, newProjectId: string) {
    if (!newProjectId || newProjectId === projectId) return
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: newProjectId }),
    })
    location.reload()
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-ink">Respondientes ({sessions.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!!d && (
            <a href={`/api/projects/${projectId}/deck`}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--ink)]/20 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-[var(--ink)]">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
              </svg>
              Descargar PDF del taller
            </a>
          )}
          <button onClick={() => generate()} disabled={busy !== null}
            className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
            {busy === 'full' ? 'Generando…' : d ? 'Regenerar todo' : 'Generar entregable'}
          </button>
        </div>
      </div>
      <ul className="divide-y divide-black/5">
        {sessions.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span>
              <a href={`/admin/${s.id}`} className="font-medium text-ink underline decoration-black/20 underline-offset-2 transition-colors hover:decoration-[var(--banana)]">{s.name}</a>
              {' · '}<span className="text-[#8a8170]">{s.role}</span>
            </span>
            <select defaultValue="" onChange={e => reassign(s.id, e.target.value)}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs text-[#8a8170] outline-none transition focus:border-[var(--banana)]">
              <option value="">mover a…</option>
              {projects.filter(p => p.id !== projectId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </section>

    {error && <div className="animate-fade rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

    {PARTS.map(({ key, label }) => {
      const part = d?.[key]
      return <section key={key} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">{label}</h2>
          {d && <button onClick={() => generate(key)} disabled={busy !== null}
            className="rounded-lg border border-black/10 px-3 py-1 text-xs font-medium text-[#8a8170] transition-colors hover:border-[var(--ink)]/30 hover:text-ink disabled:opacity-50">
            {busy === key ? 'Regenerando…' : 'Regenerar'}</button>}
        </div>
        {!part && <p className="text-sm text-[#a59c89]">Sin generar.</p>}
        {part?.meta.error && <p className="animate-fade rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{part.meta.error}</p>}
        {part?.data && <PartBody k={key} data={part.data as any} />}
      </section>
    })}
  </div>
}

function PartBody({ k, data }: { k: PartKey; data: any }) {
  if (k === 'personalidad') return <div className="space-y-2 text-sm">
    <p><strong>Arquetipo:</strong> {data.arquetipo}</p>
    <p><strong>Atributos:</strong> {data.atributos.join(', ') || '—'}</p>
    <p><strong>Qué NO quiere ser:</strong> {data.queNoQuiereSer.join(', ') || '—'}</p>
    <p><strong>Tensiones:</strong> {data.tensiones.join(' · ') || '—'}</p>
  </div>
  if (k === 'problema') return <div className="space-y-3 text-sm">
    <p><strong>Problema (mundo/consumidor):</strong> {data.problemaMundo}</p>
    <p><strong>Para la marca:</strong> {data.problemaMarca}</p>
    <div><strong>¿Qué resolvemos para el consumidor?</strong><ItemList items={data.problemaConsumidor} /></div>
    <div><strong>¿Cómo lo hacemos?</strong><ItemList items={data.comoLoHacemos} /></div>
    <div><strong>¿Por qué es relevante?</strong><ItemList items={data.porQueRelevante} /></div>
  </div>
  if (k === 'competencia') return <div className="space-y-3 text-sm">
    <div><strong>Competidores:</strong><ItemList items={data.competidores} /></div>
    <div><strong>Otros referentes:</strong>
      <ul className="space-y-1">{data.otrosReferentes.map((r: any, i: number) =>
        <li key={i}>{r.marca} <span className="text-[#a59c89]">({r.tipo}, {r.origen})</span></li>)}</ul></div>
    <div><strong>Ejes de comparación:</strong>
      <ul className="space-y-1">{data.ejes.map((e: any, i: number) =>
        <li key={i}>{e.nombre}: {e.extremoIzquierdo} ↔ {e.extremoDerecho} <span className="text-[#a59c89]">({e.origen})</span></li>)}</ul></div>
    <p><strong>Posición actual:</strong> {data.posicionActual.texto} <span className="text-[#a59c89]">({data.posicionActual.origen})</span></p>
    <p><strong>Posición ideal:</strong> {data.posicionIdeal.texto} <span className="text-[#a59c89]">({data.posicionIdeal.origen})</span></p>
  </div>
  if (k === 'perfil') return <div className="space-y-3 text-sm">
    <div><strong>Jobs to be done:</strong><ItemList items={data.jobs} /></div>
    <div><strong>Gains:</strong><ItemList items={data.gains} /></div>
    <div><strong>Pains:</strong><ItemList items={data.pains} /></div>
  </div>
  // propuestaValor
  return <div className="space-y-3 text-sm">
    <p className="rounded-lg border-l-4 border-[var(--banana)] bg-[var(--cream)] p-3">
      En <strong>{data.formula.marca}</strong>, {data.formula.verbo} {data.formula.razonDeSer}. Somos {data.formula.beneficioCentral}.
    </p>
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-black/10 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8a8170]">
          <th className="py-1.5 pr-2">Job</th><th className="py-1.5 pr-2">Solución</th><th className="py-1.5">Cómo se resuelve</th>
        </tr>
      </thead>
      <tbody>{data.filas.map((f: any, i: number) => (
        <tr key={i} className="border-b border-black/5 align-top"><td className="py-1.5 pr-2">{f.job}</td><td className="py-1.5 pr-2">{f.solucion}</td><td className="py-1.5">{f.comoSeResuelve}</td></tr>
      ))}</tbody>
    </table>
  </div>
}
