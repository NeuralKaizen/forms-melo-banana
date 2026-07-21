import type Anthropic from '@anthropic-ai/sdk'
import type { Perfil, Problema, Personalidad, RespondentInput } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { validarItems } from './problema'
import { callJson } from '../llm'

const GUIA = [
  'PASO 3 — PERFIL DE USUARIO (lado izquierdo del Value Proposition Canvas de Strategyzer).',
  '- jobs (Jobs to be done): necesidades/tareas/problemas que el usuario quiere resolver',
  '  (funcionales, sociales, emocionales). Redactalos como "Quiero poder…".',
  '- gains: beneficios que el usuario desea o que lo sorprenderían.',
  '- pains: riesgos, miedos y obstáculos antes/durante/después del job.',
  'Basate en los dolores del consumidor ya identificados en el problema. No inventes: lo que',
  'no salga, márcalo "pendiente".',
].join('\n')

export function buildPerfilPrompt(respondents: RespondentInput[], problema: Problema, personalidad: Personalidad): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Problema (paso previo)',
    `Consumidor: ${problema.problemaConsumidor.map(i => i.texto).join(' | ') || '—'}`,
    `Arquetipo de marca: ${personalidad.arquetipo}`,
    '', '## Respuestas de los respondientes', formatRespondents(respondents), '',
    'Devolvé SOLO JSON (cada ítem: {"texto": string, "origen": Origen, "cita"?: string}):',
    '{"jobs": Item[], "gains": Item[], "pains": Item[]}',
  ].join('\n')
}

export function validatePerfil(o: unknown): Perfil {
  const p = o as any
  return { jobs: validarItems(p?.jobs), gains: validarItems(p?.gains), pains: validarItems(p?.pains) }
}

export function runPerfil(client: Anthropic, respondents: RespondentInput[], problema: Problema, personalidad: Personalidad): Promise<Perfil> {
  return callJson(client, buildPerfilPrompt(respondents, problema, personalidad), 8000, validatePerfil)
}
