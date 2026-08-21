import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import {
  getProjectWithSessions, getDeliverable, landscapeState, summarizeLandscape, listLandscapeActivity,
} from '@/lib/db/store'
import { strategyState, summarizeStrategy, listStrategyActivity } from '@/lib/db/strategy-store'
import { deriveFases, derivePantallas, pantallaActual } from '@/lib/pipeline/phases'
import { construirIndice, esperanDecision } from '@/lib/pipeline/indice'
import { projectSignals } from '@/lib/pipeline/signals'
import { attentionItems, haceCuanto } from '@/lib/pipeline/attention'
import { armarNosToca, armarMovimientos } from '@/lib/pipeline/mesa'
import { buildStages } from '@/lib/landscape/stages'
import { buildEtapasEstrategia } from '@/lib/estrategia/stages'
import { AdminShell } from '@/components/AdminShell'
import { CabeceraProyecto } from '@/components/CabeceraProyecto'
import { RecorridoPlegable } from '@/components/RecorridoPlegable'

export const dynamic = 'force-dynamic'

function Zona({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">{titulo}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/**
 * La mesa de trabajo: el proyecto no abre con su estructura sino con el trabajo.
 * Primero lo que espera una decisión del equipo, con el link directo; después qué se
 * movió; al pie, el recorrido completo, plegado. Ver la entrada de la bitácora del
 * 2026-08-21 y la decisión "el proyecto abre con el trabajo".
 */
export default async function MesaDeTrabajo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProjectWithSessions(db, id)
  if (!project) notFound()

  const sesiones = project.sessions as {
    id: string; name?: string | null; status?: string | null; completedAt?: Date | string | null
  }[]
  const deliverable = await getDeliverable(db, id)
  const estadoLandscape = await landscapeState(db, id)
  const estrategiaEstado = await strategyState(db, id)
  const señales = projectSignals({
    sessions: sesiones,
    tieneEntregable: !!deliverable,
    landscape: summarizeLandscape(estadoLandscape),
    estrategia: summarizeStrategy(estrategiaEstado),
  })
  const fases = deriveFases(id, señales)
  const pantallas = derivePantallas(id, señales)
  const actual = pantallaActual(fases, pantallas)

  // La mesa no está parada en ninguna etapa (etapaActiva vacía) y necesita el recorrido
  // entero sin colapsar: una espera escondida detrás de "＋ n etapas más" no se puede
  // atender.
  const indice = construirIndice({
    projectId: id,
    fases,
    pantallas,
    etapaActiva: '',
    stagesLandscape: buildStages(estadoLandscape),
    etapasEstrategia: buildEtapasEstrategia(estrategiaEstado),
    esperanDecision: [
      ...esperanDecision('landscape', estadoLandscape),
      ...esperanDecision('estrategia', estrategiaEstado),
    ],
    todas: true,
  })

  const completadas = sesiones.filter(s => s.status === 'completed').length
  const atencion = attentionItems([{
    id,
    name: project.name,
    pantallas,
    sessionsTotal: sesiones.length,
    sessionsCompleted: completadas,
    tieneEntregable: !!deliverable,
  }])

  const nosToca = armarNosToca(indice, atencion)
  const movimientos = armarMovimientos({
    projectId: id,
    landscape: await listLandscapeActivity(db, id, 8),
    estrategia: await listStrategyActivity(db, id, 8),
    sesiones,
    limite: 8,
  })
  const ahora = new Date()

  return (
    <AdminShell activeProjectId={id}>
      <div className="max-w-3xl">
        <CabeceraProyecto
          portada
          projectId={id}
          nombre={project.name}
          subtitulo={`${actual.label} · ${actual.detalle}`}
        />

        <Zona titulo="Nos toca">
          {nosToca.length === 0 ? (
            <p className="border-t border-[var(--line)] pt-3 text-[14px] text-[var(--secundario)]">
              Nada espera una decisión del equipo. El recorrido de abajo dice por dónde seguir.
            </p>
          ) : (
            <ul>
              {nosToca.map(p => (
                <li key={p.href + p.titulo}>
                  <Link
                    href={p.href}
                    className="group flex items-center gap-3 border-t border-[var(--line)] py-3 transition-colors duration-200 hover:bg-[var(--superficie)]"
                  >
                    <span className="h-[8px] w-[8px] flex-none rounded-full bg-[var(--banana)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium text-[var(--ink)]">{p.titulo}</span>
                      {p.sub && <span className="mt-0.5 block text-[12px] text-[var(--rotulo)]">{p.sub}</span>}
                    </span>
                    <span className="flex-none rounded-xl bg-[var(--ink)] px-3.5 py-1.5 text-[12px] font-semibold text-white">
                      Ir
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Zona>

        <Zona titulo="Mientras no estabas">
          {movimientos.length === 0 ? (
            <p className="border-t border-[var(--line)] pt-3 text-[14px] text-[var(--secundario)]">
              Todavía no se movió nada en este proyecto.
            </p>
          ) : (
            <ul>
              {movimientos.map(m => (
                <li key={m.id}>
                  <Link
                    href={m.href}
                    className="flex items-baseline gap-3 border-t border-[var(--line)] py-2.5 text-[13.5px] transition-colors duration-200 first:border-t-[var(--line)] hover:bg-[var(--superficie)]"
                  >
                    <span className="w-[74px] flex-none text-[11.5px] tabular-nums text-[var(--apagado)]">
                      {haceCuanto(m.cuando, ahora)}
                    </span>
                    <span className="min-w-0 flex-1 text-[var(--secundario)]">
                      <strong className="font-medium text-[var(--ink)]">{m.quien}</strong> {m.texto}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Zona>

        <Zona titulo="El recorrido">
          <RecorridoPlegable fases={indice} />
        </Zona>
      </div>
    </AdminShell>
  )
}
