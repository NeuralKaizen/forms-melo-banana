import { SCRIPT } from '@/lib/script/questions'

const promptOf = (qid: string) =>
  SCRIPT.flatMap(s => s.questions).find(q => q.id === qid)?.prompt ?? qid

export function buildBriefPrompt(
  session: { name?: string; company?: string },
  answers: { questionId: string; rawText: string; imageChoice: string | null }[],
): string {
  const lines = answers.map(a =>
    `### ${promptOf(a.questionId)}\n${a.rawText}${a.imageChoice ? ` (eligió: ${a.imageChoice})` : ''}`)
  return [
    `Sos estratega de marca en Mellow & Banana. Resumí esta entrevista proyectiva de "${session.company ?? 'el cliente'}" en un brief claro y accionable.`,
    `Devolvé SOLO JSON con esta forma: {"resumen": string, "secciones": [{"titulo": string, "puntos": string[]}], "alertas": string[]}.`,
    `"alertas" = respuestas pobres o faltantes que el equipo debería repreguntar.`,
    ``,
    `## Respuestas`,
    ...lines,
  ].join('\n')
}
