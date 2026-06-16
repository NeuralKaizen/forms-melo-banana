import { getSessionWithAnswers, setNormalized } from '../db/store'
import { normalizeText } from './normalizer'

type AnyDb = any

// Normaliza perezosamente las respuestas de una sesión que aún no lo están.
// Best-effort e idempotente. Devuelve las respuestas con normalizedText poblado.
export async function ensureNormalized(db: AnyDb, sessionId: string) {
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) return []
  for (const a of full.answers) {
    if (a.normalizedText != null) continue
    const raw = (a.rawText ?? '').trim()
    if (!raw || raw === '—') continue
    const norm = await normalizeText(a.rawText)
    if (norm == null) continue
    await setNormalized(db, a.id, norm)
    a.normalizedText = norm
  }
  return full.answers
}
