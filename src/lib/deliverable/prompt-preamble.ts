import { SCRIPT } from '@/lib/script/questions'
import type { RespondentInput } from './schema'

const promptOf = (qid: string) =>
  SCRIPT.flatMap(s => s.questions).find(q => q.id === qid)?.prompt ?? qid

export const PREAMBULO = [
  'Sos estratega de marca en Melo & Banana. Convertís las respuestas crudas de las',
  'entrevistas proyectivas de un cliente en el insumo del Taller de Propuesta de Valor.',
  '',
  'REGLA DE ORO: el análisis se construye sobre lo que el cliente DIJO, no inventás sobre',
  'lo que imaginás. Si el cliente no lo respondió, no existe todavía: se marca como pendiente del',
  'taller. Lo que aporte el equipo (referentes, ejes de comparación, posición ideal) se',
  'marca como propuesta del equipo, nunca como dato del cliente.',
  '',
  'TONO: español colombiano, directo y profesional. Conservá el vocabulario del cliente',
  '(si dice "queremos que la gente nos sienta cercanos", no lo traduzcas a jerga). Apoyá',
  'los puntos clave con citas textuales. Nada de lenguaje publicitario ni promesas',
  'grandilocuentes: esto es análisis, no aviso. Sin términos rebuscados (los del canvas',
  '—JTBD, gains, pains— sí se usan).',
].join('\n')

export const ORIGEN_Y_TRIANGULACION = [
  'MARCADO DE ORIGEN — cada ítem generado lleva "origen":',
  '- "cliente": lo dijo el cliente en la entrevista (idealmente con cita textual en "cita").',
  '- "equipo": lo propone el equipo de estrategia (referentes, ejes, posición ideal). Nunca',
  '  lo presentes como dato del cliente.',
  '- "pendiente": no salió en la entrevista y no lo inventás; queda para resolver en el taller.',
  '',
  'TRIANGULACIÓN entre respondientes: lo que casi todos repiten es señal fuerte (va como',
  'hecho). Donde se contradicen es una TENSIÓN a nombrar explícitamente, no a promediar ni',
  'esconder; muchas veces esa tensión ES el hallazgo. Con un solo respondiente no fuerces',
  'tensiones inexistentes.',
].join('\n')

export function formatRespondents(respondents: RespondentInput[]): string {
  return respondents.map((r, i) => {
    const head = `### Respondiente ${i + 1}: ${r.respondentName || 'sin nombre'} — ${r.role || 'cargo no indicado'}`
    const lines = r.answers.map(a =>
      `- ${promptOf(a.questionId)}\n  ${a.text}${a.imageChoice ? ` (eligió: ${a.imageChoice})` : ''}`)
    return [head, ...lines].join('\n')
  }).join('\n\n')
}
