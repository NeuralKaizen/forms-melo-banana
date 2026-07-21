import type Anthropic from '@anthropic-ai/sdk'
import type { Personalidad, RespondentInput } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { callJson } from '../llm'

const GUIA = [
  'PASO — LECTURA PROYECTIVA (personalidad de marca).',
  'La mitad de la entrevista son metáforas proyectivas (animal, color, género, edad, olor,',
  'estilo, ciudad). No son relleno: son la vía para sacar la personalidad sin que el cliente',
  'la racionalice.',
  '- Sintetizá cada metáfora a través de TODOS los respondientes, no una por una. Buscá el',
  '  patrón (si casi todos dicen "perro" → leal, social, cercano).',
  '- Leé el PORQUÉ, no solo la elección: el valor está en la justificación.',
  '- Nombrá las tensiones: si en género unos dicen hombre y otros mujer, no promedies;',
  '  interpretá (p. ej. "marca neutra, ni masculina ni femenina").',
  'Entregá: arquetipo/temperamento, atributos que se repiten, qué NO quiere ser la marca,',
  'y las tensiones a resolver en el taller.',
].join('\n')

export function buildPersonalidadPrompt(respondents: RespondentInput[]): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Respuestas de los respondientes', formatRespondents(respondents), '',
    'Devolvé SOLO JSON con esta forma:',
    '{"arquetipo": string, "atributos": string[], "queNoQuiereSer": string[], "tensiones": string[]}',
  ].join('\n')
}

export function validatePersonalidad(o: unknown): Personalidad {
  const p = o as any
  const arr = (x: unknown) => Array.isArray(x) && x.every(i => typeof i === 'string')
  if (typeof p?.arquetipo !== 'string' || !arr(p.atributos) || !arr(p.queNoQuiereSer) || !arr(p.tensiones))
    throw new Error('Personalidad con forma inválida')
  return { arquetipo: p.arquetipo, atributos: p.atributos, queNoQuiereSer: p.queNoQuiereSer, tensiones: p.tensiones }
}

export function runPersonalidad(client: Anthropic, respondents: RespondentInput[]): Promise<Personalidad> {
  return callJson(client, buildPersonalidadPrompt(respondents), 4000, validatePersonalidad)
}
