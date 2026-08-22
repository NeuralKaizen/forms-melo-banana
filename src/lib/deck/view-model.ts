import type { Deliverable, Item, Origen, FilaValor, PartKey } from '@/lib/deliverable/schema'
import { citaVerificada } from './text'

export interface DeckItem { texto: string; origen: Origen; cita: string | null }
/**
 * `error` marca un bloque cuyo insumo no se generó (por ejemplo, el perfil
 * cuando el resto de la sección sí se generó): en ese caso `parrafo` e
 * `items` van vacíos y el renderizador muestra el error en su lugar.
 */
export interface DeckBlock { titulo: string; parrafo: string | null; items: DeckItem[]; error?: string | null }
/**
 * `error` marca la sección entera como no generada (todos sus insumos
 * fallaron); `tablaError` marca sólo la tabla JTBD cuando su insumo
 * (propuestaValor) falló pero el resto de la sección sí se generó.
 */
export interface DeckSection { numero: number; titulo: string; error: string | null; blocks: DeckBlock[]; tabla: FilaValor[]; tablaError: string | null }
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

/** Bloque cuyo insumo no se generó: sin párrafo ni ítems, con el motivo visible. */
function bloqueError(titulo: string, error: string): DeckBlock {
  return { titulo, parrafo: null, items: [], error }
}

function seccion(
  numero: number,
  titulo: string,
  error: string | null,
  blocks: DeckBlock[],
  tabla: FilaValor[] = [],
  tablaError: string | null = null,
): DeckSection {
  return {
    numero,
    titulo,
    error,
    blocks: error ? [] : blocks,
    tabla: error ? [] : tabla,
    tablaError: error ? null : tablaError,
  }
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
  const enBlanco = (v: string | undefined) => (v ?? '').trim().length === 0
  const referentes: DeckItem[] = (c?.otrosReferentes ?? [])
    .filter(r => !enBlanco(r.marca))
    .map(r => ({
      texto: `${r.marca} — ${r.tipo}`, origen: r.origen, cita: null,
    }))
  const ejes: DeckItem[] = (c?.ejes ?? [])
    .filter(e => !enBlanco(e.nombre) && !enBlanco(e.extremoIzquierdo) && !enBlanco(e.extremoDerecho))
    .map(e => ({
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
  // El perfil y la propuesta de valor son insumos independientes: si uno
  // falla, el contenido bueno del otro se conserva y se imprime, marcando
  // sólo la parte que falló. La sección entera se da por errada únicamente
  // si fallan los dos (no queda nada bueno que mostrar).
  const perf = d.perfil?.data
  const pv = d.propuestaValor?.data
  const errPerfil = errorDe(d.perfil)
  const errPropuestaValor = errorDe(d.propuestaValor)
  const err3 = !perf && !pv ? `${errPerfil} ${errPropuestaValor}` : null

  const bloquesPerfil: DeckBlock[] = perf
    ? [
        bloque('Jobs to be done', items(perf.jobs, corpus)),
        bloque('Gains', items(perf.gains, corpus)),
        bloque('Pains', items(perf.pains, corpus)),
      ]
    : [bloqueError('Jobs to be done, Gains y Pains', errPerfil ?? 'Esta parte no se generó.')]

  // Sin bloque de síntesis: la propuesta de valor es la tabla. Si su insumo falló, el
  // motivo viaja en `tablaError`, así que no se pierde señal al no haber otro bloque.
  const s3 = seccion(
    3,
    'Perfil de usuario y Propuesta de Valor',
    err3,
    bloquesPerfil,
    pv?.filas ?? [],
    pv ? null : (errPropuestaValor ?? 'Esta parte no se generó.'),
  )

  return {
    marca: projectName,
    fecha: fmtFecha(now),
    completo: faltantes.length === 0,
    faltantes,
    secciones: [s1, s2, s3],
  }
}
