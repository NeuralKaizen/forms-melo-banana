import type { AnyDb } from '@/lib/db/store'
import type { StrategyVersionRow } from '@/lib/db/strategy-store'
import { listStrategyVersions, saveStrategyVersion } from '@/lib/db/strategy-store'
import type { Personalidad } from './schema'

/**
 * Serializado con claves ordenadas para comparar contenidos que pasaron por `jsonb`,
 * donde el orden de las claves no es información. Mismo criterio que usa el store del
 * landscape para decidir si dos versiones dicen lo mismo.
 */
function estable(valor: unknown): string {
  return JSON.stringify(valor, (_clave, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  )
}

/**
 * La personalidad que el motor deriva de las entrevistas pertenece a la fase de
 * Estrategia, no a la pantalla de Propuesta de valor: se guarda como borrador de Claude
 * en la etapa `personalidad`, y entra al circuito de decisión que ya existe (el equipo
 * la ve en "Nos toca", la aprueba o la reescribe; una etapa aprobada no se reabre sola,
 * el borrador queda esperando — reglas de `saveStrategyVersion`).
 *
 * Idempotente por contenido: regenerar el entregable sin que la personalidad cambie no
 * appendea otra versión igual — el historial es del equipo, no del botón "Regenerar".
 * Devuelve la versión creada, o `null` si no había nada nuevo que escribir.
 */
export async function sincronizarPersonalidadEnEstrategia(
  db: AnyDb, projectId: string, personalidad: Personalidad,
): Promise<StrategyVersionRow | null> {
  const [ultima] = await listStrategyVersions(db, projectId, 'personalidad')
  if (ultima && estable(ultima.content) === estable(personalidad)) return null
  return saveStrategyVersion(db, projectId, 'personalidad', {
    content: personalidad,
    author: 'claude',
    authorLabel: 'Generada de las entrevistas',
  })
}
