export function StatePill({ mode }: { mode: 'agent' | 'you' }) {
  const agent = mode === 'agent'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider ${agent ? 'bg-[var(--ink)] text-white' : 'bg-[var(--banana)] text-[var(--ink)]'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {agent ? 'Banana está hablando' : 'Te escucho…'}
    </span>
  )
}
