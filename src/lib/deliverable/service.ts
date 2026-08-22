import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/client'
import { getProjectWithSessions, getSessionWithAnswers, saveDeliverable, getDeliverable } from '@/lib/db/store'
import { ensureNormalized } from '@/lib/normalize/service'
import { generateDeliverable } from './generator'
import { sincronizarPersonalidadEnEstrategia } from './sync-estrategia'
import type { Deliverable, PartKey, RespondentInput } from './schema'

export async function generateProjectDeliverable(projectId: string, opts: { part?: PartKey } = {}): Promise<Deliverable> {
  const project = await getProjectWithSessions(db, projectId)
  if (!project) throw new Error('proyecto no encontrado')

  const built = await Promise.all((project.sessions as { id: string; name?: string | null; role?: string | null }[]).map(async (s) => {
    await ensureNormalized(db, s.id)
    const full = await getSessionWithAnswers(db, s.id)
    if (!full) return null
    return {
      respondentName: s.name ?? '',
      role: s.role ?? '',
      answers: (full.answers as { questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }[])
        .map(a => ({ questionId: a.questionId, text: a.normalizedText ?? a.rawText, imageChoice: a.imageChoice ?? null })),
    }
  }))
  const respondents: RespondentInput[] = built.filter(Boolean) as RespondentInput[]

  if (respondents.length === 0) throw new Error('el proyecto no tiene respondientes')

  const client = new Anthropic({
    authToken: process.env.OPENROUTER_API_KEY!,
    // el SDK añade /v1/messages; el baseURL NO debe incluir /v1 o pega a /api/v1/v1
    baseURL: 'https://openrouter.ai/api',
    defaultHeaders: { 'X-Title': 'Melo & Banana' },
  })

  const prev = (await getDeliverable(db, projectId))?.content as Deliverable | undefined
  const content = await generateDeliverable(client, respondents,
    opts.part ? { only: opts.part, prev: prev ?? {} } : { prev: prev ?? {} })
  await saveDeliverable(db, projectId, content)

  // La personalidad generada vive en Estrategia (borrador de Claude en su etapa), no en
  // la pantalla de Propuesta. Es un efecto del guardado, nunca su condición: si falla,
  // el entregable ya quedó guardado y el error va al log.
  if (content.personalidad?.data) {
    try {
      await sincronizarPersonalidadEnEstrategia(db, projectId, content.personalidad.data)
    } catch (e) {
      console.error('sync de personalidad a estrategia falló:', e)
    }
  }
  return content
}
