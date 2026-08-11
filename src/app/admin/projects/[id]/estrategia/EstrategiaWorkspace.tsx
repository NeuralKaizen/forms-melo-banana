'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StageStatus } from '@/lib/landscape/stages'
import type { EstrategiaKey, EtapaEstrategia } from '@/lib/estrategia/stages'
import { ContenidoEtapa } from '../landscape/ContenidoEtapa'

/**
 * Espejo de `LandscapeWorkspace`, con dos restas: no hay gate de tendencias (la
 * estrategia no tiene una etapa como esa, todas se aprueban igual) y no hay columna
 * de actividad (`listLandscapeActivity` no tiene equivalente todavía).
 */

type ContenidoEtapaVista = {
  id: string
  content: unknown
  aprobada: boolean
  /** Lo que Claude guardó después de la aprobación. Ver `StrategyStageState.borradorNuevo`. */
  borradorNuevo: { id: string; content: unknown } | null
} | null

const STATUS_LABEL: Record<StageStatus, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  aprobada: 'Aprobada',
  no_aplica: 'No aplica',
}

function EtapaDot({ status }: { status: StageStatus }) {
  const base = 'h-3.5 w-3.5 flex-none rounded-full border'
  if (status === 'aprobada') return <span className={`${base} border-[var(--banana)] bg-[var(--banana)]`} />
  if (status === 'en_curso') return <span className={`${base} border-[var(--banana)] bg-white`} />
  return <span className={`${base} border-black/15 bg-white`} />
}

