'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { FaseIndice } from '@/lib/pipeline/indice'

/**
 * El recorrido al pie de la mesa de trabajo: tres tarjetas de fase con su avance.
 * Tocar una despliega sus etapas con nombre y estado — la estructura completa sigue
 * acá, pero plegada: es el cajón que se abre cuando hace falta, no el mueble principal.
 */
export function RecorridoPlegable({ fases }: { fases: FaseIndice[] }) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const fase = fases.find(f => f.key === abierta)

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {fases.map(f => {
          const aplicables = f.entradas.filter(e => e.estado !== 'no_aplica')
          const aprobadas = aplicables.filter(e => e.estado === 'aprobada').length
          const espera = f.entradas.some(e => e.espera)
          const activa = f.key === abierta
          return (
            <button
              key={f.key}
              type="button"
              aria-expanded={activa}
              onClick={() => setAbierta(activa ? null : f.key)}
              className={`min-w-0 flex-1 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200 ${
                activa ? 'border-[var(--ink)]' : 'border-[var(--line)] hover:border-[var(--ink)]/40'
              }`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-1.5 truncate text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink)]">
                  {f.label}
                  {espera && (
                    <>
                      <span className="h-[7px] w-[7px] flex-none rounded-full bg-[var(--banana)]" aria-hidden="true" />
                      <span className="sr-only">Tiene algo esperando</span>
                    </>
                  )}
                </span>
                <span className="flex-none text-[11px] tabular-nums text-[var(--rotulo)]">{f.avance}</span>
              </span>
              <span className="mt-2 block h-[5px] overflow-hidden rounded-full bg-[var(--line)]">
                <span
                  className="block h-full rounded-full bg-[var(--banana)]"
                  style={{ width: `${aplicables.length ? (aprobadas / aplicables.length) * 100 : 0}%` }}
                />
              </span>
            </button>
          )
        })}
      </div>

      {fase && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {fase.entradas.map(e => (
            <li key={e.key}>
              <Link
                href={e.href}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors duration-200 ${
                  e.estado === 'aprobada'
                    ? 'border-[var(--aprobado)] bg-[var(--aprobado)] text-[#6d5a10] hover:border-[var(--ink)]/40'
                    : e.estado === 'no_aplica'
                      ? 'border-dashed border-[var(--line)] text-[var(--apagado)] hover:border-[var(--ink)]/30'
                      : 'border-[var(--line)] text-[var(--cuerpo)] hover:border-[var(--ink)]/40'
                }`}
              >
                {e.label}
                {e.espera && (
                  <>
                    <span className="h-[6px] w-[6px] flex-none rounded-full bg-[var(--banana)] ring-1 ring-[var(--ink)]/20" aria-hidden="true" />
                    <span className="sr-only">Espera al equipo</span>
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
