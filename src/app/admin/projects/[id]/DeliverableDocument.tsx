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
  return <h3 className="font-serif text-base font-medium text-ink">{children}</h3>
}

function Block({ b, wide = false }: { b: DeckBlock; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-[#fbf8ee] p-5${wide ? ' md:col-span-2' : ''}`}>
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

// La solución del canvas viene con prefijo de tipo ("pain reliever: …" / "gain creator: …").
// Lo separamos para mostrarlo como tag de color y que se pueda escanear pain vs gain de un vistazo.
const TIPO_TAG: Record<'pain' | 'gain', string> = {
  pain: 'bg-[#f3e7df] text-[#8a5a3d]',   // clay cálido: alivia un dolor
  gain: 'bg-[#fbeecb] text-[#8a6d0f]',   // banana suave: crea un beneficio
}
function partirSolucion(s: string): { tipo: 'pain' | 'gain' | null; etiqueta: string; texto: string } {
  const m = s.match(/^\s*(pain reliever|gain creator)\s*:\s*([\s\S]*)$/i)
  if (!m) return { tipo: null, etiqueta: '', texto: s.trim() }
  return { tipo: /pain/i.test(m[1]) ? 'pain' : 'gain', etiqueta: m[1].toLowerCase(), texto: m[2].trim() }
}

function FilaCard({ f, n }: { f: DeckSection['tabla'][number]; n: number }) {
  const { tipo, etiqueta, texto } = partirSolucion(f.solucion)
  return (
    <li className="rounded-xl border border-[#ece3d0] bg-white p-5 shadow-[0_1px_2px_rgba(26,21,16,0.03)]">
      <div className="flex gap-3.5">
        <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--banana)]/25 font-serif text-[13px] font-medium text-ink">{n}</span>
        <div className="min-w-0 flex-1">
          <h4 className="font-serif text-[17px] font-medium leading-snug text-ink">{f.job}</h4>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {tipo && (
              <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${TIPO_TAG[tipo]}`}>{etiqueta}</span>
            )}
            <span className="text-[14px] font-medium leading-relaxed text-[#5a5245]">{texto}</span>
          </div>
          <p className="mt-3 border-t border-[#efe7d6] pt-3 text-[14px] leading-[1.75] text-[#4a4238]">{f.comoSeResuelve}</p>
          {!!ORIGEN_LABEL[f.origen] && (
            <p className="mt-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#a59c89]">{ORIGEN_LABEL[f.origen]}</p>
          )}
        </div>
      </div>
    </li>
  )
}

function Tabla({ filas, error }: { filas: DeckSection['tabla']; error: DeckSection['tablaError'] }) {
  if (error) {
    return (
      <div className="rounded-xl bg-[#fbf8ee] p-5 md:col-span-2">
        <BlockTitle>Cómo lo resolvemos, trabajo por trabajo</BlockTitle>
        <ErrorBox text={`La tabla de JTBD no se pudo generar: ${error}`} />
      </div>
    )
  }
  if (!filas.length) return null
  return (
    <div className="rounded-xl bg-[#fbf8ee] p-5 md:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <BlockTitle>Cómo lo resolvemos, trabajo por trabajo</BlockTitle>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#a59c89]">{filas.length} {filas.length === 1 ? 'trabajo' : 'trabajos'}</span>
      </div>
      <ul className="mt-4 space-y-3">
        {filas.map((f, i) => <FilaCard key={i} f={f} n={i + 1} />)}
      </ul>
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
              className="rounded-lg border border-[var(--ink)]/25 bg-[var(--ink)]/0 px-3 py-1 text-xs font-medium text-ink transition-colors duration-200 hover:border-[var(--ink)]/60 hover:bg-[var(--ink)]/5 disabled:opacity-45">
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
  const impar = sec.blocks.length % 2 === 1
  return (
    <section className="space-y-3">
      <SectionHeader sec={sec} busy={busy} onRegenerate={onRegenerate} />
      <div className="rounded-2xl border border-[#e6dfd0] bg-white p-6 shadow-sm">
        {sec.error
          ? <ErrorBox text={`Esta parte no se pudo generar: ${sec.error}`} />
          : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8">
              {sec.blocks.map((b, i) => (
                <Block key={i} b={b} wide={impar && i === sec.blocks.length - 1} />
              ))}
              <Tabla filas={sec.tabla} error={sec.tablaError} />
            </div>
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
