'use client'

import { ContenidoEtapa } from '../app/admin/projects/[id]/landscape/ContenidoEtapa'

/**
 * La pantalla del conflicto: alguien escribió sobre una etapa que el equipo ya había
 * aprobado. Casi siempre es Claude por MCP, pero no necesariamente —el modelo guarda
 * `author`— así que la versión nueva se firma con quien la escribió en vez de darlo por
 * sentado. No es un merge: es una decisión entre dos versiones completas, una al lado de
 * la otra, cada una con su propio botón. La franja de arriba deja claro que lo aprobado no
 * se pisó solo: sigue vigente hasta que alguien elija.
 *
 * “Ver sólo la aprobada” no decide nada — cambia lo que estás mirando, y se vuelve. La
 * decisión que existe hoy es una sola: aprobar la nueva.
 */
export function ComparadorVersiones(props: {
  aprobada: { content: unknown; cuando: string }
  nueva: { content: unknown; cuando: string; autor: string }
  onVerSoloAprobada: () => void
  onAprobarNueva: () => void
  guardando?: boolean
}) {
  const { aprobada, nueva, onVerSoloAprobada, onAprobarNueva, guardando } = props

  return (
    <section>
      <div className="rounded-t-[9px] bg-[var(--ink)] px-4 py-3 text-[13px] text-white">
        {nueva.autor} escribió una versión nueva después de la aprobación. Lo aprobado sigue vigente hasta que decidas.
      </div>

      <div className="grid grid-cols-1 divide-y divide-[var(--line)] rounded-b-[9px] border border-t-0 border-[var(--line)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div>
          <header className="bg-[var(--superficie)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">
              Vigente · aprobada · {aprobada.cuando}
            </p>
          </header>
          <div className="px-4 py-5">
            <ContenidoEtapa content={aprobada.content} />
          </div>
          <div className="border-t border-[var(--line)] px-4 py-4">
            <button
              type="button"
              onClick={onVerSoloAprobada}
              disabled={guardando}
              className="rounded-[7px] border border-[var(--line)] px-4 py-2 text-[13px] text-[var(--cuerpo)] transition-colors duration-200 hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              Ver sólo la aprobada
            </button>
          </div>
        </div>

        <div>
          <header className="bg-[var(--banana)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink)]">
              Nueva · {nueva.autor} · {nueva.cuando}
            </p>
          </header>
          <div className="px-4 py-5">
            <ContenidoEtapa content={nueva.content} />
          </div>
          <div className="border-t border-[var(--line)] px-4 py-4">
            <button
              type="button"
              onClick={onAprobarNueva}
              disabled={guardando}
              className="rounded-[7px] bg-[var(--banana)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              Aprobar la nueva
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
