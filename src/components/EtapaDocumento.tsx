'use client'

import { ContenidoEtapa } from '../app/admin/projects/[id]/landscape/ContenidoEtapa'
import { CabeceraEtapa, PieDeDecision, NotaDependencia, Vecinas, type Vecina } from './EtapaPartes'

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
  /** Lo que la fase necesita de otra y todavía no llegó. Va bajo el título, no al pie. */
  dependencia?: string
  anterior?: Vecina
  siguiente?: Vecina
  onAprobar: () => void
  guardando?: boolean
  error?: string | null
}) {
  const { ubicacion, titulo, content, procedencia, aprobada, dependencia, anterior, siguiente, onAprobar, guardando, error } = props

  return (
    <article>
      <CabeceraEtapa ubicacion={ubicacion} titulo={titulo} />
      {dependencia && <NotaDependencia texto={dependencia} />}

      <div className="mt-8">
        <ContenidoEtapa content={content} />
      </div>

      <PieDeDecision>
        <p className="text-[13px] text-[var(--secundario)]">
          {procedencia}
          {error && <span className="ml-2 text-[var(--error)]">{error}</span>}
        </p>

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
      </PieDeDecision>

      <Vecinas anterior={anterior} siguiente={siguiente} />
    </article>
  )
}
