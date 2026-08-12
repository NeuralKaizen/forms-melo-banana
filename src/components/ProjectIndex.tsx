import Link from 'next/link'
import type { EntradaIndice, FaseIndice } from '@/lib/pipeline/indice'

const PUNTO: Record<EntradaIndice['estado'], string> = {
  aprobada: 'bg-[var(--banana)]',
  actual: 'bg-white ring-1 ring-white/70',
  pendiente: 'bg-[#E0DCD0]',
  no_aplica: 'bg-transparent ring-1 ring-[#E0DCD0]',
}

export function ProjectIndex({
  nombre,
  subtitulo,
  fases,
}: {
  nombre: string
  subtitulo: string
  fases: FaseIndice[]
}) {
  return (
    <nav aria-label="Índice del proyecto" className="flex w-[222px] flex-none flex-col border-r border-[var(--line)]">
      <div className="border-b border-[var(--line)] px-3 py-3">
        <p className="font-serif text-[16px] font-medium text-[var(--ink)]">{nombre}</p>
        <p className="text-[11.5px] text-[var(--rotulo)]">{subtitulo}</p>
      </div>
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
                  <span className={`h-[6px] w-[6px] flex-none rounded-full ${PUNTO[entrada.estado]}`} />
                  <span className="text-[13px]">{entrada.label}</span>
                  {entrada.espera && <span className="sr-only">Espera al equipo</span>}
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
