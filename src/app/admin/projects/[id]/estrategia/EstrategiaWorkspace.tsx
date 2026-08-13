'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EstrategiaKey, EtapaEstrategia } from '@/lib/estrategia/stages'
import { ETAPA_LABEL, ETAPA_ORDER } from '@/lib/estrategia/stages'
import { EtapaDocumento } from '@/components/EtapaDocumento'
import { ComparadorVersiones } from '@/components/ComparadorVersiones'
import { AvisoVersionNueva, CabeceraEtapa, NotaDependencia, Vecinas } from '@/components/EtapaPartes'

/**
 * Espejo de `LandscapeWorkspace`, con dos restas: no hay gate de tendencias (la
 * estrategia no tiene una etapa como esa, todas se aprueban igual) y no hay actividad
 * (`listLandscapeActivity` no tiene equivalente todavía). Los bloques del proceso ya no
 * viven acá: los rinde el índice del proyecto.
 */

type ContenidoEtapaVista = {
  id: string
  content: unknown
  aprobada: boolean
  /** “Escrito por Claude · hace 2 h · sin aprobar”: se arma en el servidor, con la hora del servidor. */
  procedencia: string
  /** Cuándo se escribió. Es la cabecera de su columna en el comparador. */
  cuando: string
  /** Lo que Claude guardó después de la aprobación. Ver `StrategyStageState.borradorNuevo`. */
  borradorNuevo: { id: string; content: unknown; cuando: string; autor: string } | null
} | null

export function EstrategiaWorkspace({
  projectId,
  etapaActiva,
  etapas,
  contenidoPorEtapa,
  dependencia,
}: {
  projectId: string
  /** La etapa que se está mirando. Viene de `?etapa=`, ya validada por la página. */
  etapaActiva: EstrategiaKey
  etapas: EtapaEstrategia[]
  contenidoPorEtapa: Record<string, ContenidoEtapaVista>
  /** Lo que esta fase necesita de otra y todavía no llegó, si hay algo. */
  dependencia?: string
}) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El equipo pidió mirar sólo la versión aprobada. No decide nada —el borrador sigue
  // guardado y la etapa sigue esperando— así que es estado de vista y se vuelve.
  const [soloAprobada, setSoloAprobada] = useState(false)

  // Navegar ahora es cambiar la URL, no un `setState`: el componente sigue montado entre
  // etapas, así que lo que era de la etapa anterior —el error, qué versión se estaba
  // mirando— se limpia al cambiar de etapa o queda pegado. Se ajusta durante el render, no
  // en un efecto: un efecto pintaría primero la etapa nueva con el estado de la vieja.
  const [etapaPrevia, setEtapaPrevia] = useState<EstrategiaKey>(etapaActiva)
  if (etapaPrevia !== etapaActiva) {
    setEtapaPrevia(etapaActiva)
    setError(null)
    setSoloAprobada(false)
  }

  // Aprobar una versión ya guardada: Claude guarda por MCP, el equipo aprueba después
  // desde el panel. A diferencia de landscape, acá no hay una etapa con gate propio
  // (no hay equivalente de tendencias) — todas pasan por este único camino.
  async function aprobarVersion(etapaKey: EstrategiaKey, versionId: string) {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/estrategia/${etapaKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'aprobar', versionId }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'No se pudo aprobar')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const posicion = Math.max(0, ETAPA_ORDER.indexOf(etapaActiva))
  const ubicacion = `Estrategia · etapa ${posicion + 1} de ${ETAPA_ORDER.length}`
  const titulo = etapas.find(e => e.key === etapaActiva)?.label ?? ETAPA_LABEL[etapaActiva]

  const href = (key: EstrategiaKey) => `/admin/projects/${projectId}/estrategia?etapa=${key}`
  const anterior = posicion > 0
    ? { label: ETAPA_LABEL[ETAPA_ORDER[posicion - 1]], href: href(ETAPA_ORDER[posicion - 1]) }
    : undefined
  const siguiente = posicion < ETAPA_ORDER.length - 1
    ? { label: ETAPA_LABEL[ETAPA_ORDER[posicion + 1]], href: href(ETAPA_ORDER[posicion + 1]) }
    : undefined

  const contenido = contenidoPorEtapa[etapaActiva] ?? null
  const borradorNuevo = contenido?.borradorNuevo ?? null
  // Lo aprobado manda: mientras haya conflicto se ven las dos versiones enteras, sin que
  // ninguna de las dos se pise, hasta que el equipo elija una.
  const enConflicto = !!contenido && !!borradorNuevo && !soloAprobada

  return (
    <div className="min-w-0">
      {enConflicto && contenido && borradorNuevo ? (
        <article>
          <CabeceraEtapa ubicacion={ubicacion} titulo={titulo} />
          {dependencia && <NotaDependencia texto={dependencia} />}
          <div className="mt-8">
            <ComparadorVersiones
              aprobada={{ content: contenido.content, cuando: contenido.cuando }}
              nueva={{ content: borradorNuevo.content, cuando: borradorNuevo.cuando, autor: borradorNuevo.autor }}
              onVerSoloAprobada={() => setSoloAprobada(true)}
              onAprobarNueva={() => aprobarVersion(etapaActiva, borradorNuevo.id)}
              guardando={guardando}
            />
          </div>
          {error && <p className="mt-3 text-[13px] text-[var(--error)]">{error}</p>}
          <Vecinas anterior={anterior} siguiente={siguiente} />
        </article>
      ) : contenido ? (
        <>
          {/* Se está mirando sólo la aprobada, pero el borrador sigue ahí: la vuelta al
              comparador tiene que estar a un clic, no en el historial del navegador. */}
          {borradorNuevo && soloAprobada && (
            <AvisoVersionNueva
              autor={borradorNuevo.autor}
              cuando={borradorNuevo.cuando}
              onVer={() => setSoloAprobada(false)}
            />
          )}
          <EtapaDocumento
            ubicacion={ubicacion}
            titulo={titulo}
            content={contenido.content}
            procedencia={contenido.procedencia}
            aprobada={contenido.aprobada}
            dependencia={dependencia}
            anterior={anterior}
            siguiente={siguiente}
            onAprobar={() => aprobarVersion(etapaActiva, contenido.id)}
            guardando={guardando}
            error={error}
          />
        </>
      ) : (
        <article>
          <CabeceraEtapa ubicacion={ubicacion} titulo={titulo} />
          {dependencia && <NotaDependencia texto={dependencia} />}
          <p className="mt-6 max-w-[60ch] text-[14px] leading-[1.66] text-[var(--secundario)]">
            Esta etapa todavía no tiene una versión guardada. Cuando el equipo la trabaje en Claude,
            el resultado aparece acá para revisar y aprobar.
          </p>
          <Vecinas anterior={anterior} siguiente={siguiente} />
        </article>
      )}
    </div>
  )
}
