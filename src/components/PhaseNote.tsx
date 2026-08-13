import type { PhaseStatus } from '@/lib/pipeline/phases'

const TONO: Record<PhaseStatus, { chip: string; punto: string; texto: string }> = {
  completa: { chip: 'bg-[var(--aprobado)] text-[#8a6d10]', punto: 'bg-[var(--banana)]', texto: 'Completa' },
  en_curso: { chip: 'bg-[var(--aprobado)] text-[#8a6d10]', punto: 'bg-[var(--banana)]', texto: 'En curso' },
  espera: { chip: 'bg-[#f7f3e6] text-[#8a6d10]', punto: 'bg-[#c9a227]', texto: 'En espera' },
  pendiente: { chip: 'bg-[#f4f1e8] text-[var(--secundario)]', punto: 'bg-[#c9c0ac]', texto: 'Pendiente' },
}

/**
 * La pantalla de una fase que todavía no tiene herramienta propia: dice en qué estado
 * está, dónde se trabaja mientras tanto y qué va a vivir acá. El recorrido se puede
 * caminar entero aunque no todas las fases hagan algo todavía.
 */
export function PhaseNote({ titulo, estado, bajada, children }: {
  titulo: string
  estado: PhaseStatus
  bajada: string
  children?: React.ReactNode
}) {
  const t = TONO[estado]
  return (
    <section>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] pb-5">
        <h2 className="font-serif text-xl font-medium text-ink">{titulo}</h2>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${t.punto}`} aria-hidden="true" />
          {t.texto}
        </span>
      </div>
      <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-[var(--secundario)]">{bajada}</p>
      {children}
    </section>
  )
}
