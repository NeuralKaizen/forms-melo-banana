import type { Option } from '@/lib/script/types'

export function ColorGrid({ options, selected, onSelect }: {
  options: Option[]; selected?: string; onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 px-2">
      {options.map(o => (
        <button key={o.id} onClick={() => onSelect(o.id)} aria-label={o.label}
          aria-pressed={selected === o.id}
          className="group flex flex-col gap-1.5">
          <span className={`relative flex aspect-square overflow-hidden rounded-2xl border-2 transition ${selected === o.id ? 'border-[var(--ink)]' : 'border-transparent group-hover:border-black/15'}`}>
            {(o.colors ?? []).map((c, i) => (
              <span key={i} className="h-full flex-1" style={{ background: c }} />
            ))}
            {selected === o.id && (
              <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--banana)] text-[11px] font-bold text-[var(--ink)]">✓</span>
            )}
          </span>
          <span className={`text-center text-[11px] font-medium leading-tight ${selected === o.id ? 'text-ink' : 'text-[#8a8170]'}`}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
