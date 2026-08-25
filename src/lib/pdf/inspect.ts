// Lector de posiciones de texto de un PDF ya renderizado. Existe para los tests de
// maquetación: react-pdf no expone el layout resuelto, así que la única forma de
// comprobar dónde cayó cada línea es leer los content streams del PDF de salida.
import { inflateSync } from 'node:zlib'

/** Una corrida de texto dibujada en la página, en coordenadas con el origen arriba-izquierda. */
export interface TextRun {
  /** 1-based, en orden de aparición de los content streams. */
  page: number
  x: number
  /** Distancia desde el borde superior de la página hasta la línea base. */
  y: number
  fontSize: number
  text: string
}

type Matrix = [number, number, number, number, number, number]

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ]
}

function decodeHexString(token: string): string {
  const hex = token.slice(1, -1).replace(/\s/g, '')
  let out = ''
  for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  return out
}

const TOKENS = /\[[^\]]*\]|\((?:\\.|[^)\\])*\)|<[0-9a-fA-F\s]*>|[-+]?[\d.]+|\/[^\s/<>[\]()]+|[A-Za-z'"*]+/g
const NUMBER = /^[-+]?[\d.]+$/

/** Interpreta un content stream y devuelve dónde quedó cada corrida de texto. */
function runsInStream(stream: string, page: number, pageHeight: number): TextRun[] {
  const runs: TextRun[] = []
  const saved: Matrix[] = []
  let ctm: Matrix = [1, 0, 0, 1, 0, 0]
  let textMatrix: Matrix | null = null
  let fontSize = 0
  let args: (number | string)[] = []

  for (const token of stream.match(TOKENS) ?? []) {
    if (NUMBER.test(token)) { args.push(parseFloat(token)); continue }
    if (/^[/[(<]/.test(token)) { args.push(token); continue }

    switch (token) {
      case 'q':
        saved.push([...ctm] as Matrix)
        break
      case 'Q':
        ctm = saved.pop() ?? [1, 0, 0, 1, 0, 0]
        break
      case 'cm':
        ctm = multiply(args.slice(-6) as Matrix, ctm)
        break
      case 'Tm':
        textMatrix = args.slice(-6) as Matrix
        break
      case 'Tf':
        fontSize = args[args.length - 1] as number
        break
      case 'Tj':
      case 'TJ': {
        const text = (String(args[args.length - 1]).match(/<[0-9a-fA-F\s]*>/g) ?? []).map(decodeHexString).join('')
        if (textMatrix && text) {
          const placed = multiply(textMatrix, ctm)
          runs.push({ page, x: placed[4], y: pageHeight - placed[5], fontSize, text })
        }
        break
      }
    }
    args = []
  }
  return runs
}

/** Devuelve el cuerpo (ya descomprimido) del objeto `n 0 obj` que sea un stream. */
function streamOf(latin: string, bytes: Buffer, ref: number): string | null {
  const header = new RegExp(`(?:^|[^0-9])${ref} 0 obj\\b`).exec(latin)
  if (!header) return null
  const start = latin.indexOf('stream', header.index)
  if (start < 0) return null
  const from = start + /stream\r?\n/.exec(latin.slice(start))![0].length
  const to = latin.indexOf('endstream', from)
  if (to < 0) return null
  try {
    return inflateSync(bytes.subarray(from, to)).toString('latin1')
  } catch {
    return bytes.subarray(from, to).toString('latin1')
  }
}

/**
 * Extrae todas las corridas de texto de un PDF renderizado por react-pdf, en orden de página.
 * Sigue `/Kids` del árbol de páginas: el orden en que se escriben los objetos no es el orden
 * en que se leen las páginas.
 */
export function textRuns(pdf: Uint8Array): TextRun[] {
  const bytes = Buffer.from(pdf)
  const latin = bytes.toString('latin1')

  const kids = /\/Kids \[([^\]]*)\]/.exec(latin)
  if (!kids) throw new Error('el PDF no tiene árbol de páginas')
  const pageRefs = [...kids[1].matchAll(/(\d+) 0 R/g)].map(m => Number(m[1]))

  const runs: TextRun[] = []
  pageRefs.forEach((pageRef, index) => {
    const objects = new RegExp(`(?:^|[^0-9])${pageRef} 0 obj([\\s\\S]*?)endobj`).exec(latin)
    if (!objects) throw new Error(`no encuentro la página ${pageRef}`)
    const dict = objects[1]

    const media = /\/MediaBox \[[\d.]+ [\d.]+ [\d.]+ ([\d.]+)\]/.exec(dict)
    const contents = /\/Contents (\d+) 0 R/.exec(dict)
    if (!media || !contents) throw new Error(`página ${pageRef} sin MediaBox o Contents`)

    const stream = streamOf(latin, bytes, Number(contents[1]))
    if (stream) runs.push(...runsInStream(stream, index + 1, Number(media[1])))
  })
  return runs
}

/** Alto de una página A4 en puntos, que es el tamaño que usa el brief. */
export const A4_HEIGHT = 841.89
