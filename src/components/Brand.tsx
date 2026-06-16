/** The serif wordmark, matching Mellow & Banana's real logo type. */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-serif ${className}`}>Mellow &amp; Banana</span>
}

/** The yellow logo block with the stacked white serif wordmark (their actual mark). */
export function LogoBlock({ size = 92 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-2xl bg-[var(--banana)] shadow-[0_10px_30px_rgba(255,212,0,0.35)]"
      style={{ width: size, height: size }}
    >
      <span
        className="font-serif font-medium leading-[1.05] text-white"
        style={{ fontSize: size * 0.2 }}
      >
        Mellow<br />&amp; Banana
      </span>
    </div>
  )
}

/** Glyph de banana — acento de marca recurrente (no emoji). */
export function BananaGlyph({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M5 4c-1 8 5 16 14 15.6.9-.05 1.4-1.1.7-1.7-.2-.2-.5-.3-.8-.4C13.4 15.6 10.2 10.6 9.6 5 9.5 4.4 9 4 8.4 4H6c-.5 0-.9.4-1 .9Z"
        fill="var(--banana)" stroke="#1a1510" strokeWidth="1.2" strokeLinejoin="round"
      />
      <path d="M5 4.2c1.1-.5 2.2-.5 3.2-.1" stroke="#1a1510" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
