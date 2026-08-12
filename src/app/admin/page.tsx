import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listProjectsWithCounts, landscapeState, summarizeLandscape } from '@/lib/db/store'
import { strategyState, summarizeStrategy } from '@/lib/db/strategy-store'
import { deriveFases, faseActual, derivePantallas, pantallaActual, type Fase, type PhaseStatus } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'
import { attentionItems, haceCuanto, type AttentionItem } from '@/lib/pipeline/attention'
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
              : g.key === activeKey ? 'bg-[#d9d0ba]'
              : 'bg-[#efe9db]'
          }`}
        />
      ))}
    </span>
  )
}

const CHIP: Record<PhaseStatus, { clase: string; texto: string }> = {
  completa: { clase: 'bg-[#fffdf0] text-[#8a6d10]', texto: 'Completa' },
  en_curso: { clase: 'bg-[#fffdf0] text-[#8a6d10]', texto: 'En curso' },
  espera: { clase: 'bg-[#f7f3e6] text-[#8a6d10]', texto: 'En espera' },
  pendiente: { clase: 'bg-[#f4f1e8] text-[#8a8170]', texto: 'Pendiente' },
}

/** Una cosa esperando: qué proyecto, qué falta, y quién la destraba. */
function AttentionRow({ item }: { item: AttentionItem }) {
  const delEquipo = item.bloqueo === 'equipo'
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-[#fffdf0]"
      >
        <span
          className={`h-1.5 w-1.5 flex-none rounded-full ${delEquipo ? 'bg-[var(--banana)]' : 'bg-[#d9d0ba]'}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] leading-snug text-ink">
            <strong className="font-medium">{item.projectName}</strong>
            <span className="text-[#c0b8a6]"> · </span>
            <span className="text-[#6b6155]">{item.accion}</span>
          </span>
        </span>
        <span className="flex-none text-[11px] text-[#a59c89]">
          {delEquipo ? 'Nos toca' : 'Esperando'}
        </span>
      </Link>
    </li>
  )
}

const Th = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <th scope="col" className={`px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#a59c89] ${className}`}>
    {children}
  </th>
)

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
  const ahora = new Date()

  return (
    <AdminShell>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl font-medium leading-tight text-ink">
          <span className="underline-banana">Proyectos</span>
        </h1>
        <p className="text-[13px] text-[#a59c89]">Todo lo que el estudio tiene en curso</p>
      </div>

      {projects.length === 0 ? (
        <p className="mt-16 text-center text-[15px] text-[#8a8170]">
          Todavía no hay proyectos. Se crean al completarse una entrevista.
        </p>
      ) : (
        <>
          <section aria-labelledby="atencion" className="mt-7 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-3">
              <h2 id="atencion" className="text-[13px] font-semibold text-ink">Esperando</h2>
              <p className="text-[11.5px] text-[#a59c89]">
                {nosToca === 0
                  ? 'Nada trabado de nuestro lado'
                  : `${nosToca} ${nosToca === 1 ? 'cosa depende' : 'cosas dependen'} del equipo`}
              </p>
            </div>

            {pendientes.length === 0 ? (
              <p className="px-3 pt-3 text-[13.5px] text-[#8a8170]">Todo al día. Ningún proyecto espera nada.</p>
            ) : (
              <ul className="mt-2 divide-y divide-black/5">
                {pendientes.map(i => <AttentionRow key={`${i.projectId}-${i.fase}`} item={i} />)}
              </ul>
            )}
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] border-collapse">
                <thead>
                  <tr className="border-b border-black/5 bg-[#faf7ee]">
                    <Th>Proyecto</Th>
                    <Th>Entrevistas</Th>
                    <Th>Propuesta</Th>
                    <Th>Fase actual</Th>
                    <Th>Movimiento</Th>
                    <Th className="text-right">Recorrido</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {projects.map(p => (
                    <tr key={p.id} className="transition-colors duration-200 hover:bg-[#fffdf0]">
                      <td className="px-5 py-4">
                        <Link href={`/admin/projects/${p.id}`} className="font-serif text-[17px] font-medium text-ink underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-[var(--banana)]">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-[13px] tabular-nums text-[#6b6155]">
                        {p.sessionsTotal === 0
                          ? <span className="text-[#c0b8a6]">—</span>
                          : <>{p.sessionsCompleted}/{p.sessionsTotal} <span className="text-[#a59c89]">completas</span></>}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[#6b6155]">
                        {p.tieneEntregable ? 'Generada' : <span className="text-[#c0b8a6]">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">{p.pantallaFina.label}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${CHIP[p.actual.status].clase}`}>
                            {CHIP[p.actual.status].texto}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-[#a59c89]">{p.actual.detalle}</span>
                      </td>
                      <td className="px-5 py-4 text-[12.5px] text-[#8a8170]">
                        {haceCuanto(p.ultimaActividad, ahora)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex justify-end">
                          <FaseTrack fases={p.fases} activeKey={p.actual.key} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  )
}
