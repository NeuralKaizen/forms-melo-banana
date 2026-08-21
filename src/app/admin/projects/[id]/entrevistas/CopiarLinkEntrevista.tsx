'use client'

import { useRef, useState } from 'react'

/**
 * El link que el estudio le manda a la gente de este proyecto: la entrevista que
 * arranca desde ahí nace ya asignada acá, sin depender de cómo escriban la empresa.
 */
export function CopiarLinkEntrevista({ projectId }: { projectId: string }) {
  const [copiado, setCopiado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function copiar() {
    await navigator.clipboard.writeText(`${location.origin}/?p=${projectId}`)
    setCopiado(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--ink)]/20 px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[var(--ink)]"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
      {copiado ? 'Copiado' : 'Copiar link de entrevista'}
    </button>
  )
}
