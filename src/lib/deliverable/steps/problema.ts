import type Anthropic from '@anthropic-ai/sdk'
import type { Problema, Personalidad, Item, RespondentInput, Origen } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { callJson } from '../llm'

const GUIA = [
  'PASO 1 — DECLARACIÓN DEL PROBLEMA. Definí el problema que la marca resuelve, en dos',
  'planos, y justificalo. Bloques:',
  '- problemaMundo: contexto y tensión que vive la gente/el mercado (un párrafo).',
  '- problemaMarca: qué le pasa puntualmente a ESTA marca, dónde está atascada (un párrafo).',
  '- problemaConsumidor: los dolores concretos de las personas/empresas, en sus palabras (ítems).',
  '- comoLoHacemos: cómo hacerlo, la vía de solución + pistas de identidad y comunicación (tono, qué NO',
  '  quiere ser la marca, atributos a evitar). USÁ la lectura de personalidad de abajo (ítems).',
  '- porQueRelevante: qué se desbloquea, el impacto (ítems).',
].join('\n')

export const validarItems = (x: unknown): Item[] => {
  if (!Array.isArray(x)) throw new Error('se esperaba lista de Items')
  const ok: Origen[] = ['cliente', 'equipo', 'pendiente']
  return x.map((i: any) => {
    if (typeof i?.texto !== 'string' || !ok.includes(i?.origen)) throw new Error('Item inválido')
    return { texto: i.texto, origen: i.origen, cita: typeof i.cita === 'string' ? i.cita : null }
  })
}

export function buildProblemaPrompt(respondents: RespondentInput[], personalidad: Personalidad): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Lectura de personalidad (paso previo, ya sintetizada)',
    `Arquetipo: ${personalidad.arquetipo}. Atributos: ${personalidad.atributos.join(', ')}.`,
    `Qué NO quiere ser: ${personalidad.queNoQuiereSer.join(', ')}. Tensiones: ${personalidad.tensiones.join(', ') || 'ninguna'}.`,
    '', '## Respuestas de los respondientes', formatRespondents(respondents), '',
    'Devolvé SOLO JSON con esta forma (cada ítem: {"texto": string, "origen": "cliente"|"equipo"|"pendiente", "cita"?: string}):',
    '{"problemaMundo": string, "problemaMarca": string, "problemaConsumidor": Item[], "comoLoHacemos": Item[], "porQueRelevante": Item[]}',
  ].join('\n')
}

export function validateProblema(o: unknown): Problema {
  const p = o as any
  if (typeof p?.problemaMundo !== 'string' || typeof p?.problemaMarca !== 'string')
    throw new Error('Problema: párrafos faltantes')
  return {
    problemaMundo: p.problemaMundo, problemaMarca: p.problemaMarca,
    problemaConsumidor: validarItems(p.problemaConsumidor),
    comoLoHacemos: validarItems(p.comoLoHacemos),
    porQueRelevante: validarItems(p.porQueRelevante),
  }
}

export function runProblema(client: Anthropic, respondents: RespondentInput[], personalidad: Personalidad): Promise<Problema> {
  return callJson(client, buildProblemaPrompt(respondents, personalidad), 8000, validateProblema)
}
