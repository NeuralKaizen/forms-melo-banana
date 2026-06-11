import type { Option } from '@/lib/script/types'

export function ImageGrid({ options, selected, onSelect }: {
  options: Option[]; selected?: string; onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 px-2">
      {options.map(o => (
        <button key={o.id} onClick={() => onSelect(o.id)}
          className={`relative aspect-square overflow-hidden rounded-2xl border-2 ${selected === o.id ? 'border-[var(--ink)]' : 'border-transparent'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.src} alt={o.label} className="h-full w-full object-cover" />
          {selected === o.id && (
            <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--banana)] text-[11px] font-bold text-[var(--ink)]">✓</span>
          )}
        </button>
      ))}
    </div>
  )
}
