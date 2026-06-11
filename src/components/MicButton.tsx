export function MicButton({ active, onClick }: { active: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} aria-label={active ? 'Cortar' : 'Hablar'} data-state={active ? 'listening' : 'idle'}
      className={`grid h-[72px] w-[72px] place-items-center rounded-[24px] transition active:scale-95 ${
        active
          ? 'bg-[var(--banana)] shadow-[0_5px_14px_rgba(217,158,34,0.4)]'
          : 'bg-cream shadow-[inset_0_0_0_2.5px_var(--ink),0_5px_12px_rgba(0,0,0,0.08)]'
      }`}>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  )
}
