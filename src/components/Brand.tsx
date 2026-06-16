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
