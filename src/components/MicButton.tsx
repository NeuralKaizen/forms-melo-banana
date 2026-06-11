export function MicButton({ active, onClick }: { active: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} aria-label="Hablar"
      className={`relative grid h-16 w-16 place-items-center rounded-full transition ${active ? 'bg-[var(--banana)]' : 'bg-[var(--ink)]'}`}>
      <svg viewBox="0 0 24 24" width="25" height="25" fill="none"
        stroke={active ? '#1a1404' : 'var(--banana)'} strokeWidth="1.9">
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  )
}
