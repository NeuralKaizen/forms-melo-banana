'use client'

import { useState } from 'react'
import type {
  Deliverable, PartKey, Item, Problema, Competencia, Perfil, PropuestaValor, Eje, Referente, FilaValor,
} from '@/lib/deliverable/schema'
import type { SectionNumber } from './section-parts'

/**
 * La edición interna del entregable: cada sección del documento se voltea a formulario
 * y se guarda por parte (PATCH), validada en el server con los mismos validadores que
 * se le exigen al modelo. Es el insumo de la exportación a PowerPoint que viene después:
 * lo que se exporte va a ser esto, ya corregido a mano.
 *
 * Reglas de los ítems: el texto se edita; el origen y la cita de los existentes se
 * conservan (la cita es literal de las entrevistas, no se reescribe); lo que agrega el
 * equipo nace con origen 'equipo'; un ítem que se deja vacío se descarta al guardar.
 */

const CAMPO = 'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px] leading-relaxed text-[var(--ink)] outline-none transition focus:border-[var(--banana)]'
const ROTULO = 'block text-[11px] font-bold uppercase tracking-[.12em] text-[var(--rotulo)]'
const QUITAR = 'flex-none self-start rounded-lg border border-black/10 px-2 py-1.5 text-[11px] text-[var(--secundario)] transition-colors hover:border-[var(--ink)]/30 hover:text-ink'
const AGREGAR = 'mt-2 rounded-lg border border-dashed border-[var(--apagado)] px-3 py-1.5 text-[12px] text-[var(--secundario)] transition-colors hover:border-[var(--ink)]/40 hover:text-ink'

function Autosize({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) {
  return (
    <textarea
      value={value}
      rows={Math.max(2, Math.ceil(value.length / 90))}
      onChange={e => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={CAMPO}
    />
  )
}

function Parrafo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className={ROTULO}>{label}</span>
      <div className="mt-1.5"><Autosize value={value} onChange={onChange} ariaLabel={label} /></div>
    </div>
  )
}

const ITEM_NUEVO: Item = { texto: '', origen: 'equipo', cita: null }

function ListaItems({ label, items, onChange }: { label: string; items: Item[]; onChange: (items: Item[]) => void }) {
  return (
    <div>
      <span className={ROTULO}>{label}</span>
      <ul className="mt-1.5 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <Autosize
              value={it.texto}
              onChange={texto => onChange(items.map((x, j) => (j === i ? { ...x, texto } : x)))}
              ariaLabel={`${label}, ítem ${i + 1}`}
            />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className={QUITAR}
              aria-label={`Quitar el ítem ${i + 1} de ${label}`}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onChange([...items, { ...ITEM_NUEVO }])} className={AGREGAR}>
        ＋ Agregar
      </button>
    </div>
  )
}

const sinVacios = (items: Item[]): Item[] => items.filter(i => i.texto.trim().length > 0)

// ── Formularios por parte ───────────────────────────────────────────────────

function FormProblema({ draft, set }: { draft: Problema; set: (p: Problema) => void }) {
  return (
    <div className="space-y-5">
      <Parrafo label="El problema en el mundo" value={draft.problemaMundo} onChange={v => set({ ...draft, problemaMundo: v })} />
      <Parrafo label="El problema como marca" value={draft.problemaMarca} onChange={v => set({ ...draft, problemaMarca: v })} />
      <ListaItems label="El problema del consumidor" items={draft.problemaConsumidor} onChange={v => set({ ...draft, problemaConsumidor: v })} />
      <ListaItems label="Cómo lo resolvemos" items={draft.comoLoHacemos} onChange={v => set({ ...draft, comoLoHacemos: v })} />
      <ListaItems label="Por qué es relevante" items={draft.porQueRelevante} onChange={v => set({ ...draft, porQueRelevante: v })} />
    </div>
  )
}

const EJE_VACIO: Eje = { nombre: '', extremoIzquierdo: '', extremoDerecho: '', origen: 'equipo' }
/** Siempre cuatro filas: el documento compara con cuatro variables, ni más ni menos. */
const cuatroEjes = (ejes: Eje[]): Eje[] =>
  Array.from({ length: 4 }, (_, i) => ejes[i] ?? { ...EJE_VACIO })

