import type { Option } from '@/lib/script/types'

export function AgeGrid({ options, selected, onSelect }: {
  options: Option[]; selected?: string; onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-2 px-2 sm:gap-3">
      {options.map(o => {
        const isSel = selected === o.id
        // "20's" → número "20" grande + sufijo "s" pequeño
        const num = o.label.replace(/[^0-9]/g, '')
        return (
          <button key={o.id} onClick={() => onSelect(o.id)} aria-label={`${o.label} años`}
            aria-pressed={isSel}
            className={`group relative flex aspect-[4/5] flex-col items-center justify-center rounded-2xl border-2 bg-white transition ${isSel ? 'border-[var(--ink)] bg-[var(--banana)]/15' : 'border-black/10 hover:border-black/25'}`}>
            <span className="flex items-baseline font-serif leading-none text-ink">
              <span className="text-2xl font-medium sm:text-4xl">{num}</span>
              <span className="text-sm font-medium sm:text-lg">s</span>
            </span>
            <span className={`mt-1 text-[9px] uppercase tracking-[0.14em] sm:text-[10px] ${isSel ? 'text-[#8a8170]' : 'text-[#bcb29c]'}`}>años</span>
            {isSel && (
              <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--banana)] text-[9px] font-bold text-[var(--ink)] sm:h-5 sm:w-5 sm:text-[11px]">✓</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
