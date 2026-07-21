'use client'
import { useState } from 'react'
import type { PartKey, Part, Personalidad } from '@/lib/deliverable/schema'
import type { DeckView } from '@/lib/deck/view-model'
import { DeliverableDocument } from './DeliverableDocument'

// El entregable se arma en 5 pasos encadenados (cada uno es 1 llamada al modelo, bajo el
// tope de tiempo del plan). El cliente los dispara en orden de dependencia; cada paso se
// guarda en el server, así el siguiente lee lo previo. Para el usuario es "un solo botón".
const STEPS: { key: PartKey; label: string }[] = [
  { key: 'personalidad', label: 'Personalidad' },
  { key: 'problema', label: 'Problema' },
  { key: 'competencia', label: 'Competencia' },
  { key: 'perfil', label: 'Perfil de usuario' },
  { key: 'propuestaValor', label: 'Propuesta de valor' },
]

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
  const [progress, setProgress] = useState<{ done: number; label: string } | null>(null)

  async function postPart(part: PartKey) {
    const res = await fetch(`/api/projects/${projectId}/deliverable?part=${part}`, { method: 'POST' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'error')
  }

  // Regeneración de UNA parte (botón chico de la sección).
  async function generateOne(part: PartKey) {
    setBusy(part); setError(null)
    try { await postPart(part); location.reload() }
    catch (e) { setError(String(e)); setBusy(null) }
  }

  // Generar / Regenerar TODO: los 5 pasos en cadena con barra de progreso. Si uno falla,
  // lo ya generado queda guardado y el documento lo muestra con sus botones de reintento.
  async function generateAll() {
    setBusy('full'); setError(null); setProgress({ done: 0, label: STEPS[0].label })
    try {
      for (let i = 0; i < STEPS.length; i++) {
        setProgress({ done: i, label: STEPS[i].label })
        await postPart(STEPS[i].key)
      }
      setProgress({ done: STEPS.length, label: 'Listo' })
    } finally {
      // El view-model se rearma en el server (corpus + citas verificadas): recargamos.
      location.reload()
    }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-ink">Respondientes ({sessions.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!!view && (
            <a href={`/api/projects/${projectId}/deck`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ink)]/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[var(--ink)]/45 hover:bg-[#faf7ee]">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
              </svg>
              Descargar PDF del taller
            </a>
          )}
          <button onClick={generateAll} disabled={busy !== null}
            className="group inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(26,21,16,0.25)] transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-px hover:shadow-[0_6px_18px_-4px_rgba(26,21,16,0.35)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(26,21,16,0.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--banana)]">
              <path d="M13 3l2.3 6.2L21.5 11.5 15.3 13.8 13 20l-2.3-6.2L4.5 11.5 10.7 9.2 13 3z" />
              <path d="M5 4v3M3.5 5.5h3" />
            </svg>
            {busy === 'full' ? 'Generando…' : view ? 'Regenerar todo' : 'Generar entregable'}
          </button>
        </div>
      </div>

      {busy === 'full' && progress && (
        <div className="mt-4 animate-fade" aria-live="polite">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-ink">Generando entregable… <span className="font-normal text-[#8a8170]">{progress.label}</span></span>
            <span className="tabular-nums text-[#a59c89]">{progress.done}/{STEPS.length}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#efe9db]">
            <div className="h-full rounded-full bg-[var(--banana)] transition-[width] duration-500 ease-out"
              style={{ width: `${(progress.done / STEPS.length) * 100}%` }} />
          </div>
        </div>
      )}

      <ul className="mt-4 divide-y divide-black/5">
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
      ? <DeliverableDocument view={view} busy={busy} onRegenerate={generateOne} />
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
          <button onClick={e => { e.preventDefault(); generateOne('personalidad') }} disabled={busy !== null}
            className="rounded-lg border border-black/10 px-3 py-1 text-xs font-medium text-[#6b6155] transition-colors duration-200 hover:border-[var(--ink)]/30 hover:text-ink disabled:opacity-50">
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
