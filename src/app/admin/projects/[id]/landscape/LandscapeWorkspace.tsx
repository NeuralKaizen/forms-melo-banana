'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  EJES, MIN_TENDENCIAS, MAX_TENDENCIAS,
  type Stage, type StageKey, type StageStatus, type TendenciaCandidata,
} from '@/lib/landscape/stages'
import { ContenidoEtapa } from './ContenidoEtapa'

/** Lo que la página le pasa al panel: ya formateado, sin fechas crudas. */
export interface ActividadVista {
  id: string
  autor: 'claude' | 'humano'
  quien?: string
  texto: string
  cuando: string
}

type ContenidoEtapaVista = {
  id: string
  content: unknown
  aprobada: boolean
  /** Lo que Claude guardó después de la aprobación. Ver `StageState.borradorNuevo`. */
  borradorNuevo: { id: string; content: unknown } | null
} | null

const STATUS_LABEL: Record<StageStatus, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  aprobada: 'Aprobada',
  no_aplica: 'No aplica',
}

function StageDot({ status }: { status: StageStatus }) {
  const base = 'h-3.5 w-3.5 flex-none rounded-full border'
  if (status === 'aprobada') return <span className={`${base} border-[var(--banana)] bg-[var(--banana)]`} />
  if (status === 'en_curso') return <span className={`${base} border-[var(--banana)] bg-white`} />
  return <span className={`${base} border-black/15 bg-white`} />
}

