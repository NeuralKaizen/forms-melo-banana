'use client'

import Link from 'next/link'

/**
 * Las piezas sueltas del área de trabajo: las mismas que usa `EtapaDocumento` cuando hay
 * documento, y que las otras pantallas de una etapa —el gate de tendencias, el vacío, el
 * conflicto de versiones— necesitan igual. Están acá para que el estilo sea uno solo; el
 * comportamiento no se comparte, cada pantalla arma el suyo adentro.
 */

/** Rótulo de ubicación en versalitas y título de la etapa en Fraunces. */
export function CabeceraEtapa({ ubicacion, titulo }: { ubicacion: string; titulo: string }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">{ubicacion}</p>
      <h1 className="mt-2 font-serif text-[30px] font-normal tracking-[-.02em] text-[var(--ink)]">{titulo}</h1>
    </>
  )
}

/**
 * El pie donde vive la decisión, con el hairline más pesado de la página. Es sólo el
 * marco: qué se decide y con qué botones lo pone cada pantalla — el gate de tendencias
 * cuenta seleccionadas, el documento muestra procedencia y aprueba.
 */
export function PieDeDecision({ children }: { children: React.ReactNode }) {
  return (
    <footer className="mt-10 flex flex-col gap-4 border-t-[1.5px] border-[var(--ink)] pt-5 sm:flex-row sm:items-center sm:justify-between">
      {children}
    </footer>
  )
}

export type Vecina = { label: string; href: string } | undefined

/**
 * Anterior y siguiente. Avanzar de a una etapa es el gesto más frecuente, así que existe
 * en las cuatro pantallas de una etapa y no sólo cuando hay documento.
 */
export function Vecinas({ anterior, siguiente }: { anterior: Vecina; siguiente: Vecina }) {
  if (!anterior && !siguiente) return null
  const estilo = 'rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--secundario)] transition-colors duration-200 hover:border-[var(--ink)] hover:text-[var(--ink)] motion-reduce:transition-none'
  return (
    <nav aria-label="Etapas vecinas" className="mt-6 flex items-center justify-between">
      {anterior
        ? <Link href={anterior.href} className={estilo}><span aria-hidden="true">‹</span> {anterior.label}</Link>
        : <span />}
      {siguiente
        ? <Link href={siguiente.href} className={estilo}>{siguiente.label} <span aria-hidden="true">›</span></Link>
        : <span />}
    </nav>
  )
}

/**
 * Lo que esta fase necesita de otra y todavía no llegó. Es la única pieza del panel que
 * explica *por qué* algo está trabado, así que va arriba del documento y no en el índice:
 * el índice navega, no explica.
 */
export function NotaDependencia({ texto }: { texto: string }) {
  return (
    <p className="mt-6 max-w-[60ch] border-l-[1.5px] border-[var(--ink)] pl-3 text-[13px] leading-[1.66] text-[var(--secundario)]">
      {texto}
    </p>
  )
}

/**
 * El camino de vuelta al comparador. Mirar sólo la aprobada es una acción de vista, no una
 * decisión: mientras el borrador siga sin resolverse tiene que estar a un clic — y el
 * índice, que sigue marcando la etapa como “espera al equipo”, dice lo mismo.
 */
export function AvisoVersionNueva({ autor, cuando, onVer }: { autor: string; cuando: string; onVer: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--line)] py-3">
      <p className="text-[13px] text-[var(--secundario)]">
        {autor} escribió una versión nueva {cuando}, sin aprobar.
      </p>
      <button
        type="button"
        onClick={onVer}
        className="rounded-[7px] border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--cuerpo)] transition-colors duration-200 hover:border-[var(--ink)] motion-reduce:transition-none"
      >
        Ver la versión nueva
      </button>
    </div>
  )
}
