import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listProjectsWithCounts, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, faseActual, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { attentionItems } from '@/lib/pipeline/attention'
import { Wordmark } from './Brand'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">{children}</p>
}

/**
 * El marco de todas las pantallas autenticadas: barra lateral fija con los proyectos del
 * estudio, contenido a la derecha. Los proyectos viven acá para poder saltar de uno a otro
 * sin volver al listado — con más de una pantalla de proyectos, buscarlos a mano cansa.
 */
export async function AdminShell({ activeProjectId, children }: {
  activeProjectId?: string
  children: React.ReactNode
}) {
  const rows = await listProjectsWithCounts(db)
  // Igual que en el listado de /admin: una lectura de landscapeState y de strategyState
  // por proyecto, porque acá tampoco hay un conteo agregado. La lateral se pinta en cada
  // pantalla, así que ya paga ese costo en cada navegación — aceptable para un puñado de
  // proyectos.
  const landscapeByProject = await Promise.all(rows.map(r => landscapeState(db, r.id)))
  const estrategiaByProject = await Promise.all(rows.map(r => strategyState(db, r.id)))
  const proyectos = rows.map((r, idx) => {
    const señales = projectSignals({
      sessions: Array.from({ length: r.sessionsTotal }, (_, i) => ({
        status: i < r.sessionsCompleted ? 'completed' : 'in_progress',
      })),
      tieneEntregable: r.tieneEntregable,
      landscape: summarizeLandscape(landscapeByProject[idx]),
      estrategia: summarizeStrategy(estrategiaByProject[idx]),
    })
    const fases = deriveFases(r.id, señales)
    const pantallas = derivePantallas(r.id, señales)
    return { ...r, fases, actual: faseActual(fases), pantallaFina: pantallaActual(fases, pantallas), pantallas }
  })

  // Un punto amarillo donde hay algo que el equipo puede destrabar hoy.
  const pendientes = new Set(
    attentionItems(proyectos).filter(i => i.bloqueo === 'equipo').map(i => i.projectId),
  )

  const sidebar = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Link href="/admin" className="block px-3 text-[15px] font-medium leading-tight text-white">
          <Wordmark />
        </Link>

        <nav className="mt-7" aria-label="Secciones del panel">
          <Link
            href="/admin"
            aria-current={activeProjectId ? undefined : 'page'}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] transition-colors duration-200 ${
              activeProjectId ? 'text-white/55 hover:bg-white/5 hover:text-white/85' : 'bg-white/10 font-medium text-white'
            }`}
          >
            <span className={activeProjectId ? 'text-white/40' : 'text-[var(--banana)]'} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="7" height="7" rx="1.5" />
                <rect x="14" y="4" width="7" height="7" rx="1.5" />
                <rect x="3" y="15" width="7" height="5" rx="1.5" />
                <rect x="14" y="15" width="7" height="5" rx="1.5" />
              </svg>
            </span>
            Todos los proyectos
          </Link>
        </nav>

        {proyectos.length > 0 && (
          <div className="mt-7">
            <SectionLabel>Proyectos ({proyectos.length})</SectionLabel>
            <ul className="space-y-0.5">
              {proyectos.map(p => {
                const activo = p.id === activeProjectId
                return (
                  <li key={p.id}>
                    <Link
                      href={`/admin/projects/${p.id}`}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors duration-200 ${
                        activo ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <span
                        title={pendientes.has(p.id) ? 'Tiene algo esperando al equipo' : undefined}
                        className={`h-1.5 w-1.5 flex-none rounded-full ${pendientes.has(p.id) ? 'bg-[var(--banana)]' : 'bg-white/20'}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13.5px] leading-tight ${activo ? 'font-medium text-white' : 'text-white/60'}`}>
                          {p.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-white/30">{p.pantallaFina.label}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <p className="flex-none px-3 pt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
        Panel interno
      </p>
    </>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col bg-[var(--ink)] px-4 py-6 md:flex">
        {sidebar}
      </aside>

      <div className="min-w-0 flex-1">
        {/* En móvil la lateral no entra: queda la barra oscura y se navega desde el listado. */}
        <header className="flex items-center justify-between bg-[var(--ink)] px-6 py-4 md:hidden">
          <Link href="/admin" className="text-[15px] font-medium text-white"><Wordmark /></Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Panel interno</span>
        </header>

        <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  )
}
