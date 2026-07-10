'use client'
import { useState } from 'react'
import type { PartKey, Part, Personalidad } from '@/lib/deliverable/schema'
import type { DeckView } from '@/lib/deck/view-model'
import { DeliverableDocument } from './DeliverableDocument'

function Linea({ label, value }: { label: string; value: string }) {
  return <p className="text-[15px] leading-relaxed text-ink"><strong className="font-medium">{label}:</strong> {value || '—'}</p>
}

export function DeliverablePanel({ projectId, view, personalidad, sessions, projects }: {
  projectId: string
  view: DeckView | null
  personalidad: Part<Personalidad> | null
  sessions: { id: string; name: string; role: string }[]
  projects: { id: string; name: string }[]
}) {
  const [busy, setBusy] = useState<PartKey | 'full' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate(part?: PartKey) {
    setBusy(part ?? 'full'); setError(null)
    try {
      const url = `/api/projects/${projectId}/deliverable${part ? `?part=${part}` : ''}`
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'error')
      }
      // El view-model se rearma en el servidor (corpus + citas verificadas).
      location.reload()
    } catch (e) { setError(String(e)); setBusy(null) }
  }

  async function reassign(sessionId: string, newProjectId: string) {
    if (!newProjectId || newProjectId === projectId) return
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: newProjectId }),
    })
    location.reload()
  }

  const pers = personalidad?.data ?? null

  return <div className="space-y-6">
    <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-ink">Respondientes ({sessions.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!!view && (
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
            {busy === 'full' ? 'Generando…' : view ? 'Regenerar todo' : 'Generar entregable'}
          </button>
        </div>
      </div>
      <ul className="divide-y divide-black/5">
        {sessions.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex items-center gap-1.5">
              <a href={`/api/sessions/${s.id}/pdf`} target="_blank" rel="noopener"
                className="flex items-center gap-1.5 font-medium text-ink underline decoration-black/20 underline-offset-2 transition-colors hover:decoration-[var(--banana)]">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="text-[#8a8170]">
                  <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
                  <path d="M14 3v4h4" />
                </svg>
                {s.name}
              </a>
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

    {error && (
      <div role="alert" ref={el => el?.scrollIntoView({ block: 'nearest' })}
        className="animate-fade rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    )}

    {view
      ? <DeliverableDocument view={view} busy={busy} onRegenerate={k => generate(k)} />
      : (
        <section className="rounded-2xl border border-black/5 bg-white p-8 text-center shadow-sm">
          <p className="text-[15px] text-[#8a8170]">Todavía no hay entregable. Genera el documento cuando las entrevistas estén completas.</p>
        </section>
      )}

    {!!view && (
      <details className="rounded-2xl border border-[#e6dfd0] bg-white px-6 py-4 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[#6b6155]">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            Personalidad (insumo interno)
          </span>
          <button onClick={e => { e.preventDefault(); generate('personalidad') }} disabled={busy !== null}
            className="rounded-lg border border-black/10 px-3 py-1 text-xs font-medium text-[#6b6155] transition-colors hover:border-[var(--ink)]/30 hover:text-ink disabled:opacity-50">
            {busy === 'personalidad' ? 'Regenerando…' : 'Regenerar'}
          </button>
        </summary>
        <div className="mt-4 space-y-2">
          {personalidad?.meta.error && (
            <p className="rounded-xl border border-[#f0d0d0] bg-[#fff4f4] px-4 py-3 text-sm text-[#8a3a3a]">{personalidad.meta.error}</p>
          )}
          {pers && (
            <>
              <Linea label="Arquetipo" value={pers.arquetipo} />
              <Linea label="Atributos" value={pers.atributos.join(', ')} />
              <Linea label="Qué NO quiere ser" value={pers.queNoQuiereSer.join(', ')} />
              <Linea label="Tensiones" value={pers.tensiones.join(' · ')} />
            </>
          )}
          {!pers && !personalidad?.meta.error && <p className="text-sm text-[#6b6155]">Sin generar.</p>}
        </div>
      </details>
    )}
  </div>
}
