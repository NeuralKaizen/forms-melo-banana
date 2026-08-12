'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  EJES, MIN_TENDENCIAS, MAX_TENDENCIAS, STAGE_ORDER, STAGE_LABEL,
  type Stage, type StageKey, type TendenciaCandidata,
} from '@/lib/landscape/stages'
import { EtapaDocumento } from '@/components/EtapaDocumento'
import { ComparadorVersiones } from '@/components/ComparadorVersiones'

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
  /** “Escrito por Claude · hace 2 h · sin aprobar”: se arma en el servidor, con la hora del servidor. */
  procedencia: string
  /** Cuándo se escribió. Es la cabecera de su columna en el comparador. */
  cuando: string
  /** Lo que Claude guardó después de la aprobación. Ver `StageState.borradorNuevo`. */
  borradorNuevo: { id: string; content: unknown; cuando: string } | null
} | null

function FuentePill({ doc, pagina }: { doc: string; pagina?: number }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--line)] px-2 py-0.5 text-[10.5px] text-[var(--secundario)]">
      {doc}{pagina ? ` · p.${pagina}` : ''}
    </span>
  )
}

/**
 * Una candidata de la long list. Sigue siendo un `button` con `aria-pressed`: elegirla es
 * el gate humano de la etapa, no un enlace. Lo que cambió es la presentación — era una
 * tarjeta con borde propio y ahora es una fila separada de la siguiente por un hairline.
 */