function EtapaRow({ etapa, active, onSelect }: { etapa: EtapaEstrategia; active: boolean; onSelect: () => void }) {
  const muted = etapa.status === 'no_aplica'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'step' : undefined}
      className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-200
        ${active ? 'bg-[#fffdf0] shadow-[inset_3px_0_0_0_var(--banana)]' : 'hover:bg-[#faf7ee]'}`}
    >
      <span className="mt-0.5"><EtapaDot status={etapa.status} /></span>
      <span className="min-w-0">
        <span className={`block text-[13.5px] leading-tight ${muted ? 'text-[#b3ab9b]' : active ? 'font-semibold text-ink' : 'text-[#6b6155]'}`}>
          {etapa.label}
        </span>
        <span className="mt-0.5 block text-[10.5px] text-[#a59c89]">
          {etapa.hint ?? STATUS_LABEL[etapa.status]}
        </span>
      </span>
    </button>
  )
}

/**
 * Claude escribió sobre una etapa que el equipo ya había aprobado. Lo aprobado sigue
 * mandando —una escritura desde un chat no deshace una decisión— pero lo nuevo tiene
 * que estar a un clic, no perdido.
 */
function AvisoBorradorNuevo({ viendoBorrador, onCambiar }: { viendoBorrador: boolean; onCambiar: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--banana)]/45 bg-[#fffdf0] px-4 py-3">
      <p className="text-[12.5px] leading-relaxed text-[#6b6155]">
        Claude guardó una versión más nueva después de la aprobación.
        <span className="text-[#a59c89]"> La aprobada sigue vigente hasta que el equipo decida.</span>
      </p>
      <button
        type="button"
        onClick={onCambiar}
        className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors duration-200 hover:border-black/25"
      >
        {viendoBorrador ? 'Ver la aprobada' : 'Ver la nueva'}
      </button>
    </div>
  )
}

export function EstrategiaWorkspace({
  projectId,
  etapas,
  resumen,
  contenidoPorEtapa,
}: {
  projectId: string
  etapas: EtapaEstrategia[]
  /** De `summarizeStrategy`: cuántas de las 14 etapas están aprobadas. */
  resumen: { aprobadas: number; total: number }
  contenidoPorEtapa: Record<string, ContenidoEtapaVista>
}) {
  const router = useRouter()
  const [etapa, setEtapa] = useState<EstrategiaKey>(
    etapas.find(e => e.status === 'en_curso')?.key ?? etapas[0].key,
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Qué se está mirando cuando la etapa tiene una aprobada y un borrador más nuevo.
  // Arranca en la aprobada: es la que manda hasta que el equipo decida otra cosa.
  const [viendoBorrador, setViendoBorrador] = useState(false)

  function irAEtapa(key: EstrategiaKey) {
    setEtapa(key)
    setViendoBorrador(false)
    setError(null)
  }

  // Aprobar una versión ya guardada: Claude guarda por MCP, el equipo aprueba después
  // desde el panel. A diferencia de landscape, acá no hay una etapa con gate propio
  // (no hay equivalente de tendencias) — todas pasan por este único camino.
  async function aprobarVersion(etapaKey: EstrategiaKey, versionId: string) {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/estrategia/${etapaKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'aprobar', versionId }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'No se pudo aprobar')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const etapaActual = etapas.find(e => e.key === etapa)
  const contenido = contenidoPorEtapa[etapa]

  // Lo aprobado manda: la vista arranca en `contenido` y solo cambia si el equipo pide
  // ver el borrador. `vista` es lo que se muestra y lo que aprueba el botón de abajo.
  const borradorNuevo = contenido?.borradorNuevo ?? null
  const mostrandoBorrador = !!borradorNuevo && viendoBorrador
  const vista = mostrandoBorrador
    ? { id: borradorNuevo.id, content: borradorNuevo.content, aprobada: false }
    : contenido

  return (
    <div className="grid gap-6 lg:grid-cols-[176px_minmax(0,1fr)_248px]">

      {/* Etapas */}
      <nav aria-label="Etapas de la estrategia" className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">
          Etapas
          <span className="ml-1 normal-case tracking-normal text-[#a59c89]">
            · {resumen.aprobadas} de {resumen.total} aprobadas
          </span>
        </p>
        <div className="space-y-0.5">
          {etapas.map(e => (
            <EtapaRow key={e.key} etapa={e} active={e.key === etapa} onSelect={() => irAEtapa(e.key)} />
          ))}
        </div>
      </nav>

      {/* Contenido de la etapa */}
      <section className="min-w-0">
        {contenido && vista ? (
          <>
            <header className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-xl font-medium text-ink">{etapaActual?.label}</h2>
              <span className="text-[11px] text-[#a59c89]">
                {vista.aprobada ? 'Versión aprobada' : 'Borrador sin aprobar'}
              </span>
            </header>

            {borradorNuevo && (
              <AvisoBorradorNuevo
                viendoBorrador={viendoBorrador}
                onCambiar={() => setViendoBorrador(v => !v)}
              />
            )}

            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <ContenidoEtapa content={vista.content} />
            </div>

            {/* Gate humano: aprueba lo que se está viendo, así el borrador nuevo se sella
                sin pasar por otra pantalla. */}
            {!vista.aprobada && (
              <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-5 py-3.5 shadow-[0_8px_24px_-12px_rgba(26,21,16,0.5)]">
                <p className="text-[13px] text-white/85">
                  {mostrandoBorrador ? 'Versión más nueva, sin aprobar' : 'Sin aprobar'}
                  <span className="text-white/50"> · decide el equipo, no el agente</span>
                  {error && <span className="ml-1 text-[#ff9c8a]">{error}</span>}
                </p>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => aprobarVersion(etapa, vista.id)}
                  className="rounded-xl bg-[var(--banana)] px-4 py-2 text-[13px] font-semibold text-[#1a1510] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {guardando ? 'Guardando…' : mostrandoBorrador ? 'Aprobar esta versión' : 'Aprobar'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-black/5 bg-white p-10 text-center shadow-sm">
            <h2 className="font-serif text-lg font-medium text-ink">{etapaActual?.label}</h2>
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-[#8a8170]">
              Esta etapa todavía no tiene una versión guardada. Cuando el equipo la trabaje en Claude,
              el resultado aparece aquí para revisar y aprobar.
            </p>
          </div>
        )}
      </section>

      {/* Conectado a Claude — sin columna de actividad: acá todavía no hay equivalente
          de `listLandscapeActivity`. */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5aa469]" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b6155]">Conectado a Claude</p>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-[#8a8170]">
            Este proyecto y el archivo del estudio están disponibles como contexto en las conversaciones del equipo.
            No hay que volver a subir nada.
          </p>
        </div>
      </aside>
    </div>
  )
}
