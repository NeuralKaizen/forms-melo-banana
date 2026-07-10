import type Anthropic from '@anthropic-ai/sdk'
import type { Competencia, Referente, Eje, Item, RespondentInput, Origen } from '../schema'
import { PREAMBULO, ORIGEN_Y_TRIANGULACION, formatRespondents } from '../prompt-preamble'
import { validarItems } from './problema'
import { callJson } from '../llm'

const GUIA = [
  'PASO 2 — PANORAMA DE LA CATEGORÍA (mapeo de competencia). Ubicá a la marca frente a su',
  'competencia en un mapa de dos ejes:',
  '- competidores: las marcas que el cliente menciona (origen "cliente").',
  '- otrosReferentes: marcas de fuera de la categoría que inspiran, etiquetadas por para qué',
  '  sirven ("referente de marca" / "de comunicación" / "visual"). El formulario casi nunca',
  '  las trae: si faltan, proponelas marcadas como "equipo".',
  '- ejes: EXACTAMENTE 2 ejes de comparación. Casi nunca vienen en el formulario: proponelos',
  '  a partir de lo que el cliente valora, marcados como "equipo".',
  '- posicionActual y posicionIdeal: dónde está hoy la marca y a dónde debería moverse (un Item).',
  '  La posición ideal suele ser aporte del equipo.',
].join('\n')

export function buildCompetenciaPrompt(respondents: RespondentInput[]): string {
  return [
    PREAMBULO, '', GUIA, '', ORIGEN_Y_TRIANGULACION, '',
    '## Respuestas de los respondientes', formatRespondents(respondents), '',
    // El modelo no conoce el tipo Item: si no se le describe, inventa los nombres de
    // campo ("nombre", "descripcion") y el validador rechaza la respuesta.
    'Devolvé SOLO JSON con esta forma (cada Item: {"texto": string, "origen": "cliente"|"equipo"|"pendiente", "cita"?: string}):',
    '{"competidores": Item[], "otrosReferentes": [{"marca": string, "tipo": string, "origen": Origen}],',
    ' "ejes": [{"nombre": string, "extremoIzquierdo": string, "extremoDerecho": string, "origen": Origen}],',
    ' "posicionActual": Item, "posicionIdeal": Item}',
    'Origen es "cliente"|"equipo"|"pendiente". "ejes" debe tener 2 elementos.',
  ].join('\n')
}

const ORIGENES: Origen[] = ['cliente', 'equipo', 'pendiente']
const validarItem = (x: unknown): Item => validarItems([x])[0]

export function validateCompetencia(o: unknown): Competencia {
  const c = o as any
  const otrosReferentes: Referente[] = (Array.isArray(c?.otrosReferentes) ? c.otrosReferentes : []).map((r: any) => {
    if (typeof r?.marca !== 'string' || typeof r?.tipo !== 'string' || !ORIGENES.includes(r?.origen)) throw new Error('Referente inválido')
    return { marca: r.marca, tipo: r.tipo, origen: r.origen }
  })
  const ejes: Eje[] = (Array.isArray(c?.ejes) ? c.ejes : []).map((e: any) => {
    if (typeof e?.nombre !== 'string' || typeof e?.extremoIzquierdo !== 'string'
      || typeof e?.extremoDerecho !== 'string' || !ORIGENES.includes(e?.origen)) throw new Error('Eje inválido')
    return { nombre: e.nombre, extremoIzquierdo: e.extremoIzquierdo, extremoDerecho: e.extremoDerecho, origen: e.origen }
  })
  return {
    competidores: validarItems(c?.competidores), otrosReferentes, ejes,
    posicionActual: validarItem(c?.posicionActual), posicionIdeal: validarItem(c?.posicionIdeal),
  }
}

export function runCompetencia(client: Anthropic, respondents: RespondentInput[]): Promise<Competencia> {
  return callJson(client, buildCompetenciaPrompt(respondents), 3000, validateCompetencia)
}