function TendenciaCard({ t, selected, onToggle }: { t: TendenciaCandidata; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 px-2 py-3 text-left transition-colors duration-200 motion-reduce:transition-none
        ${selected ? 'bg-[var(--aprobado)]' : 'hover:bg-[var(--superficie)]'}`}
    >
      <span
        className={`mt-[3px] flex h-4 w-4 flex-none items-center justify-center rounded-[4px] border transition-colors duration-200 motion-reduce:transition-none
          ${selected ? 'border-[var(--ink)] bg-[var(--banana)]' : 'border-[var(--line)] bg-white'}`}
      >
        {selected && (
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-snug text-[var(--ink)]">{t.titulo}</span>
        <span className="mt-1 block max-w-[60ch] text-[14px] leading-[1.66] text-[var(--cuerpo)]">{t.descripcion}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {t.fuentes.map((f, i) => <FuentePill key={i} doc={f.doc} pagina={f.pagina} />)}
        </span>
      </span>
    </button>
  )
}

/**
 * La actividad del proyecto, al pie del documento. Era una columna de 248px que se veía en
 * todas las etapas; acá abajo se lee cuando se la busca y no le come ancho al contenido.
 */
function Actividad({ actividad }: { actividad: ActividadVista[] }) {
  return (
    <section className="mt-12 border-t border-[var(--line)] pt-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">Actividad</p>
      {actividad.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--apagado)]">Todavía no pasó nada en este proyecto.</p>
      ) : (
        <ul className="mt-1 divide-y divide-[var(--line)]">
          {actividad.map(a => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-1.5 py-2.5 text-[13px] text-[var(--cuerpo)]">
              <span className="font-semibold text-[var(--ink)]">{a.autor === 'claude' ? 'Claude' : a.quien ?? 'Equipo'}</span>
              <span>{a.texto}</span>
              <span className="text-[var(--rotulo)]">· {a.cuando}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function LandscapeWorkspace({
  projectId,
  etapaActiva,
  stages,
  tendencias,
  seleccionAprobada,
  tendenciasAprobadas,
  contenidoPorEtapa,
  actividad,
}: {
  projectId: string
  /** La etapa que se está mirando. Viene de `?etapa=`, ya validada por la página. */
  etapaActiva: StageKey
  stages: Stage[]
  tendencias: TendenciaCandidata[]
  seleccionAprobada: string[]
  tendenciasAprobadas: boolean
  contenidoPorEtapa: Record<string, ContenidoEtapaVista>
  actividad: ActividadVista[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(seleccionAprobada)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El equipo eligió quedarse con lo aprobado. No hay dónde registrarlo: el borrador de
  // Claude no se descarta —nada se pisa, la tabla es append-only— así que “mantener” no es
  // una escritura, es no decidir todavía. Vale para esta vista: al volver a la etapa, el
  // conflicto vuelve a aparecer, que es lo honesto.
  const [mantenida, setMantenida] = useState(false)

  // Navegar ahora es cambiar la URL, no un `setState`: el componente sigue montado entre
  // etapas, así que lo que era de la etapa anterior —el error, la decisión de mantener—
  // se limpia al cambiar de etapa o queda pegado. Se ajusta durante el render, no en un
  // efecto: un efecto pintaría primero la etapa nueva con el estado de la vieja.
  const [etapaPrevia, setEtapaPrevia] = useState<StageKey>(etapaActiva)
  if (etapaPrevia !== etapaActiva) {
    setEtapaPrevia(etapaActiva)
    setError(null)
    setMantenida(false)
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

  const posicion = Math.max(0, STAGE_ORDER.indexOf(etapaActiva))
  const ubicacion = `Landscape · etapa ${posicion + 1} de ${STAGE_ORDER.length}`
  const titulo = stages.find(s => s.key === etapaActiva)?.label ?? STAGE_LABEL[etapaActiva]

  const href = (key: StageKey) => `/admin/projects/${projectId}/landscape?etapa=${key}`
  const anterior = posicion > 0
    ? { label: STAGE_LABEL[STAGE_ORDER[posicion - 1]], href: href(STAGE_ORDER[posicion - 1]) }
    : undefined
  const siguiente = posicion < STAGE_ORDER.length - 1
    ? { label: STAGE_LABEL[STAGE_ORDER[posicion + 1]], href: href(STAGE_ORDER[posicion + 1]) }
    : undefined

  const contenido = contenidoPorEtapa[etapaActiva] ?? null
  const borradorNuevo = contenido?.borradorNuevo ?? null
  const hayLongList = tendencias.length > 0
  // Lo aprobado manda: mientras haya conflicto se ven las dos versiones enteras, sin que
  // ninguna de las dos se pise, hasta que el equipo elija una.
  const enConflicto = !!contenido && !!borradorNuevo && !mantenida

  const rotuloUbicacion = (
    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">{ubicacion}</p>
  )
  const tituloEtapa = (
    <h1 className="mt-2 font-serif text-[30px] font-normal tracking-[-.02em] text-[var(--ink)]">{titulo}</h1>
  )

  return (
    <div className="min-w-0">
      {etapaActiva === 'tendencias' ? (
        hayLongList ? (
          <article>
            {rotuloUbicacion}
            {tituloEtapa}
            <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.66] text-[var(--secundario)]">
              Long list propuesta por Claude desde el archivo del estudio. Elegí entre {MIN_TENDENCIAS} y {MAX_TENDENCIAS};
              cada una se desarrolla después en tres diapositivas.
            </p>

            {/* Acá no hay comparador: la lista de abajo ya es la ampliada, porque elegir sobre
                la vieja no tendría sentido. Lo que cambia es que hay que volver a decidir. */}
            {borradorNuevo && (
              <p className="mt-4 max-w-[60ch] border-l-[1.5px] border-[var(--ink)] pl-3 text-[13px] leading-[1.66] text-[var(--secundario)]">
                Claude amplió la long list después de la selección aprobada. Abajo está la lista completa;
                la selección vigente sigue siendo la anterior hasta que vuelvas a aprobar.
              </p>
            )}

            <div className="mt-8">
              {EJES.map(eje => {
                const delEje = tendencias.filter(t => t.eje === eje)
                if (delEje.length === 0) return null
                return (
                  <div key={eje} className="mb-8">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">Eje · {eje}</p>
                    <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                      {delEje.map(t => (
                        <TendenciaCard key={t.id} t={t} selected={selected.includes(t.id)} onToggle={() => toggle(t.id)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Gate humano: bloquea el avance de la etapa. Era una barra negra flotante y
                ahora es el mismo pie de decisión que cierra cualquier otra etapa. */}
            <footer className="mt-10 flex flex-col gap-4 border-t-[1.5px] border-[var(--ink)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-[var(--secundario)]">
                <span className="font-semibold tabular-nums text-[var(--ink)]">{selected.length}</span> de {MIN_TENDENCIAS}–{MAX_TENDENCIAS} seleccionadas
                <span className="text-[var(--rotulo)]"> · decide el equipo, no el agente</span>
                {tope && <span className="ml-1 text-[var(--ink)]">Llegaste al máximo.</span>}
                {error && <span className="ml-2 text-[#ff9c8a]">{error}</span>}
              </p>
              <button
                type="button"
                disabled={!listo || guardando}
                onClick={aprobarSeleccion}
                className="rounded-[7px] bg-[var(--banana)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {guardando ? 'Guardando…' : tendenciasAprobadas ? 'Actualizar selección' : 'Aprobar y desarrollar'}
              </button>
            </footer>
          </article>
        ) : (
          <article>
            {rotuloUbicacion}
            {tituloEtapa}
            <p className="mt-6 max-w-[60ch] text-[14px] leading-[1.66] text-[var(--secundario)]">
              Todavía no hay long list. Cuando Claude proponga las candidatas desde el archivo del estudio,
              aparecen acá para que el equipo elija entre {MIN_TENDENCIAS} y {MAX_TENDENCIAS}.
            </p>
          </article>
        )
      ) : enConflicto && contenido && borradorNuevo ? (
        <article>
          {rotuloUbicacion}
          {tituloEtapa}
          <div className="mt-8">
            <ComparadorVersiones
              aprobada={{ content: contenido.content, cuando: contenido.cuando }}
              nueva={{ content: borradorNuevo.content, cuando: borradorNuevo.cuando }}
              onMantener={() => setMantenida(true)}
              onAprobarNueva={() => aprobarVersion(etapaActiva, borradorNuevo.id)}
              guardando={guardando}
            />
          </div>
          {error && <p className="mt-3 text-[13px] text-[#ff9c8a]">{error}</p>}
        </article>
      ) : contenido ? (
        <EtapaDocumento
          ubicacion={ubicacion}
          titulo={titulo}
          content={contenido.content}
          procedencia={contenido.procedencia}
          aprobada={contenido.aprobada}
          anterior={anterior}
          siguiente={siguiente}
          onAprobar={() => aprobarVersion(etapaActiva, contenido.id)}
          guardando={guardando}
          error={error}
        />
      ) : (
        <article>
          {rotuloUbicacion}
          {tituloEtapa}
          <p className="mt-6 max-w-[60ch] text-[14px] leading-[1.66] text-[var(--secundario)]">
            Esta etapa todavía no tiene una versión guardada. Cuando el equipo la trabaje en Claude,
            el resultado aparece acá para revisar y aprobar.
          </p>
        </article>
      )}

      <Actividad actividad={actividad} />
    </div>
  )
}
