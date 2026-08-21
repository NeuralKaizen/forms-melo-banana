'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCerrarConEscape } from './BarraProyectos'

/**
 * La cabecera del índice del proyecto: la vuelta al panel general y las dos acciones
 * sobre el proyecto como cosa entera —renombrar y borrar—, que no pertenecen a ninguna
 * etapa y por eso viven acá y no en una pantalla.
 *
 * Borrar exige tipear el nombre exacto: es irreversible y se lleva las entrevistas y
 * todo el historial, así que la fricción es a propósito.
 */
export function CabeceraProyecto({ projectId, nombre, subtitulo }: {
  projectId: string
  nombre: string
  subtitulo: string
}) {
  const router = useRouter()
  const [modo, setModo] = useState<'normal' | 'renombrando' | 'borrando'>('normal')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')

  const cerrar = () => {
    setModo('normal')
    setError(null)
    setConfirmacion('')
  }
  useCerrarConEscape(cerrar, modo !== 'normal')

  async function renombrar(nuevo: string) {
    if (nuevo.trim() === nombre || !nuevo.trim()) return cerrar()
    setOcupado(true)
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: nuevo }),
    }).catch(() => null)
    setOcupado(false)
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? 'No se pudo renombrar. Probá de nuevo.')
      return
    }
    cerrar()
    router.refresh()
  }

  async function borrar() {
    setOcupado(true)
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => null)
    setOcupado(false)
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? 'No se pudo borrar. Probá de nuevo.')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="border-b border-[var(--line)] px-3 py-3">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)] transition-colors duration-200 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Proyectos
      </Link>

      {modo === 'renombrando' ? (
        <form
          className="mt-1.5"
          onSubmit={e => {
            e.preventDefault()
            void renombrar(new FormData(e.currentTarget).get('nombre') as string)
          }}
        >
          <input
            name="nombre"
            defaultValue={nombre}
            autoFocus
            disabled={ocupado}
            aria-label="Nuevo nombre del proyecto"
            className="w-full rounded-lg border border-[var(--ink)]/25 bg-white px-2 py-1 font-serif text-[15px] text-[var(--ink)] outline-none focus:border-[var(--banana)]"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button type="submit" disabled={ocupado}
              className="rounded-lg bg-[var(--ink)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
              Guardar
            </button>
            <button type="button" onClick={cerrar}
              className="text-[11px] text-[var(--secundario)] hover:text-ink">
              Cancelar
            </button>
          </div>
          {error && <p className="mt-1.5 text-[11px] leading-snug text-[var(--error)]">{error}</p>}
        </form>
      ) : (
        <div className="mt-1 flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[16px] font-medium text-[var(--ink)]">{nombre}</p>
            <p className="text-[11.5px] text-[var(--rotulo)]">{subtitulo}</p>
          </div>
          <button
            type="button"
            title="Renombrar el proyecto"
            aria-label={`Renombrar el proyecto ${nombre}`}
            onClick={() => setModo('renombrando')}
            className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md text-[var(--apagado)] transition-colors duration-200 hover:bg-[var(--superficie)] hover:text-ink"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
          <button
            type="button"
            title="Borrar el proyecto"
            aria-label={`Borrar el proyecto ${nombre}`}
            onClick={() => setModo('borrando')}
            className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md text-[var(--apagado)] transition-colors duration-200 hover:bg-[var(--superficie)] hover:text-[var(--error)]"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
            </svg>
          </button>
        </div>
      )}

      {modo === 'borrando' && (
        <>
          <div aria-hidden="true" onClick={cerrar} className="fixed inset-0 z-40 bg-[rgba(21,18,12,.3)]" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-borrar"
            className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-2xl"
          >
            <h2 id="titulo-borrar" className="font-serif text-[20px] text-[var(--ink)]">
              ¿Borrar «{nombre}»?
            </h2>
            <p className="mt-2.5 text-[13px] leading-[1.6] text-[var(--secundario)]">
              Se borra el proyecto con todas sus entrevistas, el entregable y el historial
              completo de landscape y estrategia. <strong className="font-semibold text-ink">No se puede deshacer.</strong> Si
              hay entrevistas que querés conservar, movelas antes a otro proyecto.
            </p>
            <label className="mt-4 block text-[12px] font-medium text-[var(--cuerpo)]">
              Escribí el nombre del proyecto para confirmar
              <input
                value={confirmacion}
                onChange={e => setConfirmacion(e.target.value)}
                autoFocus
                placeholder={nombre}
                className="mt-1.5 w-full rounded-lg border border-[var(--ink)]/25 px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--banana)]"
              />
            </label>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button type="button" onClick={cerrar}
                className="rounded-xl px-3.5 py-2 text-[13px] font-semibold text-[var(--secundario)] hover:text-ink">
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmacion.trim() !== nombre || ocupado}
                onClick={() => void borrar()}
                className="rounded-xl bg-[var(--error)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-opacity disabled:opacity-40"
              >
                {ocupado ? 'Borrando…' : 'Borrar el proyecto'}
              </button>
            </div>
            {error && <p className="mt-3 text-[12px] leading-snug text-[var(--error)]">{error}</p>}
          </div>
        </>
      )}
    </div>
  )
}
