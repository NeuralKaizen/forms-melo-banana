'use client'

import Link from 'next/link'
import { ContenidoEtapa } from '../app/admin/projects/[id]/landscape/ContenidoEtapa'

/**
 * El documento de una etapa: lo que Claude escribió, para leer y decidir — no un formulario
 * para completar. La ubicación y el título arriba lo enmarcan como texto; el pie, con un
 * hairline más pesado que el resto de la página, es donde vive la decisión: quién lo escribió,
 * cuándo, y si ya está aprobado. Cuando ya está aprobado no hay nada que decidir, así que el
 * botón desaparece en vez de quedar ahí sin función.
 */
export function EtapaDocumento(props: {
  ubicacion: string
  titulo: string
  content: unknown
  procedencia: string
  aprobada: boolean
  anterior?: { label: string; href: string }
  siguiente?: { label: string; href: string }
  onAprobar: () => void
  onPedirOtra?: () => void
  guardando?: boolean
  error?: string | null
}) {
  const { ubicacion, titulo, content, procedencia, aprobada, anterior, siguiente, onAprobar, onPedirOtra, guardando, error } = props

  return (
    <article>
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">{ubicacion}</p>
      <h1 className="mt-2 font-serif text-[30px] font-normal tracking-[-.02em] text-[var(--ink)]">{titulo}</h1>

      <div className="mt-8">
        <ContenidoEtapa content={content} />
      </div>

      <footer className="mt-10 flex flex-col gap-4 border-t-[1.5px] border-[var(--ink)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] text-[var(--secundario)]">
            {procedencia}
            {error && <span className="ml-2 text-[#ff9c8a]">{error}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onPedirOtra && (
            <button
              type="button"
              onClick={onPedirOtra}
              disabled={guardando}
              className="rounded-[7px] border border-[var(--line)] px-4 py-2 text-[13px] text-[var(--cuerpo)] transition-colors duration-200 hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              Pedir otra versión
            </button>
          )}

          {!aprobada && (
            <button
              type="button"
              onClick={onAprobar}
              disabled={guardando}
              className="rounded-[7px] bg-[var(--banana)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {guardando ? 'Guardando…' : 'Aprobar etapa'}
            </button>
          )}
        </div>
      </footer>

      {(anterior || siguiente) && (
        <nav aria-label="Etapas vecinas" className="mt-6 flex items-center justify-between">
          {anterior
            ? (
              <Link
                href={anterior.href}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--secundario)] transition-colors duration-200 hover:border-[var(--ink)] hover:text-[var(--ink)] motion-reduce:transition-none"
              >
                <span aria-hidden="true">‹</span> {anterior.label}
              </Link>
              )
            : <span />}

          {siguiente
            ? (
              <Link
                href={siguiente.href}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--secundario)] transition-colors duration-200 hover:border-[var(--ink)] hover:text-[var(--ink)] motion-reduce:transition-none"
              >
                {siguiente.label} <span aria-hidden="true">›</span>
              </Link>
              )
            : <span />}
        </nav>
      )}
    </article>
  )
}
