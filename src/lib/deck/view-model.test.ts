import { describe, it, expect } from 'vitest'
import { buildDeckView } from './view-model'
import type { Deliverable } from '@/lib/deliverable/schema'

const NOW = new Date('2026-07-10T12:00:00')
const CORPUS = ['Queremos que la gente se sienta acompañada, no vendida.']

const item = (texto: string, origen: 'cliente' | 'equipo' | 'pendiente' = 'cliente', cita?: string) =>
  ({ texto, origen, cita: cita ?? null })

const ok = <T,>(data: T) => ({ data, meta: { generatedAt: NOW.toISOString(), error: null } })
const fail = (error: string) => ({ data: null, meta: { generatedAt: NOW.toISOString(), error } })

const COMPLETO: Deliverable = {
  personalidad: ok({ arquetipo: 'El Cuidador', atributos: ['cálido'], queNoQuiereSer: ['frío'], tensiones: [] }),
  problema: ok({
    problemaMundo: 'La gente desconfía de las marcas.',
    problemaMarca: 'Nos ven como un commodity.',
    problemaConsumidor: [item('No sabe a quién creerle', 'cliente', 'la gente se sienta acompañada')],
    comoLoHacemos: [item('Acompañamos, no vendemos')],
    porQueRelevante: [item('El mercado se comoditiza', 'equipo')],
  }),
  competencia: ok({
    competidores: [item('Starbucks')],
    otrosReferentes: [{ marca: 'Aesop', tipo: 'referente visual', origen: 'equipo' as const }],
    ejes: [{ nombre: 'cercanía', extremoIzquierdo: 'frío', extremoDerecho: 'cálido', origen: 'equipo' as const }],
    posicionActual: item('Percibidos como uno más'),
    posicionIdeal: item('El café del barrio con alma', 'equipo'),
  }),
  perfil: ok({
    jobs: [item('Quiero un lugar donde quedarme a conversar')],
    gains: [item('Sentirse reconocido')],
    pains: [item('Cafeterías impersonales')],
  }),
  propuestaValor: ok({
    formula: { marca: 'Cafe Lunar', verbo: 'creamos', razonDeSer: 'un lugar para quedarse', beneficioCentral: 'el café del barrio con alma' },
    filas: [{ job: 'Quedarme a conversar', solucion: 'Mesas comunales', comoSeResuelve: 'Diseñamos el local para la charla', origen: 'cliente' as const }],
  }),
}

