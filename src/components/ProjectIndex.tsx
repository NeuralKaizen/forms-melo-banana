import Link from 'next/link'
import type { EntradaIndice, FaseIndice } from '@/lib/pipeline/indice'
import { CabeceraProyecto } from './CabeceraProyecto'

/**
 * El punto de estado de cada etapa. `aprobada` y `pendiente` no se pueden distinguir sólo
 * por color: `aprobada` lleva un tilde adentro. `pendiente` y `no_aplica` quedan huecas
 * —por forma, contra el relleno de `aprobada`— pero huecas entre sí también se confunden,
 * así que se separan por el trazo: `pendiente` es sólida y marcada porque es una etapa que
 * todavía falta trabajar; `no_aplica` es punteada y apagada porque no se va a tocar nunca.
 */
function Punto({ estado }: { estado: EntradaIndice['estado'] }) {
  if (estado === 'aprobada') {
    // A 6px el tilde no se lee: sube a 8px, el mínimo que lo hace legible.
    return (
      <svg viewBox="0 0 8 8" className="h-[8px] w-[8px] flex-none" aria-hidden="true">
        <circle cx="4" cy="4" r="4" fill="var(--banana)" />
        <path
          d="M2.3 4.3 L3.5 5.6 L5.7 2.6"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (estado === 'actual') {
    return <span className="h-[6px] w-[6px] flex-none rounded-full bg-white ring-1 ring-white/70" />
  }
  if (estado === 'pendiente') {
    return <span className="h-[6px] w-[6px] flex-none rounded-full border border-[var(--apagado)]" />
  }
  return <span className="h-[6px] w-[6px] flex-none rounded-full border border-dashed border-[#E0DCD0]" />
}

export function ProjectIndex({
  projectId,
  nombre,
  subtitulo,
  fases,
}: {
  projectId: string
  nombre: string
  subtitulo: string
  fases: FaseIndice[]
}) {
  return (
    <nav aria-label="Índice del proyecto" className="flex w-[222px] flex-none flex-col border-r border-[var(--line)]">
      <CabeceraProyecto projectId={projectId} nombre={nombre} subtitulo={subtitulo} />
      {fases.map(fase => (
        <div key={fase.key} className="px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--ink)]">{fase.label}</p>
            <p className="text-[10.5px] tabular-nums text-[var(--apagado)]">{fase.avance}</p>
          </div>
          <ul>
            {fase.entradas.map(entrada => (
              <li key={entrada.key}>
                {entrada.bloque && (
                  <p className="mt-2.5 px-3 text-[8.5px] font-bold uppercase tracking-[.13em] text-[var(--apagado)]">
                    {entrada.bloque}
                  </p>
                )}
                <Link
                  href={entrada.href}
                  aria-current={entrada.estado === 'actual' ? 'page' : undefined}
                  className={
                    entrada.estado === 'actual'
                      ? 'flex items-center gap-2 px-3 py-1.5 bg-[var(--ink)] font-semibold text-white'
                      : 'flex items-center gap-2 px-3 py-1.5 text-[var(--cuerpo)]'
                  }
                >
                  <Punto estado={entrada.estado} />
                  <span className="text-[13px]">{entrada.label}</span>
                  {entrada.espera && (
                    <>
                      {/* Al final del renglón, separado del punto de estado: no dice en qué anda
                          la etapa sino que la pelota la tiene el equipo. */}
                      <span
                        className="ml-auto h-[6px] w-[6px] flex-none rounded-full bg-[var(--banana)]"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Espera al equipo</span>
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {fase.ocultas > 0 && (
            <Link href={fase.hrefTodas} className="mt-1 block px-3 text-[11.5px] text-[var(--apagado)]">
              ＋ {fase.ocultas} etapas más
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