function FormCompetencia({ draft, set }: { draft: Competencia; set: (c: Competencia) => void }) {
  const ejes = cuatroEjes(draft.ejes)
  const setEje = (i: number, campo: keyof Eje, v: string) =>
    set({ ...draft, ejes: ejes.map((e, j) => (j === i ? { ...e, [campo]: v } : e)) })
  const setReferente = (i: number, campo: 'marca' | 'tipo', v: string) =>
    set({ ...draft, otrosReferentes: draft.otrosReferentes.map((r, j) => (j === i ? { ...r, [campo]: v } : r)) })

  return (
    <div className="space-y-5">
      <ListaItems label="Competidores principales" items={draft.competidores} onChange={v => set({ ...draft, competidores: v })} />

      <div>
        <span className={ROTULO}>Otros referentes</span>
        <ul className="mt-1.5 space-y-2">
          {draft.otrosReferentes.map((r, i) => (
            <li key={i} className="flex gap-2">
              <input value={r.marca} onChange={e => setReferente(i, 'marca', e.target.value)}
                aria-label={`Marca del referente ${i + 1}`} placeholder="Marca" className={CAMPO} />
              <input value={r.tipo} onChange={e => setReferente(i, 'tipo', e.target.value)}
                aria-label={`Tipo del referente ${i + 1}`} placeholder="referente de marca / visual / de comunicación" className={CAMPO} />
              <button type="button" className={QUITAR} aria-label={`Quitar el referente ${i + 1}`}
                onClick={() => set({ ...draft, otrosReferentes: draft.otrosReferentes.filter((_, j) => j !== i) })}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={AGREGAR}
          onClick={() => set({ ...draft, otrosReferentes: [...draft.otrosReferentes, { marca: '', tipo: '', origen: 'equipo' } satisfies Referente] })}>
          ＋ Agregar
        </button>
      </div>

      <div>
        <span className={ROTULO}>Variables de comparación (las cuatro)</span>
        <ul className="mt-1.5 space-y-2">
          {ejes.map((e, i) => (
            <li key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input value={e.nombre} onChange={ev => setEje(i, 'nombre', ev.target.value)}
                aria-label={`Nombre de la variable ${i + 1}`} placeholder={`Variable ${i + 1}`} className={CAMPO} />
              <input value={e.extremoIzquierdo} onChange={ev => setEje(i, 'extremoIzquierdo', ev.target.value)}
                aria-label={`Extremo izquierdo de la variable ${i + 1}`} placeholder="de…" className={CAMPO} />
              <input value={e.extremoDerecho} onChange={ev => setEje(i, 'extremoDerecho', ev.target.value)}
                aria-label={`Extremo derecho de la variable ${i + 1}`} placeholder="a…" className={CAMPO} />
            </li>
          ))}
        </ul>
      </div>

      <Parrafo label="Posición actual" value={draft.posicionActual.texto}
        onChange={v => set({ ...draft, posicionActual: { ...draft.posicionActual, texto: v } })} />
      <Parrafo label="Posición ideal" value={draft.posicionIdeal.texto}
        onChange={v => set({ ...draft, posicionIdeal: { ...draft.posicionIdeal, texto: v } })} />
    </div>
  )
}

function FormPerfil({ draft, set }: { draft: Perfil; set: (p: Perfil) => void }) {
  return (
    <div className="space-y-5">
      <ListaItems label="Jobs to be done" items={draft.jobs} onChange={v => set({ ...draft, jobs: v })} />
      <ListaItems label="Gains" items={draft.gains} onChange={v => set({ ...draft, gains: v })} />
      <ListaItems label="Pains" items={draft.pains} onChange={v => set({ ...draft, pains: v })} />
    </div>
  )
}

const FILA_NUEVA: FilaValor = { job: '', solucion: '', comoSeResuelve: '', origen: 'equipo' }

function FormPropuestaValor({ draft, set }: { draft: PropuestaValor; set: (p: PropuestaValor) => void }) {
  const setFila = (i: number, campo: keyof FilaValor, v: string) =>
    set({ filas: draft.filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)) })
  return (
    <div>
      <span className={ROTULO}>Cómo lo resolvemos, trabajo por trabajo</span>
      <ul className="mt-1.5 space-y-3">
        {draft.filas.map((f, i) => (
          <li key={i} className="rounded-xl border border-[var(--line)] p-3">
            <div className="flex gap-2">
              <input value={f.job} onChange={e => setFila(i, 'job', e.target.value)}
                aria-label={`Job de la fila ${i + 1}`} placeholder="Job to be done" className={CAMPO} />
              <button type="button" className={QUITAR} aria-label={`Quitar la fila ${i + 1}`}
                onClick={() => set({ filas: draft.filas.filter((_, j) => j !== i) })}>
                Quitar
              </button>
            </div>
            <input value={f.solucion} onChange={e => setFila(i, 'solucion', e.target.value)}
              aria-label={`Solución de la fila ${i + 1}`}
              placeholder="pain reliever: … / gain creator: …" className={`${CAMPO} mt-2`} />
            <div className="mt-2">
              <Autosize value={f.comoSeResuelve} onChange={v => setFila(i, 'comoSeResuelve', v)}
                ariaLabel={`Cómo se resuelve la fila ${i + 1}`} />
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className={AGREGAR} onClick={() => set({ filas: [...draft.filas, { ...FILA_NUEVA }] })}>
        ＋ Agregar trabajo
      </button>
    </div>
  )
}

// ── El editor de una sección ────────────────────────────────────────────────

/** Qué partes edita cada sección, con la limpieza que se aplica al guardar. */
function limpiar(part: PartKey, data: unknown): unknown {
  if (part === 'problema') {
    const p = data as Problema
    return {
      ...p,
      problemaConsumidor: sinVacios(p.problemaConsumidor),
      comoLoHacemos: sinVacios(p.comoLoHacemos),
      porQueRelevante: sinVacios(p.porQueRelevante),
    }
  }
  if (part === 'competencia') {
    const c = data as Competencia
    return {
      ...c,
      competidores: sinVacios(c.competidores),
      otrosReferentes: c.otrosReferentes.filter(r => r.marca.trim().length > 0),
      ejes: cuatroEjes(c.ejes),
    }
  }
  if (part === 'perfil') {
    const p = data as Perfil
    return { jobs: sinVacios(p.jobs), gains: sinVacios(p.gains), pains: sinVacios(p.pains) }
  }
  const pv = data as PropuestaValor
  return { filas: pv.filas.filter(f => f.job.trim().length > 0) }
}

export function EditorSeccion({ numero, deliverable, projectId, onCerrar }: {
  numero: SectionNumber
  deliverable: Deliverable
  projectId: string
  onCerrar: () => void
}) {
  const [problema, setProblema] = useState<Problema | null>(() => structuredClone(deliverable.problema?.data ?? null))
  const [competencia, setCompetencia] = useState<Competencia | null>(() => structuredClone(deliverable.competencia?.data ?? null))
  const [perfil, setPerfil] = useState<Perfil | null>(() => structuredClone(deliverable.perfil?.data ?? null))
  const [propuestaValor, setPropuestaValor] = useState<PropuestaValor | null>(() => structuredClone(deliverable.propuestaValor?.data ?? null))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const partes: { part: PartKey; data: unknown }[] = (
    numero === 1 ? [{ part: 'problema' as const, data: problema }]
      : numero === 2 ? [{ part: 'competencia' as const, data: competencia }]
        : [{ part: 'perfil' as const, data: perfil }, { part: 'propuestaValor' as const, data: propuestaValor }]
  ).filter(p => p.data !== null)

  async function guardar() {
    setGuardando(true)
    setError(null)
    for (const { part, data } of partes) {
      const res = await fetch(`/api/projects/${projectId}/deliverable`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ part, data: limpiar(part, data) }),
      }).catch(() => null)
      if (!res?.ok) {
        setError((await res?.json().catch(() => null))?.error ?? 'No se pudo guardar. Probá de nuevo.')
        setGuardando(false)
        return
      }
    }
    location.reload()
  }

  return (
    <div className="rounded-2xl border-[1.5px] border-[var(--ink)] bg-white p-6">
      <div className="space-y-6">
        {numero === 1 && problema && <FormProblema draft={problema} set={setProblema} />}
        {numero === 2 && competencia && <FormCompetencia draft={competencia} set={setCompetencia} />}
        {numero === 3 && perfil && <FormPerfil draft={perfil} set={setPerfil} />}
        {numero === 3 && propuestaValor && <FormPropuestaValor draft={propuestaValor} set={setPropuestaValor} />}
        {partes.length === 0 && (
          <p className="text-[14px] text-[var(--secundario)]">Esta sección todavía no se generó: no hay nada que editar.</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--line)] pt-4">
        {error && <p className="mr-auto text-[12.5px] leading-snug text-[#8a3a3a]">{error}</p>}
        <button type="button" onClick={onCerrar} disabled={guardando}
          className="rounded-xl px-3.5 py-2 text-[13px] font-semibold text-[var(--secundario)] hover:text-ink">
          Cancelar
        </button>
        {partes.length > 0 && (
          <button type="button" onClick={() => void guardar()} disabled={guardando}
            className="rounded-xl bg-[var(--ink)] px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
      </div>
    </div>
  )
}
