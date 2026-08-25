// @vitest-environment node
// Maquetación del brief con respuestas largas: es el caso que rompía en producción
// (respuestas normalizadas de varios párrafos, más largas que una página).
import { describe, it, expect, vi } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { BriefDocument } from './BriefDocument'
import { textRuns, A4_HEIGHT, type TextRun } from './inspect'
import type { BriefView } from './answers-view'

const PARAGRAPH =
  'La Feria Internacional Colombia Náutica fue concebida en su primera versión como un proyecto ' +
  'estratégico para posicionar a Cartagena de Indias y a Colombia como plataforma líder del turismo ' +
  'náutico y la industria marítima recreativa en América Latina. La iniciativa surgió de una alianza ' +
  'entre Grupo Heroica, AsoNáutica y la National Marine Manufacturers Association, con el propósito ' +
  'de crear un evento anual especializado que integrara exhibición comercial, networking B2B, ' +
  'formación, experiencias náuticas y promoción del destino.'

/** Una respuesta de varias páginas, como las que devuelve la normalización. */
const VERY_LONG = Array.from({ length: 8 }, () => PARAGRAPH).join('\n\n')

const view: BriefView = {
  company: 'Grupo Heroica - Centro de Convenciones Cartagena de Indias',
  contact: 'Diana Rodriguez · Gerente General',
  email: 'diana.rodriguez@cccartagena.com',
  date: '24 ago 2026',
  sections: [
    { title: 'Contexto del proyecto', items: [
      { prompt: 'Haz una breve descripción de la compañía o proyecto, incluyendo su historia.', answer: VERY_LONG },
      { prompt: '¿Qué productos o servicios ofertas?', answer: VERY_LONG },
    ] },
    { title: 'Mercado y competencia', items: [
      { prompt: '¿Qué hace la competencia?', answer: PARAGRAPH },
    ] },
  ],
  projective: [{ label: 'Animal', value: 'Caballo' }],
  projectiveReasons: [{ prompt: 'Animal · Caballo', answer: PARAGRAPH }],
}

// Márgenes del documento: 40pt a los lados y 46pt abajo, que es donde vive el pie.
const SIDE = 40
const BOTTOM = A4_HEIGHT - 46

async function render(): Promise<TextRun[]> {
  const buffer = await renderToBuffer(<BriefDocument view={view} />)
  return textRuns(buffer)
}

describe('maquetación del brief con respuestas largas', () => {
  it('no deja bloques que react-pdf no pueda partir entre páginas', async () => {
    // react-pdf avisa por consola cuando un bloque `wrap={false}` es más alto que una
    // página: no puede partirlo, así que lo dibuja desbordado. La redacción del aviso es
    // un string interno de la librería; el canario que la vigila vive en
    // `src/lib/deck/preview.test.tsx` ("react-pdf sigue avisando...").
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await renderToBuffer(<BriefDocument view={view} />)
    const avisos = warn.mock.calls.flat().join(' ')
    warn.mockRestore()

    expect(avisos).not.toContain("can't wrap between pages")
  })

  it('no dibuja nada fuera de la caja de contenido', async () => {
    const runs = await render()
    // El pie es lo único que vive por debajo del límite inferior.
    const body = runs.filter(r => r.fontSize > 9)
    const outside = body.filter(r => r.y > BOTTOM || r.y < 0 || r.x < SIDE - 1)

    expect(outside.map(r => `p${r.page} y=${r.y.toFixed(0)} ${r.text.slice(0, 40)}`)).toEqual([])
  })

  it('no deja páginas casi vacías en medio del documento', async () => {
    const runs = await render()
    const pages = [...new Set(runs.map(r => r.page))].sort((a, b) => a - b)
    const last = pages[pages.length - 1]

    const underfilled = pages
      .filter(p => p !== last)
      .map(p => ({ page: p, bottom: Math.max(...runs.filter(r => r.y < BOTTOM && r.page === p).map(r => r.y)) }))
      .filter(p => p.bottom < A4_HEIGHT * 0.6)

    expect(underfilled).toEqual([])
  })
})
