import Link from 'next/link'
import { Wordmark } from './Brand'

/** Barra superior mínima de las páginas autenticadas del admin. Quieta: sin sticky, sin sombra, sin motion. */
export function AdminBar() {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-8 pt-6">
      <Link href="/admin" className="text-lg font-medium text-ink">
        <Wordmark />
      </Link>
      <span className="rounded-full border border-[#b08a1e]/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">
        Panel interno
      </span>
    </header>
  )
}
