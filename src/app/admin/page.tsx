import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listProjectsWithCounts, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, faseActual, derivePantallas, pantallaActual, type Fase } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { attentionItems, haceCuanto, mostrarSeccionEsperando, type AttentionItem } from '@/lib/pipeline/attention'
import { AdminShell } from '@/components/AdminShell'

export const dynamic = 'force-dynamic'

/**
 * El recorrido del proyecto de un vistazo, sin abrirlo: tres tramos.
 * Amarillo lo aprobado, gris lleno donde está parado, hueco lo que falta.
 */
function FaseTrack({ fases, activeKey }: { fases: Fase[]; activeKey: string }) {
  return (
    <span className="flex w-24 items-center gap-1" aria-hidden="true">
      {fases.map(g => (
        <span
          key={g.key}
          className={`h-1.5 flex-1 rounded-full ${
            g.status === 'completa' ? 'bg-[var(--banana)]'
              : g.key === activeKey ? 'bg-[var(--apagado)]'
              : 'bg-[var(--line)]'
          }`}
        />
      ))}
    </span>
  )
}

/** El chip binario: quién destraba lo que sigue en este proyecto. Sin item, no hay nada esperando. */
function ChipEstado({ item }: { item?: AttentionItem }) {
  if (!item) return null
  const delEquipo = item.bloqueo === 'equipo'
  return (
    <span
      className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-medium ${
        delEquipo ? 'bg-[var(--banana)] text-ink' : 'bg-[var(--line)] text-[var(--secundario)]'
      }`}
    >
      {delEquipo ? 'Nos toca' : 'Esperando'}
    </span>
  )
}

/** Una cosa esperando: qué proyecto, qué falta, y quién la destraba. */
function AttentionRow({ item }: { item: AttentionItem }) {
  const delEquipo = item.bloqueo === 'equipo'
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-[var(--superficie)]"
      >
        <span
          className={`h-1.5 w-1.5 flex-none rounded-full ${delEquipo ? 'bg-[var(--banana)]' : 'bg-[var(--apagado)]'}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-snug text-ink">
            <strong className="font-medium">{item.projectName}</strong>
            <span className="text-[var(--apagado)]"> · </span>
            <span className="text-[var(--secundario)]">{item.accion}</span>
          </span>
        </span>
        <span className="flex-none text-[11px] text-[var(--rotulo)]">
          {delEquipo ? 'Nos toca' : 'Esperando'}
        </span>
      </Link>
    </li>
  )
}

export default async function Admin() {
  const rows = await listProjectsWithCounts(db)
  // Una lectura de landscapeState y de strategyState por proyecto: la lista no tiene un
  // conteo agregado (no hay tabla que lo dé de un solo select). Con la cantidad de
  // proyectos de un estudio interno, N+1 no pesa.
  const landscapeByProject = await Promise.all(rows.map(r => landscapeState(db, r.id)))
  const estrategiaByProject = await Promise.all(rows.map(r => strategyState(db, r.id)))
  const projects = rows.map((r, idx) => {
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

  const pendientes = attentionItems(projects)
  const nosToca = pendientes.filter(i => i.bloqueo === 'equipo').length
  const porProyecto = new Map(pendientes.map(i => [i.projectId, i]))
  const ahora = new Date()

  return (
    <AdminShell>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl font-medium leading-tight text-ink">
          <span className="underline-banana">Proyectos</span>
        </h1>
        <p className="text-[13px] text-[var(--rotulo)]">Todo lo que el estudio tiene en curso</p>
      </div>

      {projects.length === 0 ? (
        <p className="mt-16 text-center text-[15px] text-[var(--secundario)]">
          Todavía no hay proyectos. Se crean al completarse una entrevista.
        </p>
      ) : (
        <>
          {mostrarSeccionEsperando(nosToca) && (
            <section aria-labelledby="atencion" className="mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="atencion" className="text-[13px] font-semibold text-ink">Esperando</h2>
                <p className="text-[11.5px] text-[var(--rotulo)]">
                  {nosToca} {nosToca === 1 ? 'cosa depende' : 'cosas dependen'} del equipo
                </p>
              </div>
              <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {pendientes.map(i => <AttentionRow key={`${i.projectId}-${i.fase}`} item={i} />)}
              </ul>
            </section>
          )}

          <ul aria-label="Listado de proyectos" className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {projects.map(p => (
              <li key={p.id}>
                <Link
                  href={`/admin/projects/${p.id}`}
                  className="flex flex-wrap items-center gap-4 py-4 transition-colors duration-200 hover:bg-[var(--superficie)] sm:flex-nowrap"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-[19px] text-ink">{p.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--secundario)]">
                      {p.pantallaFina.label} · {p.actual.detalle}
                    </span>
                  </span>

                  <ChipEstado item={porProyecto.get(p.id)} />

                  <FaseTrack fases={p.fases} activeKey={p.actual.key} />

                  <span className="flex-none text-[12px] text-[var(--secundario)]">
                    {haceCuanto(p.ultimaActividad, ahora)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminShell>
  )
}
