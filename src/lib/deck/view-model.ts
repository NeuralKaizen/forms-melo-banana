import type { Deliverable, Item, Origen, FilaValor, PartKey } from '@/lib/deliverable/schema'
import { citaVerificada } from './text'

export interface DeckItem { texto: string; origen: Origen; cita: string | null }
export interface DeckBlock { titulo: string; parrafo: string | null; items: DeckItem[] }
export interface DeckSection { numero: number; titulo: string; error: string | null; blocks: DeckBlock[]; tabla: FilaValor[] }
export interface DeckView { marca: string; fecha: string; completo: boolean; faltantes: PartKey[]; secciones: DeckSection[] }

/** Partes que SÍ se imprimen. `personalidad` es insumo interno del motor. */
const PARTES_IMPRESAS: PartKey[] = ['problema', 'competencia', 'perfil', 'propuestaValor']

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fmtFecha(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

const PENDIENTE: DeckItem = { texto: 'Pendiente del taller', origen: 'pendiente', cita: null }

/**
 * Verifica las citas y descarta los ítems cuyo texto esté vacío o sea sólo
 * espacios (el análisis los puede generar como huecos). Si la lista queda
 * vacía tras el descarte, deja un ítem pendiente.
 */
function items(list: Item[] | undefined, corpus: string[]): DeckItem[] {
  const out = (list ?? [])
    .filter(i => (i?.texto ?? '').trim().length > 0)
    .map(i => ({
      texto: i.texto,
      origen: i.origen,
      cita: citaVerificada(i.cita, corpus),
    }))
  return out.length ? out : [PENDIENTE]
}

function bloque(titulo: string, items: DeckItem[]): DeckBlock {
  return { titulo, parrafo: null, items }
}

function parrafo(titulo: string, texto: string | undefined): DeckBlock {
  const t = (texto ?? '').trim()
  return t
    ? { titulo, parrafo: t, items: [] }
    : { titulo, parrafo: null, items: [PENDIENTE] }
}

function seccion(numero: number, titulo: string, error: string | null, blocks: DeckBlock[], tabla: FilaValor[] = []): DeckSection {
  return { numero, titulo, error, blocks: error ? [] : blocks, tabla: error ? [] : tabla }
}

const errorDe = (parte: { data: unknown; meta: { error?: string | null } } | undefined): string | null =>
  parte?.data ? null : (parte?.meta?.error ?? 'Esta parte no se generó.')

export function buildDeckView(input: {
  projectName: string
  deliverable: Deliverable
  corpus: string[]
  now: Date
}): DeckView {
  const { projectName, deliverable: d, corpus, now } = input

  const faltantes = PARTES_IMPRESAS.filter(k => !d[k]?.data)

  // Parte 1 — Declaración del problema
  const p = d.problema?.data
  const s1 = seccion(1, 'Declaración del problema', errorDe(d.problema), [
    parrafo('El problema en el mundo', p?.problemaMundo),
    parrafo('El problema como marca', p?.problemaMarca),
    bloque('El problema del consumidor', items(p?.problemaConsumidor, corpus)),
    bloque('Cómo lo resolvemos', items(p?.comoLoHacemos, corpus)),
    bloque('Por qué es relevante', items(p?.porQueRelevante, corpus)),
  ])

  // Parte 2 — Panorama de la categoría
  const c = d.competencia?.data
  const referentes: DeckItem[] = (c?.otrosReferentes ?? []).map(r => ({
    texto: `${r.marca} — ${r.tipo}`, origen: r.origen, cita: null,
  }))
  const ejes: DeckItem[] = (c?.ejes ?? []).map(e => ({
    // Sin flechas ni símbolos fuera de WinAnsi/cp1252: el carácter ↔ (U+2194)
    // no existe en Helvetica/Times sin registrar y se imprime como comilla basura.
    texto: `${e.nombre}: de ${e.extremoIzquierdo} a ${e.extremoDerecho}`, origen: e.origen, cita: null,
  }))
  const s2 = seccion(2, 'Panorama de la categoría', errorDe(d.competencia), [
    bloque('Competidores principales', items(c?.competidores, corpus)),
    bloque('Otros referentes', referentes.length ? referentes : [PENDIENTE]),
    bloque('Variables de comparación', ejes.length ? ejes : [PENDIENTE]),
    bloque('Posición actual', items(c?.posicionActual ? [c.posicionActual] : [], corpus)),
    bloque('Posición ideal', items(c?.posicionIdeal ? [c.posicionIdeal] : [], corpus)),
  ])

  // Parte 3 — Perfil de usuario y Propuesta de Valor
  const perf = d.perfil?.data
  const pv = d.propuestaValor?.data
  // La sección 3 falla si falla cualquiera de sus dos insumos; si fallan los
  // dos, se muestran ambos errores en vez de descartar uno.
  const errPerfil = errorDe(d.perfil)
  const errPropuestaValor = errorDe(d.propuestaValor)
  const err3 = errPerfil && errPropuestaValor
    ? `${errPerfil} ${errPropuestaValor}`
    : (errPerfil ?? errPropuestaValor)
  const f = pv?.formula
  const sintesis = f ? `En ${f.marca}, ${f.verbo} ${f.razonDeSer}. Somos ${f.beneficioCentral}.` : undefined
  const s3 = seccion(3, 'Perfil de usuario y Propuesta de Valor', err3, [
    bloque('Jobs to be done', items(perf?.jobs, corpus)),
    bloque('Gains', items(perf?.gains, corpus)),
    bloque('Pains', items(perf?.pains, corpus)),
    parrafo('Síntesis', sintesis),
  ], pv?.filas ?? [])

  return {
    marca: projectName,
    fecha: fmtFecha(now),
    completo: faltantes.length === 0,
    faltantes,
    secciones: [s1, s2, s3],
  }
}
