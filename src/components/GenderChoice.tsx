import type { Option } from '@/lib/script/types'

function Silhouette({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" fill="var(--ink)" aria-hidden="true">
      <circle cx="32" cy="12" r="9" />
      {id === 'mujer'
        ? <><path d="M32 22 L46 48 H18 Z" /><rect x="27" y="46" width="5" height="14" rx="2" /><rect x="33" y="46" width="5" height="14" rx="2" /></>
        : <><rect x="22" y="24" width="20" height="22" rx="4" /><rect x="24" y="44" width="6" height="16" rx="2" /><rect x="34" y="44" width="6" height="16" rx="2" /></>}
    </svg>
  )
}

export function GenderChoice({ options, selected, onSelect }: {
  options: Option[]; selected?: string; onSelect: (id: string) => void
}) {
  return (
    <div className="flex justify-center gap-5">
      {options.map(o => (
        <button key={o.id} onClick={() => onSelect(o.id)} aria-label={o.label}
          className={`flex w-32 flex-col items-center gap-3 rounded-3xl border-2 px-4 py-6 transition ${selected === o.id ? 'border-[var(--ink)] bg-[var(--banana)]/15' : 'border-black/10 hover:border-black/25'}`}>
          <Silhouette id={o.id} />
          <span className="font-semibold text-ink">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
