'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/** Un proyecto tal como lo muestra la barra: ya resuelto por el servidor, sin consultas acá. */
export interface ProyectoBarra {
  id: string
  name: string
  /** “CL” — de las dos primeras palabras del nombre. */
  iniciales: string
  /** “Estrategia · 6 de 14”. */
  faseActual: string
  /** Hay algo que el equipo puede destrabar hoy en este proyecto. */
  espera: boolean
}

/**
 * Escape cierra lo que está abierto encima del contenido. Lo usan la barra abierta y el
 * panel de índice en móvil: son el mismo gesto, así que es un solo efecto.
 */
export function useCerrarConEscape(cerrar: () => void, activo: boolean) {
  useEffect(() => {
    if (!activo) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [cerrar, activo])
}

/**
 * El cuadrado de iniciales. Es el mismo dibujo en el riel, en la barra abierta y en la cola
 * del estado ancho: es lo que hace que recoger la barra no se lea como un salto arbitrario.
 * Se exporta —aunque no tenga interacción— para que el estado ancho, que lo rinde desde el
 * servidor, use exactamente este y no una copia que se despegue con el tiempo.
 */
export function AvatarProyecto({ iniciales, activo, espera }: { iniciales: string; activo?: boolean; espera?: boolean }) {
  return (
    <span
      className={`relative grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] font-serif text-[13px] transition-colors duration-200 motion-reduce:transition-none ${
        activo ? 'bg-[var(--ink)] text-white' : 'bg-[rgba(21,18,12,.1)] text-[var(--ink)]'
      }`}
    >
      {iniciales}
      {espera && (
        <span
          aria-hidden="true"
          className="absolute -right-[3px] -top-[3px] h-[9px] w-[9px] rounded-full bg-[var(--ink)] ring-2 ring-[var(--banana)]"
        />
      )}
    </span>
  )
}

/**
 * La barra amarilla cuando hay un proyecto abierto: riel de 58px con un avatar por
 * proyecto, y la misma barra abierta **encima** del contenido —flotando, con velo— cuando
 * el mouse entra al riel o se toca el control `»`. Nada del contenido de la derecha se
 * desplaza: la capa abierta es absoluta.
 *
 * El hover abre mientras el mouse está encima; el botón fija. Son dos estados separados a
 * propósito: un clic no puede cerrar lo que el hover abrió medio segundo antes.
 */
export function BarraProyectos({ proyectos, activeProjectId }: {
  proyectos: ProyectoBarra[]
  activeProjectId: string
}) {
  // Dos maneras de estar abierta, y hay que distinguirlas: el hover es efímero —entra el
  // mouse, se abre; sale, se recoge— y el botón *fija*. Si fueran un solo estado, el clic
  // del mouse cerraría la barra que el hover acababa de abrir, porque el botón vive adentro
  // del riel y el hover siempre llega primero.
  const [porHover, setPorHover] = useState(false)
  const [fijada, setFijada] = useState(false)
  const abierta = porHover || fijada
  // El foco entra al primer proyecto sólo cuando la barra se abrió a propósito (teclado o
  // clic). Con el mouse por encima, robar el foco sería un manotazo.
  const [conFoco, setConFoco] = useState(false)
  const primero = useRef<HTMLAnchorElement>(null)

  const cerrar = useCallback(() => {
    setPorHover(false)
    setFijada(false)
  }, [])
  useCerrarConEscape(cerrar, abierta)

  useEffect(() => {
    if (abierta && conFoco) primero.current?.focus()
  }, [abierta, conFoco])

  return (
    <>
      <aside
        aria-label="Proyectos del estudio"
        onMouseEnter={() => {
          setConFoco(false)
          setPorHover(true)
        }}
        className="sticky top-0 z-30 hidden h-screen w-[58px] flex-none flex-col items-center gap-2 bg-[var(--banana)] py-4 md:flex"
      >
        <Link
          href="/admin"
          aria-label="Todos los proyectos"
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-[var(--ink)] font-serif text-[11px] leading-none text-[var(--banana)]"
        >
          M&amp;B
        </Link>

        <ul className="mt-3 flex flex-col items-center gap-2">
          {proyectos.map(p => (
            <li key={p.id}>
              <Link
                href={`/admin/projects/${p.id}`}
                aria-current={p.id === activeProjectId ? 'page' : undefined}
                className="block"
              >
                <AvatarProyecto iniciales={p.iniciales} activo={p.id === activeProjectId} espera={p.espera} />
                {p.espera && <span className="sr-only">Tiene algo esperando</span>}
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          aria-expanded={abierta}
          aria-label="Ver los nombres de los proyectos"
          // Fija y suelta; nunca cierra lo que el hover abrió. Con el mouse encima, soltar
          // la fijación deja la barra abierta hasta que el mouse se vaya, que es lo que el
          // usuario está viendo.
          onClick={() => {
            setConFoco(true)
            setFijada(f => !f)
          }}
          className="mt-auto grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] text-[15px] leading-none text-[var(--ink)] transition-colors duration-200 hover:bg-[rgba(21,18,12,.1)] motion-reduce:transition-none"
        >
          <span aria-hidden="true">»</span>
        </button>
      </aside>

      {abierta && (
        <>
          <div
            aria-hidden="true"
            onClick={cerrar}
            className="absolute inset-0 z-30 hidden bg-[rgba(21,18,12,.14)] md:block"
          />
          <div
            // Salir con el mouse recoge lo que el mouse abrió; si el usuario la fijó con el
            // botón, se queda hasta que él la suelte, la cierre con Escape o toque el velo.
            onMouseLeave={() => setPorHover(false)}
            className="absolute inset-y-0 left-0 z-40 hidden w-[230px] flex-col bg-[var(--banana)] px-3 py-4 shadow-[14px_0_34px_rgba(0,0,0,.22)] md:flex"
          >
            {/* El espejo del cuadrado M&B del riel. Sin este renglón, la capa abierta
                tapa el único camino de vuelta a /admin: el hover que la abre es el mismo
                gesto que intenta llegar al cuadrado. */}
            <Link
              href="/admin"
              onClick={cerrar}
              className="flex items-center gap-2.5 rounded-[9px] px-1.5 py-1.5 transition-colors duration-200 hover:bg-[rgba(21,18,12,.07)] motion-reduce:transition-none"
            >
              <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-[var(--ink)] font-serif text-[11px] leading-none text-[var(--banana)]">
                M&amp;B
              </span>
              <span className="font-serif text-[14px] text-[var(--ink)]">Todos los proyectos</span>
            </Link>

            <p className="mt-3 px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[rgba(21,18,12,.45)]">
              Proyectos
            </p>
            <ul className="flex flex-col gap-0.5">
              {proyectos.map((p, idx) => {
                const activo = p.id === activeProjectId
                return (
                  <li key={p.id}>
                    <Link
                      ref={idx === 0 ? primero : undefined}
                      href={`/admin/projects/${p.id}`}
                      aria-current={activo ? 'page' : undefined}
                      onClick={cerrar}
                      className={`flex items-center gap-2.5 rounded-[9px] px-1.5 py-1.5 transition-colors duration-200 motion-reduce:transition-none ${
                        activo ? 'bg-[rgba(21,18,12,.12)]' : 'hover:bg-[rgba(21,18,12,.07)]'
                      }`}
                    >
                      <AvatarProyecto iniciales={p.iniciales} activo={activo} espera={p.espera} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-serif text-[14px] text-[var(--ink)]">{p.name}</span>
                        <span className="block truncate text-[10.5px] text-[rgba(21,18,12,.5)]">{p.faseActual}</span>
                      </span>
                      {p.espera && <span className="sr-only">Tiene algo esperando</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </>
  )
}

/**
 * En móvil no entran ni la barra ni el índice: el índice del proyecto se abre como panel
 * desde la izquierda, encima del contenido, desde la cabecera oscura.
 */
export function PanelIndiceMovil({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const cerrar = useCallback(() => setAbierto(false), [])
  useCerrarConEscape(cerrar, abierto)

  return (
    <>
      <button
        type="button"
        aria-expanded={abierto}
        aria-label="Abrir el índice del proyecto"
        onClick={() => setAbierto(a => !a)}
        className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--banana)]"
      >
        Índice
      </button>

      {abierto && (
        <>
          <div aria-hidden="true" onClick={cerrar} className="fixed inset-0 z-40 bg-[rgba(21,18,12,.14)]" />
          <div className="fixed inset-y-0 left-0 z-50 w-[260px] overflow-y-auto bg-white shadow-2xl">{children}</div>
        </>
      )}
    </>
  )
}
