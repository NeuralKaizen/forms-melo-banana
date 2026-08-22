'use client'
import { useState } from 'react'
import type { Deliverable, PartKey } from '@/lib/deliverable/schema'
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

export function DeliverablePanel({ projectId, view, deliverable, sessionsCount }: {
  projectId: string
  view: DeckView | null
  /** El contenido crudo del entregable: el editor trabaja sobre esto, no sobre el view. */
  deliverable: Deliverable | null
  /** Cuántas entrevistas alimentan el documento. La lista vive en la fase Entrevistas. */
  sessionsCount: number
}) {
  const [busy, setBusy] = useState<PartKey | 'full' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; label: string } | null>(null)

  async function postPart(part: PartKey) {
    const res = await fetch(`/api/projects/${projectId}/deliverable?part=${part}`, { method: 'POST' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'error')
  }

  // Regenerar pisa lo que el equipo corrigió a mano: eso no puede pasar en silencio.
  const editadas = (parts: PartKey[]) => parts.filter(p => deliverable?.[p]?.meta?.editedAt)
  function confirmaPisarEdiciones(parts: PartKey[]): boolean {
    const conEdicion = editadas(parts)
    if (!conEdicion.length) return true
    return confirm('Hay ediciones hechas a mano en esta parte del documento. Regenerar las reemplaza por lo que escriba el modelo. ¿Seguir?')
  }

  // Regeneración de UNA parte (botón chico de la sección).
  async function generateOne(part: PartKey) {
    if (!confirmaPisarEdiciones([part])) return
    setBusy(part); setError(null)
    try { await postPart(part); location.reload() }
    catch (e) { setError(String(e)); setBusy(null) }
  }

  // Generar / Regenerar TODO: los 5 pasos en cadena con barra de progreso. Si uno falla,
  // lo ya generado queda guardado y el documento lo muestra con sus botones de reintento.
  async function generateAll() {
    if (!confirmaPisarEdiciones(STEPS.map(s => s.key))) return
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

  return <div className="space-y-6">
    <section className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">Documento</h2>
          <p className="mt-0.5 text-[13px] text-[var(--secundario)]">
            {sessionsCount === 0
              ? 'Todavía no hay entrevistas que lo alimenten.'
              : `Se arma con ${sessionsCount} ${sessionsCount === 1 ? 'entrevista' : 'entrevistas'} del proyecto.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!!view && (
            <a href={`/api/projects/${projectId}/deck`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ink)]/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[var(--ink)]/45 hover:bg-[var(--superficie)]">
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
            <span className="font-medium text-ink">Generando entregable… <span className="font-normal text-[var(--secundario)]">{progress.label}</span></span>
            <span className="tabular-nums text-[var(--rotulo)]">{progress.done}/{STEPS.length}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#efe9db]">
            <div className="h-full rounded-full bg-[var(--banana)] transition-[width] duration-500 ease-out"
              style={{ width: `${(progress.done / STEPS.length) * 100}%` }} />
          </div>
        </div>
      )}

    </section>

    {error && (
      <div role="alert" ref={el => el?.scrollIntoView({ block: 'nearest' })}
        className="animate-fade rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    )}

    {view
      ? <DeliverableDocument view={view} busy={busy} deliverable={deliverable} projectId={projectId} onRegenerate={generateOne} />
      : (
        <section className="p-8 text-center">
          <p className="text-[15px] text-[var(--secundario)]">Todavía no hay entregable. Genera el documento cuando las entrevistas estén completas.</p>
        </section>
      )}

    {/* La personalidad generada ya no se muestra acá: vive como borrador de Claude en la
        etapa Personalidad de Estrategia, con su circuito de aprobación. */}
  </div>
}