function StageRow({ stage, active, onSelect }: { stage: Stage; active: boolean; onSelect: () => void }) {
  const muted = stage.status === 'no_aplica'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'step' : undefined}
      className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-200
        ${active ? 'bg-[#fffdf0] shadow-[inset_3px_0_0_0_var(--banana)]' : 'hover:bg-[#faf7ee]'}`}
    >
      <span className="mt-0.5"><StageDot status={stage.status} /></span>
      <span className="min-w-0">
        <span className={`block text-[13.5px] leading-tight ${muted ? 'text-[#b3ab9b]' : active ? 'font-semibold text-ink' : 'text-[#6b6155]'}`}>
          {stage.label}
        </span>
        <span className="mt-0.5 block text-[10.5px] text-[#a59c89]">
          {stage.hint ?? STATUS_LABEL[stage.status]}
        </span>
      </span>
    </button>
  )
}

function FuentePill({ doc, pagina }: { doc: string; pagina?: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#f7f3e6] px-2.5 py-0.5 text-[10.5px] text-[#8a6d10]">
      {doc}{pagina ? ` · p.${pagina}` : ''}
    </span>
  )
}

function TendenciaCard({ t, selected, onToggle }: { t: TendenciaCandidata; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors duration-200
        ${selected ? 'border-[var(--banana)] bg-[#fffdf0]' : 'border-black/5 bg-white hover:border-black/15'}`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-[5px] border transition-colors duration-200
          ${selected ? 'border-[var(--banana)] bg-[var(--banana)]' : 'border-black/20 bg-white'}`}
      >
        {selected && (
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#1a1510" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-medium leading-snug text-ink">{t.titulo}</span>
        <span className="mt-1 block text-[13px] leading-relaxed text-[#6b6155]">{t.descripcion}</span>
        <span className="mt-2.5 flex flex-wrap gap-1.5">
          {t.fuentes.map((f, i) => <FuentePill key={i} doc={f.doc} pagina={f.pagina} />)}
        </span>
      </span>
    </button>
  )
}

/**
 * Claude escribió sobre una etapa que el equipo ya había aprobado. Lo aprobado sigue
 * mandando —una escritura desde un chat no deshace una decisión— pero lo nuevo tiene
 * que estar a un clic, no perdido en la actividad.
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

function ActividadItem({ a }: { a: ActividadVista }) {
  return (
    <li className="flex gap-2.5 py-2.5">
      <span
        className={`mt-1 h-1.5 w-1.5 flex-none rounded-full ${a.autor === 'claude' ? 'bg-[var(--banana)]' : 'bg-[#c9c0ac]'}`}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block text-[12.5px] leading-snug text-[#4a4438]">
          <strong className="font-semibold text-ink">{a.autor === 'claude' ? 'Claude' : a.quien ?? 'Equipo'}</strong>{' '}
          {a.texto}
        </span>
        <span className="mt-0.5 block text-[11px] text-[#a59c89]">{a.cuando}</span>
      </span>
    </li>
  )
}

export function LandscapeWorkspace({
  projectId,
  stages,
  tendencias,
  seleccionAprobada,
  tendenciasAprobadas,
  contenidoPorEtapa,
  actividad,
}: {
  projectId: string
  stages: Stage[]
  tendencias: TendenciaCandidata[]
  seleccionAprobada: string[]
  tendenciasAprobadas: boolean
  contenidoPorEtapa: Record<string, ContenidoEtapaVista>
  actividad: ActividadVista[]
}) {
  const router = useRouter()
  const [stage, setStage] = useState<StageKey>(
    stages.find(s => s.status === 'en_curso')?.key ?? 'tendencias',
  )
  const [selected, setSelected] = useState<string[]>(seleccionAprobada)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Qué se está mirando cuando la etapa tiene una aprobada y un borrador más nuevo.
  // Arranca en la aprobada: es la que manda hasta que el equipo decida otra cosa.
  const [viendoBorrador, setViendoBorrador] = useState(false)

  function irAEtapa(key: StageKey) {
    setStage(key)
    setViendoBorrador(false)
    setError(null)
  }

  // `seleccionAprobada` puede cambiar por fuera de este componente: Claude escribe
  // etapas por MCP mientras el panel está abierto, así que no es un caso raro. Se
  // resincroniza cuando el *contenido* cambia de verdad — no en cada render, que
  // traería una nueva referencia de array aunque el contenido sea el mismo, y no
  // cuando el usuario está armando una selección propia que todavía no mandó.
  const previaRef = useRef(seleccionAprobada)
  useEffect(() => {
    const previa = previaRef.current
    const cambio = previa.length !== seleccionAprobada.length
      || previa.some((id, i) => id !== seleccionAprobada[i])
    if (cambio) {
      setSelected(seleccionAprobada)
      previaRef.current = seleccionAprobada
    }
  }, [seleccionAprobada])

  const toggle = (id: string) =>
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length >= MAX_TENDENCIAS ? prev : [...prev, id],
    )

  const listo = selected.length >= MIN_TENDENCIAS && selected.length <= MAX_TENDENCIAS
  const tope = selected.length >= MAX_TENDENCIAS

  async function aprobarSeleccion() {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/landscape/tendencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'seleccionar-tendencias', seleccionadas: selected }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'No se pudo guardar')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  // Aprobar una versión ya guardada. Solo aplica a etapas que no son 'tendencias': esa
  // tiene su propio gate (aprobarSeleccion), porque ahí guardar y aprobar son un solo
  // acto — la selección *es* la decisión. Acá son dos actos separados: Claude guarda
  // por MCP, el equipo aprueba después desde el panel.
  async function aprobarVersion(etapa: StageKey, versionId: string) {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/landscape/${etapa}`, {
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

  const etapaActual = stages.find(s => s.key === stage)
  const contenido = contenidoPorEtapa[stage]
  const hayLongList = tendencias.length > 0

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
      <nav aria-label="Etapas del landscape" className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">Etapas</p>
        <div className="space-y-0.5">
          {stages.map(s => (
            <StageRow key={s.key} stage={s} active={s.key === stage} onSelect={() => irAEtapa(s.key)} />
          ))}
        </div>
      </nav>

      {/* Contenido de la etapa */}
      <section className="min-w-0">
        {stage === 'tendencias' && hayLongList ? (
          <>
            <header className="mb-5">
              <h2 className="font-serif text-xl font-medium text-ink">Tendencias</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#8a8170]">
                Long list propuesta por Claude desde el archivo del estudio. Elige entre {MIN_TENDENCIAS} y {MAX_TENDENCIAS};
                cada una se desarrolla después en tres diapositivas.
              </p>
            </header>

            {/* Acá no hay toggle: la lista de abajo ya es la ampliada, porque elegir sobre
                la vieja no tendría sentido. Lo que cambia es que hay que volver a decidir. */}
            {borradorNuevo && (
              <div className="mb-5 rounded-2xl border border-[var(--banana)]/45 bg-[#fffdf0] px-4 py-3">
                <p className="text-[12.5px] leading-relaxed text-[#6b6155]">
                  Claude amplió la long list después de la selección aprobada. Abajo está la lista completa;
                  <span className="text-[#a59c89]"> la selección vigente sigue siendo la anterior hasta que vuelvas a aprobar.</span>
                </p>
              </div>
            )}

            {EJES.map(eje => {
              const delEje = tendencias.filter(t => t.eje === eje)
              if (delEje.length === 0) return null
              return (
                <div key={eje} className="mb-6">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a59c89]">Eje · {eje}</p>
                  <div className="space-y-2.5">
                    {delEje.map(t => (
                      <TendenciaCard key={t.id} t={t} selected={selected.includes(t.id)} onToggle={() => toggle(t.id)} />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Gate humano: bloquea el avance de la etapa */}
            <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-5 py-3.5 shadow-[0_8px_24px_-12px_rgba(26,21,16,0.5)]">
              <p className="text-[13px] text-white/85">
                <span className="font-semibold text-white tabular-nums">{selected.length}</span> de {MIN_TENDENCIAS}–{MAX_TENDENCIAS} seleccionadas
                <span className="text-white/50"> · decide el equipo, no el agente</span>
                {tope && <span className="ml-1 text-[var(--banana)]">Llegaste al máximo.</span>}
                {error && <span className="ml-1 text-[#ff9c8a]">{error}</span>}
              </p>
              <button
                type="button"
                disabled={!listo || guardando}
                onClick={aprobarSeleccion}
                className="rounded-xl bg-[var(--banana)] px-4 py-2 text-[13px] font-semibold text-[#1a1510] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {guardando ? 'Guardando…' : tendenciasAprobadas ? 'Actualizar selección' : 'Aprobar y desarrollar'}
              </button>
            </div>
          </>
        ) : contenido && vista ? (
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

            {/* Gate humano, igual que el de tendencias: 'tendencias' no pasa por acá,
                tiene el suyo arriba. Aprueba lo que se está viendo — así el borrador
                nuevo se sella sin que haya que pasar por otra pantalla. */}
            {stage !== 'tendencias' && !vista.aprobada && (
              <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-5 py-3.5 shadow-[0_8px_24px_-12px_rgba(26,21,16,0.5)]">
                <p className="text-[13px] text-white/85">
                  {mostrandoBorrador ? 'Versión más nueva, sin aprobar' : 'Sin aprobar'}
                  <span className="text-white/50"> · decide el equipo, no el agente</span>
                  {error && <span className="ml-1 text-[#ff9c8a]">{error}</span>}
                </p>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => aprobarVersion(stage, vista.id)}
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

      {/* Actividad desde Claude */}
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

        <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">Actividad</p>
          {actividad.length === 0 ? (
            <p className="mt-2 text-[12px] leading-relaxed text-[#a59c89]">Todavía no pasó nada en este proyecto.</p>
          ) : (
            <ul className="mt-1 divide-y divide-black/5">
              {actividad.map(a => <ActividadItem key={a.id} a={a} />)}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
