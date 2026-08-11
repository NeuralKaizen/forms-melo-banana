import Link from 'next/link'
import { grupoDePantalla, type Grupo, type PantallaKey, type PhaseStatus } from '@/lib/pipeline/phases'

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

/**
 * Cabecera común de las pantallas de un proyecto: quién es y en qué grupo del recorrido
 * está. Los tres grupos —entrevistas/propuesta de valor, landscape, estrategia— se ven
 * siempre; el primero abre tabs para sus tres pantallas cuando es el grupo activo.
 */
export function ProjectHeader({ name, grupos, active }: {
  name: string
  grupos: Grupo[]
  active: PantallaKey
}) {
  const grupoActivoKey = grupoDePantalla(active)
  const esActivo = (g: Grupo) => g.key === grupoActivoKey
  const dependencia = grupos.find(esActivo)?.dependencia

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

      <nav aria-label="Recorrido del proyecto">
        <ol className="grid gap-2 sm:grid-cols-3">
          {grupos.map(g => {
            const activo = esActivo(g)
            return (
              <li key={g.key}>
                <Link
                  href={g.href}
                  aria-current={activo ? 'step' : undefined}
                  className={`block rounded-2xl border p-3 transition-colors duration-200 ${
                    activo ? 'border-[var(--banana)] bg-[#fffdf0]' : 'border-black/5 bg-white hover:border-black/15'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Dot status={g.status} />
                    <span className={`text-[13px] leading-tight ${activo ? 'font-semibold text-ink' : 'text-[#6b6155]'}`}>
                      {g.label}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11.5px] leading-snug text-[#a59c89]">{g.detalle}</span>
                </Link>

                {activo && g.tabs && (
                  <div role="tablist" className="mt-1.5 flex gap-1 px-1">
                    {g.tabs.map(t => (
                      <Link
                        key={t.key}
                        href={t.href}
                        role="tab"
                        aria-selected={t.key === active}
                        className={`rounded-lg px-2.5 py-1 text-[12.5px] transition-colors duration-200 ${
                          t.key === active
                            ? 'bg-[#fffdf0] font-semibold text-ink shadow-[inset_0_-2px_0_0_var(--banana)]'
                            : 'text-[#6b6155] hover:bg-[#faf7ee]'
                        }`}
                      >
                        {t.label}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
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
