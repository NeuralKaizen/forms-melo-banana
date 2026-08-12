import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listProjectsWithCounts, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, faseActual, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { attentionItems } from '@/lib/pipeline/attention'
import { Wordmark } from './Brand'
import { AvatarProyecto, BarraProyectos, PanelIndiceMovil, type ProyectoBarra } from './BarraProyectos'
import { estadoBarra, iniciales } from './barra'

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[rgba(21,18,12,.45)]">
      {children}
    </p>
  )
}

/**
 * El marco de todas las pantallas autenticadas. La barra amarilla tiene dos estados que
 * salen de la ruta, no de una preferencia guardada: **ancha** en `/admin`, donde todavía no
 * elegiste proyecto y la barra muestra la cola del equipo; **riel** adentro de un proyecto,
 * donde el espacio es para el índice y el trabajo. El tercer estado —abierta encima— es
 * efímero y vive dentro de `BarraProyectos`.
 *
 * El índice llega armado por la prop `indice`: las páginas de proyecto ya consultaron sus
 * etapas, así que el shell no vuelve a la base por eso.
 */
export async function AdminShell({ activeProjectId, indice, children }: {
  activeProjectId?: string
  indice?: React.ReactNode
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

  // La cola del equipo: lo que se puede destrabar hoy sin depender de nadie de afuera.
  const cola = attentionItems(proyectos).filter(i => i.bloqueo === 'equipo')
  const esperan = new Set(cola.map(i => i.projectId))

  const barraAncha = (
    <aside
      aria-label="Panel"
      className="sticky top-0 hidden h-screen w-[230px] flex-none flex-col bg-[var(--banana)] px-4 py-6 md:flex"
    >
      <Link href="/admin" className="px-1 font-serif text-[17px] leading-tight text-[var(--ink)]">
        <Wordmark />
      </Link>

      <nav className="mt-8" aria-label="Secciones del panel">
        <Rotulo>Panel</Rotulo>
        {/* Una sola sección real: hoy el panel no tiene más rutas que ésta, y un enlace
            muerto es peor que un menú corto. */}
        <Link
          href="/admin"
          aria-current="page"
          className="flex items-center justify-between rounded-[10px] bg-[var(--ink)] px-3 py-2 text-[13px] font-medium text-white"
        >
          Proyectos
          <span className="tabular-nums text-white/50">{proyectos.length}</span>
        </Link>
      </nav>

      {cola.length > 0 && (
        <div className="mt-8">
          <Rotulo>Nos toca</Rotulo>
          <div className="rounded-[10px] bg-[rgba(21,18,12,.07)] px-3 py-3">
            <p className="text-[13px] font-bold text-[var(--ink)]">
              {cola.length} {cola.length === 1 ? 'decisión' : 'decisiones'}
            </p>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {cola.slice(0, 3).map(item => (
                <li key={`${item.projectId}-${item.fase}`}>
                  <Link href={item.href} className="flex items-center gap-2.5">
                    <AvatarProyecto iniciales={iniciales(item.projectName)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-[14px] text-[var(--ink)]">
                        {item.projectName}
                      </span>
                      <span className="block text-[11px] leading-tight text-[rgba(21,18,12,.55)]">
                        {item.accion}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="mt-auto px-1 pt-5 text-[10px] font-bold uppercase tracking-[.14em] text-[rgba(21,18,12,.45)]">
        Panel interno
      </p>
    </aside>
  )

  const paraLaBarra: ProyectoBarra[] = proyectos.map(p => {
    const { label, detalle } = p.pantallaFina
    return {
      id: p.id,
      name: p.name,
      iniciales: iniciales(p.name),
      // El avance en números sí entra en un renglón de 230px; la explicación en prosa no,
      // y además ya está en el índice del proyecto.
      faseActual: /^\d/.test(detalle) ? `${label} · ${detalle}` : label,
      espera: esperan.has(p.id),
    }
  })

  return (
    // `relative` es lo que ancla la barra abierta encima y su velo: flotan sobre todo el
    // marco sin desplazar ni un píxel del contenido.
    <div className="relative flex min-h-screen">
      {estadoBarra(activeProjectId) === 'ancha' ? (
        barraAncha
      ) : (
        <>
          <BarraProyectos proyectos={paraLaBarra} activeProjectId={activeProjectId!} />
          {indice && (
            <div className="hidden flex-none md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto">
              {indice}
            </div>
          )}
        </>
      )}

      <div className="min-w-0 flex-1">
        {/* En móvil no entran ni la barra ni el índice: queda la cabecera oscura, y el
            índice se abre como panel desde la izquierda. */}
        <header className="flex items-center justify-between bg-[var(--ink)] px-6 py-4 md:hidden">
          <Link href="/admin" className="text-[15px] font-medium text-white"><Wordmark /></Link>
          {indice
            ? <PanelIndiceMovil>{indice}</PanelIndiceMovil>
            : <span className="text-[10px] font-bold uppercase tracking-[.14em] text-white/40">Panel interno</span>}
        </header>

        <main className="w-full px-6 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  )
}
