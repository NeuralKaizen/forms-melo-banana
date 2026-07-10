// @vitest-environment node
// Smoke test + preview: renderiza el deck completo y lo escribe a disco.
//   npx vitest run src/lib/deck/preview.test.tsx
// Salida: tmp/deck-completo.pdf
import { describe, it, expect, vi } from 'vitest'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { DeckDocument } from './DeckDocument'
import { buildDeckView } from './view-model'
import type { Deliverable } from '@/lib/deliverable/schema'

const NOW = new Date('2026-07-10T12:00:00')
const CORPUS = ['Queremos que la gente se sienta acompañada, no vendida y que se quede a conversar.']
const ok = <T,>(data: T) => ({ data, meta: { generatedAt: NOW.toISOString(), error: null } })
const item = (texto: string, origen: 'cliente' | 'equipo' | 'pendiente' = 'cliente', cita?: string) =>
  ({ texto, origen, cita: cita ?? null })

const D: Deliverable = {
  problema: ok({
    problemaMundo: 'Las cafeterías de especialidad se volvieron intercambiables entre sí.',
    problemaMarca: 'Cafe Lunar tiene alma de barrio pero se comunica como una cadena.',
    problemaConsumidor: [item('No encuentra dónde quedarse a conversar', 'cliente', 'que se quede a conversar')],
    comoLoHacemos: [item('Diseñamos el local alrededor de la charla, no del consumo rápido')],
    porQueRelevante: [item('La categoría compite por velocidad y deja libre el territorio del vínculo', 'equipo')],
  }),
  competencia: ok({
    competidores: [item('Starbucks'), item('Juan Valdez')],
    otrosReferentes: [
      { marca: 'Aesop', tipo: 'referente visual', origen: 'equipo' as const },
      { marca: 'Mercado Libre', tipo: 'referente de comunicación', origen: 'equipo' as const },
    ],
    ejes: [
      { nombre: 'cercanía', extremoIzquierdo: 'transaccional', extremoDerecho: 'vincular', origen: 'equipo' as const },
      { nombre: 'ritmo', extremoIzquierdo: 'rápido', extremoDerecho: 'pausado', origen: 'equipo' as const },
    ],
    posicionActual: item('Percibidos como una cafetería más de la cuadra'),
    posicionIdeal: item('El lugar del barrio donde uno se queda', 'equipo'),
  }),
  perfil: ok({
    jobs: [item('Quiero un lugar donde quedarme a conversar sin apuro'), item('Quiero sentir que me reconocen')],
    gains: [item('Que el barista sepa mi nombre')],
    pains: [item('Cafeterías impersonales donde te apuran'), item('No hay dónde sentarse a charlar')],
  }),
  propuestaValor: ok({
    formula: { marca: 'Cafe Lunar', verbo: 'creamos', razonDeSer: 'un lugar donde la conversación tiene tiempo', beneficioCentral: 'el café del barrio con alma' },
    filas: [
      { job: 'Quedarme a conversar sin apuro', solucion: 'Mesas comunales y sin límite de tiempo', comoSeResuelve: 'El local se diseña para la charla larga, no para la rotación.', origen: 'cliente' as const },
      { job: 'Sentir que me reconocen', solucion: 'Baristas fijos que aprenden nombres', comoSeResuelve: 'Equipo estable, no rotativo; se premia la permanencia.', origen: 'equipo' as const },
    ],
  }),
}

describe('DeckDocument', () => {
  it('renderiza un PDF válido y lo escribe en tmp/deck-completo.pdf', async () => {
    const view = buildDeckView({ projectName: 'Cafe Lunar', deliverable: D, corpus: CORPUS, now: NOW })
    const buffer = await renderToBuffer(<DeckDocument view={view} />)

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(1000)

    const out = resolve(process.cwd(), 'tmp/deck-completo.pdf')
    await mkdir(resolve(process.cwd(), 'tmp'), { recursive: true })
    await writeFile(out, buffer)
    console.log(`\n✓ PDF escrito en ${out} (${buffer.length} bytes)\n`)
  })

  it('renderiza sin explotar aunque una parte haya fallado', async () => {
    const roto: Deliverable = { ...D, competencia: { data: null, meta: { generatedAt: NOW.toISOString(), error: 'Error: 402 sin crédito' } } }
    const view = buildDeckView({ projectName: 'Cafe Lunar', deliverable: roto, corpus: CORPUS, now: NOW })
    const buffer = await renderToBuffer(<DeckDocument view={view} />)
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('una fila de la tabla JTBD con un párrafo muy largo desborda a una página nueva en vez de recortarse', async () => {
    // `comoSeResuelve` es texto libre generado por un LLM, sin tope de longitud.
    // La fila no debe usar wrap={false}: si lo hiciera, un párrafo más alto que
    // una página entera no podría partirse y react-pdf lo recortaría (y avisa
    // con el warning "can't wrap between pages ... bigger than available page
    // height"). Repetimos el texto lo suficiente como para superar el alto de
    // una página completa, no sólo el espacio restante de la página actual.
    const parrafoLargo = 'El local se diseña para la charla larga, no para la rotación. '.repeat(150)
    const conFilaLarga: Deliverable = {
      ...D,
      propuestaValor: ok({
        ...D.propuestaValor!.data!,
        filas: [
          { job: 'Quedarme a conversar sin apuro', solucion: 'Mesas comunales y sin límite de tiempo', comoSeResuelve: parrafoLargo, origen: 'cliente' as const },
        ],
      }),
    }

    const viewCorto = buildDeckView({ projectName: 'Cafe Lunar', deliverable: D, corpus: CORPUS, now: NOW })
    const viewLargo = buildDeckView({ projectName: 'Cafe Lunar', deliverable: conFilaLarga, corpus: CORPUS, now: NOW })

    const bufferCorto = await renderToBuffer(<DeckDocument view={viewCorto} />)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bufferLargo = await renderToBuffer(<DeckDocument view={viewLargo} />)

    expect(bufferLargo.subarray(0, 4).toString()).toBe('%PDF')

    // Sin wrap={false} en la fila, react-pdf puede partir el contenido entre
    // páginas y no emite este warning de recorte.
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain("can't wrap between pages")
    warnSpy.mockRestore()

    const contarPaginas = (buf: Buffer) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    expect(contarPaginas(bufferLargo)).toBeGreaterThan(contarPaginas(bufferCorto))
  })
})
