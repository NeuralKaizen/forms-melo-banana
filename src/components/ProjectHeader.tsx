import Link from 'next/link'
import { neighbours, type Phase, type PhaseKey, type PhaseStatus } from '@/lib/pipeline/phases'

function Dot({ status }: { status: PhaseStatus }) {
  if (status === 'completa') return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--banana)]">
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#1a1510" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
  if (status === 'en_curso') return <span className="h-4 w-4 rounded-full border-[3px] border-[var(--banana)] bg-white" />
  if (status === 'espera') return <span className="h-4 w-4 rounded-full border-2 border-dashed border-[#c9a227] bg-white" />
  return <span className="h-4 w-4 rounded-full border border-black/15 bg-white" />
}

function PhaseCell({ phase, active }: { phase: Phase; active: boolean }) {
  const inner = (
    <>
      <span className="flex items-center gap-2">
        <Dot status={phase.status} />
        <span aria-hidden="true" className="hidden h-px flex-1 bg-black/10 last:hidden md:block" />
      </span>
      <span className={`mt-2.5 block text-[13px] leading-tight ${active ? 'font-semibold text-ink' : 'text-[#6b6155]'}`}>
        {phase.label}
      </span>
      <span className="mt-1 block text-[11.5px] leading-snug text-[#a59c89]">{phase.detalle}</span>
    </>
  )

  return (
    <li className="min-w-0">
      <Link
        href={phase.href}
        aria-current={active ? 'step' : undefined}
        className={`block rounded-xl px-3 py-3 transition-colors duration-200 ${active ? 'bg-[#fffdf0]' : 'hover:bg-[#faf7ee]'}`}
      >
        {inner}
      </Link>
    </li>
  )
}

/** Un paso atrás o adelante en el recorrido, sin volver al listado de proyectos. */
function StepLink({ phase, dir }: { phase: Phase | null; dir: 'prev' | 'next' }) {
  const chevron = (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  )

  if (!phase) {
    return <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#ded6c4]">{chevron}</span>
  }

  return (
    <Link
      href={phase.href}
      title={phase.label}
      aria-label={`${dir === 'prev' ? 'Fase anterior' : 'Fase siguiente'}: ${phase.label}`}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#8a8170] transition-colors duration-200 hover:bg-[#faf7ee] hover:text-ink"
    >
      {chevron}
    </Link>
  )
}

/**
 * Cabecera común de las pantallas de un proyecto: quién es y en qué fase está.
 * Hace visible el pipeline completo — entrevistas, propuesta, taller, landscape, entrega —
 * para que cada pantalla se lea como un tramo del mismo recorrido y no como una sección suelta.
 */
export function ProjectHeader({ name, phases, active }: {
  name: string
  phases: Phase[]
  active: PhaseKey
}) {
  const dependencia = phases.find(p => p.key === active)?.dependencia
  const { prev, next } = neighbours(phases, active)

  return (
    <header className="space-y-5">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e] transition-colors duration-200 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Proyectos
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">{name}</h1>
      </div>

      <nav aria-label="Fases del proyecto" className="flex items-center gap-1 rounded-2xl border border-black/5 bg-white p-2 shadow-sm">
        <StepLink phase={prev} dir="prev" />
        <ol className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-5">
          {phases.map(p => <PhaseCell key={p.key} phase={p} active={p.key === active} />)}
        </ol>
        <StepLink phase={next} dir="next" />
      </nav>

      {dependencia && (
        <p className="flex items-start gap-2 rounded-xl border border-[#f0e3bc] bg-[#fffdf0] px-4 py-3 text-[13px] leading-relaxed text-[#6b5a2a]">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-0.5 flex-none">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" />
          </svg>
          {dependencia}
        </p>
      )}
    </header>
  )
}