describe('buildDeckView', () => {
  it('arma tres secciones numeradas, sin la personalidad', () => {
    const v = buildDeckView({ projectName: 'Cafe Lunar', deliverable: COMPLETO, corpus: CORPUS, now: NOW })
    expect(v.secciones.map(s => s.numero)).toEqual([1, 2, 3])
    expect(v.secciones.map(s => s.titulo)).toEqual([
      'Declaración del problema',
      'Panorama de la categoría',
      'Perfil de usuario y Propuesta de Valor',
    ])
    expect(JSON.stringify(v)).not.toContain('Cuidador')
  })

  it('marca el entregable como completo y sin faltantes', () => {
    const v = buildDeckView({ projectName: 'Cafe Lunar', deliverable: COMPLETO, corpus: CORPUS, now: NOW })
    expect(v.completo).toBe(true)
    expect(v.faltantes).toEqual([])
  })

  it('conserva la cita que aparece textual en el corpus', () => {
    const v = buildDeckView({ projectName: 'Cafe Lunar', deliverable: COMPLETO, corpus: CORPUS, now: NOW })
    const bloque = v.secciones[0].blocks.find(b => b.titulo === 'El problema del consumidor')!
    expect(bloque.items[0].cita).toBe('la gente se sienta acompañada')
  })

  it('descarta una cita inventada pero conserva el texto del ítem', () => {
    const conCitaFalsa: Deliverable = {
      ...COMPLETO,
      problema: ok({
        ...COMPLETO.problema!.data!,
        problemaConsumidor: [item('No sabe a quién creerle', 'cliente', 'somos líderes indiscutidos')],
      }),
    }
    const v = buildDeckView({ projectName: 'X', deliverable: conCitaFalsa, corpus: CORPUS, now: NOW })
    const bloque = v.secciones[0].blocks.find(b => b.titulo === 'El problema del consumidor')!
    expect(bloque.items[0].cita).toBeNull()
    expect(bloque.items[0].texto).toBe('No sabe a quién creerle')
  })

  it('reemplaza una lista vacía por un ítem pendiente', () => {
    const sinCompetidores: Deliverable = {
      ...COMPLETO,
      competencia: ok({ ...COMPLETO.competencia!.data!, competidores: [] }),
    }
    const v = buildDeckView({ projectName: 'X', deliverable: sinCompetidores, corpus: CORPUS, now: NOW })
    const bloque = v.secciones[1].blocks.find(b => b.titulo === 'Competidores principales')!
    expect(bloque.items).toEqual([{ texto: 'Pendiente del taller', origen: 'pendiente', cita: null }])
  })

  it('una parte en error produce una sección con error y sin bloques', () => {
    const roto: Deliverable = { ...COMPLETO, competencia: fail('Error: 402 sin crédito') }
    const v = buildDeckView({ projectName: 'X', deliverable: roto, corpus: CORPUS, now: NOW })
    expect(v.completo).toBe(false)
    expect(v.faltantes).toEqual(['competencia'])
    expect(v.secciones[1].error).toContain('402')
    expect(v.secciones[1].blocks).toEqual([])
  })

  it('aplana referentes y ejes a texto legible, conservando el origen', () => {
    const v = buildDeckView({ projectName: 'X', deliverable: COMPLETO, corpus: CORPUS, now: NOW })
    const refs = v.secciones[1].blocks.find(b => b.titulo === 'Otros referentes')!
    expect(refs.items[0]).toEqual({ texto: 'Aesop — referente visual', origen: 'equipo', cita: null })
    const ejes = v.secciones[1].blocks.find(b => b.titulo === 'Variables de comparación')!
    expect(ejes.items[0]).toEqual({ texto: 'cercanía: de frío a cálido', origen: 'equipo', cita: null })
  })

  it('compone la fórmula de la propuesta de valor como párrafo', () => {
    const v = buildDeckView({ projectName: 'X', deliverable: COMPLETO, corpus: CORPUS, now: NOW })
    const sintesis = v.secciones[2].blocks.find(b => b.titulo === 'Síntesis')!
    expect(sintesis.parrafo).toBe('En Cafe Lunar, creamos un lugar para quedarse. Somos el café del barrio con alma.')
  })

  it('expone la tabla JTBD en la sección 3', () => {
    const v = buildDeckView({ projectName: 'X', deliverable: COMPLETO, corpus: CORPUS, now: NOW })
    expect(v.secciones[2].tabla).toHaveLength(1)
    expect(v.secciones[2].tabla[0].job).toBe('Quedarme a conversar')
  })

  it('formatea la fecha en español', () => {
    const v = buildDeckView({ projectName: 'X', deliverable: COMPLETO, corpus: CORPUS, now: NOW })
    expect(v.fecha).toBe('10 jul 2026')
  })

  it('posicionActual con texto en blanco cae al ítem pendiente, no una línea vacía', () => {
    const posicionEnBlanco: Deliverable = {
      ...COMPLETO,
      competencia: ok({ ...COMPLETO.competencia!.data!, posicionActual: item('   ') }),
    }
    const v = buildDeckView({ projectName: 'X', deliverable: posicionEnBlanco, corpus: CORPUS, now: NOW })
    const bloque = v.secciones[1].blocks.find(b => b.titulo === 'Posición actual')!
    expect(bloque.items).toEqual([{ texto: 'Pendiente del taller', origen: 'pendiente', cita: null }])
  })

  it('descarta ítems en blanco dentro de una lista, conservando los válidos', () => {
    const conItemEnBlanco: Deliverable = {
      ...COMPLETO,
      competencia: ok({
        ...COMPLETO.competencia!.data!,
        competidores: [item('Starbucks'), item('   ')],
      }),
    }
    const v = buildDeckView({ projectName: 'X', deliverable: conItemEnBlanco, corpus: CORPUS, now: NOW })
    const bloque = v.secciones[1].blocks.find(b => b.titulo === 'Competidores principales')!
    expect(bloque.items).toEqual([{ texto: 'Starbucks', origen: 'cliente', cita: null }])
  })

  it('combina los errores de perfil y propuestaValor cuando ambos fallan', () => {
    const ambosRotos: Deliverable = {
      ...COMPLETO,
      perfil: fail('Error: 402 sin crédito'),
      propuestaValor: fail('Error: 500 timeout'),
    }
    const v = buildDeckView({ projectName: 'X', deliverable: ambosRotos, corpus: CORPUS, now: NOW })
    expect(v.secciones[2].error).toContain('402')
    expect(v.secciones[2].error).toContain('500')
  })

  it('un entregable vacío no rompe: tres secciones, todas en error', () => {
    const v = buildDeckView({ projectName: 'X', deliverable: {}, corpus: [], now: NOW })
    expect(v.completo).toBe(false)
    expect(v.faltantes).toEqual(['problema', 'competencia', 'perfil', 'propuestaValor'])
    expect(v.secciones).toHaveLength(3)
    expect(v.secciones.every(s => s.error !== null)).toBe(true)
  })
})
