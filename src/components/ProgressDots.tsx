export function ProgressDots({ index, total }: { index: number; total: number }) {
  const pct = Math.round((index / total) * 100)
  return (
    <div className="flex items-center gap-2" aria-label={`Pregunta ${index} de ${total}`}>
      <div className="h-[3px] w-28 rounded-full bg-black/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--banana)' }} />
      </div>
      <span className="text-[10px] text-black/40">{index}/{total}</span>
    </div>
  )
}
