import type { DeckView, DeckSection, DeckBlock, DeckItem } from '@/lib/deck/view-model'
import type { PartKey } from '@/lib/deliverable/schema'
import { partsOfSection, type SectionNumber } from './section-parts'

const ORIGEN_LABEL: Partial<Record<DeckItem['origen'], string>> = {
  equipo: 'propuesta del equipo',
  pendiente: 'pendiente del taller',
}

function ErrorBox({ text }: { text: string }) {
  return <p className="mt-3 rounded-xl border border-[#f0d0d0] bg-[#fff4f4] px-4 py-3 text-sm text-[#8a3a3a]">{text}</p>
}

function ItemRow({ it }: { it: DeckItem }) {
  const pend = it.origen === 'pendiente'
  return (
    <div className="mt-3 flex gap-2.5">
      <span aria-hidden="true" className="shrink-0 text-[var(--banana)]">—</span>
      <div>
        <p className={`text-[15px] leading-relaxed ${pend ? 'text-[#6b6155]' : 'text-ink'}`}>{it.texto}</p>
        {!!it.cita && (
          <p className="mt-1.5 border-l-2 border-[var(--banana)] pl-2.5 text-sm leading-relaxed text-[#6b6155]">“{it.cita}”</p>
        )}
        {!!ORIGEN_LABEL[it.origen] && (
          <p className="mt-1 text-[10px] tracking-[0.08em] text-[#6b6155]">{ORIGEN_LABEL[it.origen]}</p>
        )}
      </div>
    </div>
  )
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="border-b border-[#e6dfd0] pb-1.5 font-serif text-base font-medium text-ink">{children}</h3>
}

function Block({ b }: { b: DeckBlock }) {
  return (
    <div className="mt-6 first:mt-0">
      <BlockTitle>{b.titulo}</BlockTitle>
      {b.error
        ? <ErrorBox text={`Esta parte no se pudo generar: ${b.error}`} />
        : (
          <>
            {!!b.parrafo && <p className="mt-3 text-[15px] leading-relaxed text-ink">{b.parrafo}</p>}
            {b.items.map((it, i) => <ItemRow key={i} it={it} />)}
          </>
        )}
    </div>
  )
}

function Tabla({ filas, error }: { filas: DeckSection['tabla']; error: DeckSection['tablaError'] }) {
  if (error) {
    return (
      <div className="mt-6">
        <BlockTitle>Cómo lo resolvemos, trabajo por trabajo</BlockTitle>
        <ErrorBox text={`La tabla de JTBD no se pudo generar: ${error}`} />
      </div>
    )
  }
  if (!filas.length) return null
  const th = 'py-2 pr-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6b6155]'
  return (
    <div className="mt-6">
      <BlockTitle>Cómo lo resolvemos, trabajo por trabajo</BlockTitle>
      <table className="mt-3 w-full text-left">
        <thead>
          <tr className="border-b border-[var(--ink)]">
            <th className={`w-[30%] ${th}`}>Job to be done</th>
            <th className={`w-[30%] ${th}`}>Solución</th>
            <th className={`w-[40%] ${th} pr-0`}>Cómo se resuelve</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-[#e6dfd0] align-top">
              <td className="py-2.5 pr-3 text-sm leading-relaxed text-ink">{f.job}</td>
              <td className="py-2.5 pr-3 text-sm leading-relaxed text-ink">{f.solucion}</td>
              <td className="py-2.5 text-sm leading-relaxed text-ink">
                {f.comoSeResuelve}
                {!!ORIGEN_LABEL[f.origen] && (
                  <span className="mt-1 block text-[10px] tracking-[0.08em] text-[#6b6155]">{ORIGEN_LABEL[f.origen]}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionHeader({ sec, busy, onRegenerate }: {
  sec: DeckSection
  busy: PartKey | 'full' | null
  onRegenerate: (part: PartKey) => void
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[var(--banana)] px-6 py-5">
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-5 right-4 select-none font-serif text-7xl font-medium text-[var(--ink)]/10">
        {`0${sec.numero}`}
      </span>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink)]/60">Taller Propuesta de Valor</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-medium leading-tight text-ink">{sec.titulo}</h2>
        <div className="flex flex-wrap gap-2">
          {partsOfSection(sec.numero as SectionNumber).map(({ key, label }) => (
            <button key={key} onClick={() => onRegenerate(key)} disabled={busy !== null}
              className="rounded-lg border border-[var(--ink)]/25 px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-[var(--ink)] disabled:opacity-50">
              {busy === key ? 'Regenerando…' : label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Section({ sec, busy, onRegenerate }: {
  sec: DeckSection
  busy: PartKey | 'full' | null
  onRegenerate: (part: PartKey) => void
}) {
  return (
    <section className="space-y-3">
      <SectionHeader sec={sec} busy={busy} onRegenerate={onRegenerate} />
      <div className="rounded-2xl border border-[#e6dfd0] bg-white p-6 shadow-sm">
        {sec.error
          ? <ErrorBox text={`Esta parte no se pudo generar: ${sec.error}`} />
          : (
            <>
              {sec.blocks.map((b, i) => <Block key={i} b={b} />)}
              <Tabla filas={sec.tabla} error={sec.tablaError} />
            </>
          )}
      </div>
    </section>
  )
}

/** Espejo HTML de DeckDocument (el PDF del taller): las 3 secciones numeradas del entregable. */
export function DeliverableDocument({ view, busy, onRegenerate }: {
  view: DeckView
  busy: PartKey | 'full' | null
  onRegenerate: (part: PartKey) => void
}) {
  return (
    <div className="space-y-6">
      {view.secciones.map(sec => (
        <Section key={sec.numero} sec={sec} busy={busy} onRegenerate={onRegenerate} />
      ))}
    </div>
  )
}
