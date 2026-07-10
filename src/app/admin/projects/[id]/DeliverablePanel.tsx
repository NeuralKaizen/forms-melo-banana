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
  o === 'cliente' ? 'bg-green-100 text-green-800'
  : o === 'equipo' ? 'bg-amber-100 text-amber-800'
  : 'bg-gray-200 text-gray-600'
const badgeLabel = (o: Item['origen']) => o === 'cliente' ? 'cliente' : o === 'equipo' ? 'equipo' : 'pendiente'

function ItemList({ items }: { items: Item[] }) {
  if (!items?.length) return <p className="text-sm text-black/40">— pendiente del taller —</p>
  return <ul className="space-y-1">{items.map((i, k) => (
    <li key={k} className="flex gap-2 text-sm">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge(i.origen)}`}>{badgeLabel(i.origen)}</span>
      <span>{i.texto}{i.cita ? <em className="text-black/50"> — “{i.cita}”</em> : null}</span>
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

  return <div className="space-y-8">
    <section className="rounded-2xl bg-[var(--cream)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Respondientes ({sessions.length})</h2>
        <div className="flex items-center gap-3">
          {!!d && (
            <a
              href={`/api/projects/${projectId}/deck`}
              style={{ textDecoration: 'underline' }}
            >
              Descargar PDF del taller
            </a>
          )}
          <button onClick={() => generate()} disabled={busy !== null}
            className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy === 'full' ? 'Generando…' : d ? 'Regenerar todo' : 'Generar entregable'}
          </button>
        </div>
      </div>
      <ul className="space-y-2">
        {sessions.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{s.name} · <span className="text-black/50">{s.role}</span></span>
            <select defaultValue="" onChange={e => reassign(s.id, e.target.value)}
              className="rounded border px-2 py-1 text-xs">
              <option value="">mover a…</option>
              {projects.filter(p => p.id !== projectId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </section>

    {error && <p className="text-red-600">⚠ {error}</p>}

    {PARTS.map(({ key, label }) => {
      const part = d?.[key]
      return <section key={key} className="rounded-2xl border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{label}</h2>
          {d && <button onClick={() => generate(key)} disabled={busy !== null}
            className="rounded-lg border px-3 py-1 text-xs disabled:opacity-50">
            {busy === key ? 'Regenerando…' : 'Regenerar'}</button>}
        </div>
        {!part && <p className="text-sm text-black/40">Sin generar.</p>}
        {part?.meta.error && <p className="text-sm text-red-600">⚠ {part.meta.error}</p>}
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
        <li key={i}>{r.marca} <span className="text-black/40">({r.tipo}, {r.origen})</span></li>)}</ul></div>
    <div><strong>Ejes de comparación:</strong>
      <ul className="space-y-1">{data.ejes.map((e: any, i: number) =>
        <li key={i}>{e.nombre}: {e.extremoIzquierdo} ↔ {e.extremoDerecho} <span className="text-black/40">({e.origen})</span></li>)}</ul></div>
    <p><strong>Posición actual:</strong> {data.posicionActual.texto} <span className="text-black/40">({data.posicionActual.origen})</span></p>
    <p><strong>Posición ideal:</strong> {data.posicionIdeal.texto} <span className="text-black/40">({data.posicionIdeal.origen})</span></p>
  </div>
  if (k === 'perfil') return <div className="space-y-3 text-sm">
    <div><strong>Jobs to be done:</strong><ItemList items={data.jobs} /></div>
    <div><strong>Gains:</strong><ItemList items={data.gains} /></div>
    <div><strong>Pains:</strong><ItemList items={data.pains} /></div>
  </div>
  // propuestaValor
  return <div className="space-y-3 text-sm">
    <p className="rounded-lg bg-[var(--cream)] p-3">
      En <strong>{data.formula.marca}</strong>, {data.formula.verbo} {data.formula.razonDeSer}. Somos {data.formula.beneficioCentral}.
    </p>
    <table className="w-full text-left text-xs">
      <thead><tr className="border-b"><th className="py-1 pr-2">Job</th><th className="py-1 pr-2">Solución</th><th className="py-1">Cómo se resuelve</th></tr></thead>
      <tbody>{data.filas.map((f: any, i: number) => (
        <tr key={i} className="border-b align-top"><td className="py-1 pr-2">{f.job}</td><td className="py-1 pr-2">{f.solucion}</td><td className="py-1">{f.comoSeResuelve}</td></tr>
      ))}</tbody>
    </table>
  </div>
}
