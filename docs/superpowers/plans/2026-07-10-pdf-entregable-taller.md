# PDF del entregable pre-taller — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el `Deliverable` (JSON de 5 partes) en un PDF legible con la identidad de Melo & Banana, descargable desde el panel de admin.

**Architecture:** Tres capas con fronteras estrictas. Una función pura (`buildDeckView`) traduce el `Deliverable` a una estructura de vista, verificando cada cita contra las respuestas originales. Un componente de `@react-pdf/renderer` (`DeckDocument`) la dibuja. Una ruta de API la sirve. La lógica de contenido no sabe nada de PDF, y se testea con objetos planos.

**Tech Stack:** Next.js 16 (App Router, runtime `nodejs`), React 19, `@react-pdf/renderer` ^4.5.1, Drizzle + Neon, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-10-pdf-entregable-taller-email-design.md`

## Global Constraints

- **Fuera de alcance en este plan:** el envío por correo. No se instala `nodemailer`, no se crea `src/lib/mailer/`. Se implementa sólo la generación y descarga del PDF.
- **Sin gráficos.** No se dibuja el mapa de posicionamiento ni el Value Proposition Canvas. El contenido de la Parte 2 va como texto.
- **`personalidad` no tiene sección en el PDF.** Es el paso 0 del motor, insumo de los otros pasos.
- **Paleta exacta:** amarillo `#ffd400`, negro `#1a1510`, crema `#fffdf2`, gris `#6b6155`, borde `#e6dfd0`.
- **Tipografías:** sólo las que trae `@react-pdf/renderer` sin registrar fuentes: `Helvetica`, `Helvetica-Bold`, `Times-Roman`. (Igual que `BriefDocument.tsx`.)
- **Idioma de la UI y del PDF:** español neutro con tuteo ("cuéntanos", no "contanos").
- **Los ítems `pendiente` se imprimen, no se ocultan.**
- **Citas:** verbatim o no se cita. Verificación en código, no en el prompt.
- **Runtime de la ruta:** `export const runtime = 'nodejs'`.
- Ejecutar tests con `npx vitest run <archivo>`. La suite completa es `npm test`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/lib/deck/text.ts` (crear) | Normalización de texto y verificación de citas. Sin dependencias. |
| `src/lib/deck/text.test.ts` (crear) | Pruebas de lo anterior. |
| `src/lib/deck/view-model.ts` (crear) | `buildDeckView`: `Deliverable` → `DeckView`. Función pura. |
| `src/lib/deck/view-model.test.ts` (crear) | El grueso de las pruebas. |
| `src/lib/deck/DeckDocument.tsx` (crear) | Renderizador PDF. Gemelo de `src/lib/pdf/BriefDocument.tsx`. |
| `src/lib/deck/preview.test.tsx` (crear) | Smoke test: renderiza a buffer y escribe `tmp/deck-completo.pdf` para revisar a ojo. |
| `src/lib/deck/service.ts` (crear) | Reúne proyecto + entregable + corpus de respuestas desde la DB y devuelve el `DeckView`. |
| `src/app/api/projects/[id]/deck/route.ts` (crear) | `GET` que devuelve el PDF. |
| `src/app/admin/projects/[id]/DeliverablePanel.tsx` (modificar) | Botón "Descargar PDF". |

---

## FASE A — Lógica de contenido

### Task A1: Verificación de citas

El skill prohíbe inventar citas ("verbatim o no se cita"). El modelo devuelve `Item.cita`; hay que comprobar que esa frase existe de verdad en lo que el cliente respondió, antes de imprimirla entre comillas.

La comparación ignora mayúsculas, tildes y espacios de más, porque el normalizador de texto por IA puede haber corregido la ortografía de lo dictado sin cambiar las palabras.

**Files:**
- Create: `src/lib/deck/text.ts`
- Test: `src/lib/deck/text.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `normalizarTexto(s: string): string`
  - `citaVerificada(cita: string | null | undefined, corpus: string[]): string | null`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/deck/text.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizarTexto, citaVerificada } from './text'

const CORPUS = [
  'Queremos que la gente se sienta acompañada, no vendida.',
  'Nuestro margen real es del 12% y eso nos aprieta.',
]

describe('normalizarTexto', () => {
  it('baja a minúsculas, quita tildes y colapsa espacios', () => {
    expect(normalizarTexto('  Él  CANTÓ   más  ')).toBe('el canto mas')
  })

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(normalizarTexto('')).toBe('')
  })
})

describe('citaVerificada', () => {
  it('acepta una cita que aparece textual en el corpus', () => {
    expect(citaVerificada('la gente se sienta acompañada', CORPUS))
      .toBe('la gente se sienta acompañada')
  })

  it('acepta ignorando tildes, mayúsculas y espacios de más', () => {
    expect(citaVerificada('  La Gente Se Sienta   ACOMPANADA ', CORPUS))
      .toBe('La Gente Se Sienta   ACOMPANADA')
  })

  it('rechaza una cita inventada', () => {
    expect(citaVerificada('somos líderes del mercado', CORPUS)).toBeNull()
  })

  it('rechaza una cita que mezcla dos respuestas distintas', () => {
    expect(citaVerificada('no vendida. Nuestro margen real', CORPUS)).toBeNull()
  })

  it('devuelve null para null, undefined o vacío', () => {
    expect(citaVerificada(null, CORPUS)).toBeNull()
    expect(citaVerificada(undefined, CORPUS)).toBeNull()
    expect(citaVerificada('   ', CORPUS)).toBeNull()
  })

  it('rechaza citas demasiado cortas para ser significativas', () => {
    // "del" aparece en el corpus, pero citarlo no prueba nada.
    expect(citaVerificada('del', CORPUS)).toBeNull()
  })

  it('preserva el texto original de la cita, no el normalizado', () => {
    expect(citaVerificada('Nuestro margen real es del 12%', CORPUS))
      .toBe('Nuestro margen real es del 12%')
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/deck/text.test.ts`
Expected: FAIL — `Failed to resolve import "./text"`.

- [ ] **Step 3: Implementar `src/lib/deck/text.ts`**

```ts
/** Longitud mínima (ya normalizada) para que una cita se considere significativa. */
const MIN_CITA = 12

/** minúsculas, sin tildes, espacios colapsados. */
export function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Devuelve la cita TAL CUAL vino si aparece textualmente (módulo tildes, mayúsculas
 * y espacios) dentro de ALGUNA respuesta del corpus. Si no, devuelve null.
 *
 * Debe encontrarse dentro de una sola respuesta: una "cita" que abarque dos
 * respuestas distintas es una frase que nadie dijo.
 */
export function citaVerificada(cita: string | null | undefined, corpus: string[]): string | null {
  if (!cita) return null
  const aguja = normalizarTexto(cita)
  if (aguja.length < MIN_CITA) return null
  const ok = corpus.some(respuesta => normalizarTexto(respuesta).includes(aguja))
  return ok ? cita.trim() : null
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/deck/text.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/deck/text.ts src/lib/deck/text.test.ts
git commit -m "feat(deck): verificación de citas contra las respuestas del cliente"
```

---

### Task A2: `buildDeckView` — del JSON a la estructura de vista

**Files:**
- Create: `src/lib/deck/view-model.ts`
- Test: `src/lib/deck/view-model.test.ts`

**Interfaces:**
- Consumes: `citaVerificada` de `./text`. Tipos `Deliverable`, `Item`, `Origen`, `FilaValor`, `PartKey` de `@/lib/deliverable/schema`.
- Produces:
  - `interface DeckItem { texto: string; origen: Origen; cita: string | null }`
  - `interface DeckBlock { titulo: string; parrafo: string | null; items: DeckItem[] }`
  - `interface DeckSection { numero: number; titulo: string; error: string | null; blocks: DeckBlock[]; tabla: FilaValor[] }`
  - `interface DeckView { marca: string; fecha: string; completo: boolean; faltantes: PartKey[]; secciones: DeckSection[] }`
  - `function buildDeckView(input: { projectName: string; deliverable: Deliverable; corpus: string[]; now: Date }): DeckView`

Reglas que codifica:
- Una parte con `data === null` produce una sección con `error` y sin bloques.
- Una lista vacía produce un único `DeckItem` `{ texto: 'Pendiente del taller', origen: 'pendiente', cita: null }`.
- Cada `cita` pasa por `citaVerificada`; si no sobrevive, el ítem queda con `cita: null` pero conserva su `texto`.
- `completo` es true sólo si las cuatro partes del entregable (`problema`, `competencia`, `perfil`, `propuestaValor`) tienen `data`. `personalidad` no cuenta: no se imprime.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/deck/view-model.test.ts`:

```ts
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
    expect(ejes.items[0]).toEqual({ texto: 'cercanía: frío ↔ cálido', origen: 'equipo', cita: null })
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

  it('un entregable vacío no rompe: tres secciones, todas en error', () => {
    const v = buildDeckView({ projectName: 'X', deliverable: {}, corpus: [], now: NOW })
    expect(v.completo).toBe(false)
    expect(v.faltantes).toEqual(['problema', 'competencia', 'perfil', 'propuestaValor'])
    expect(v.secciones).toHaveLength(3)
    expect(v.secciones.every(s => s.error !== null)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/deck/view-model.test.ts`
Expected: FAIL — `Failed to resolve import "./view-model"`.

- [ ] **Step 3: Implementar `src/lib/deck/view-model.ts`**

```ts
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

/** Verifica las citas y, si la lista quedó vacía, deja un ítem pendiente. */
function items(list: Item[] | undefined, corpus: string[]): DeckItem[] {
  const out = (list ?? []).map(i => ({
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
    texto: `${e.nombre}: ${e.extremoIzquierdo} ↔ ${e.extremoDerecho}`, origen: e.origen, cita: null,
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
  // La sección 3 falla si falla cualquiera de sus dos insumos.
  const err3 = errorDe(d.perfil) ?? errorDe(d.propuestaValor)
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
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/deck/view-model.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/deck/view-model.ts src/lib/deck/view-model.test.ts
git commit -m "feat(deck): view-model puro del entregable, con citas verificadas y pendientes visibles"
```

---

## FASE B — Renderizado

### Task B1: `DeckDocument` — el PDF

Sigue la anatomía del deck: portada, y por cada parte un divisor de campo amarillo (opción B elegida por el usuario: fondo `#ffd400`, número de parte grande y translúcido al fondo, título en negro) seguido del contenido.

El marcado de origen es lo que hace confiable al documento: `cliente` va con su cita debajo; `equipo` lleva la etiqueta "propuesta del equipo"; `pendiente` va en gris con la etiqueta "pendiente del taller".

**Files:**
- Create: `src/lib/deck/DeckDocument.tsx`
- Test: `src/lib/deck/preview.test.tsx`

**Interfaces:**
- Consumes: `DeckView`, `DeckSection`, `DeckBlock`, `DeckItem` de `./view-model`.
- Produces: `function DeckDocument({ view }: { view: DeckView }): ReactElement`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/deck/preview.test.tsx`. Además de verificar que no explota, escribe el PDF a `tmp/deck-completo.pdf` para revisarlo a ojo — mismo patrón que `src/lib/pdf/preview.test.tsx`.

```tsx
// @vitest-environment node
// Smoke test + preview: renderiza el deck completo y lo escribe a disco.
//   npx vitest run src/lib/deck/preview.test.tsx
// Salida: tmp/deck-completo.pdf
import { describe, it, expect } from 'vitest'
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
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/deck/preview.test.tsx`
Expected: FAIL — `Failed to resolve import "./DeckDocument"`.

- [ ] **Step 3: Implementar `src/lib/deck/DeckDocument.tsx`**

```tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { DeckView, DeckSection, DeckBlock, DeckItem } from './view-model'

const C = {
  banana: '#ffd400',
  ink: '#1a1510',
  cream: '#fffdf2',
  gray: '#6b6155',
  border: '#e6dfd0',
}

const ORIGEN_LABEL: Record<string, string> = {
  equipo: 'propuesta del equipo',
  pendiente: 'pendiente del taller',
}

const s = StyleSheet.create({
  page: { paddingBottom: 46, backgroundColor: C.cream, color: C.ink, fontFamily: 'Helvetica', fontSize: 11 },
  body: { paddingHorizontal: 44, paddingTop: 34 },

  // Portada
  cover: { backgroundColor: C.ink, height: '100%', justifyContent: 'flex-end', padding: 44 },
  coverBar: { width: 90, height: 10, backgroundColor: C.banana, marginBottom: 18 },
  coverTitle: { fontFamily: 'Times-Roman', fontSize: 34, color: C.cream },
  coverBrand: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: C.banana, marginTop: 16 },
  coverDate: { fontSize: 10, color: '#9a9186', marginTop: 6 },

  // Divisor de sección: campo amarillo, número gigante detrás
  divider: { backgroundColor: C.banana, height: '100%', justifyContent: 'center', padding: 44 },
  divNum: { position: 'absolute', right: 24, bottom: -10, fontFamily: 'Times-Roman', fontSize: 190, color: C.ink, opacity: 0.12 },
  divKicker: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.ink, opacity: 0.6, letterSpacing: 2, marginBottom: 12 },
  divTitle: { fontFamily: 'Times-Roman', fontSize: 30, color: C.ink, maxWidth: '80%' },

  // Contenido
  secHead: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.gray, letterSpacing: 1.5, marginBottom: 18 },
  blockTitle: { fontFamily: 'Times-Roman', fontSize: 14, marginTop: 20, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 5 },
  parrafo: { fontSize: 12, lineHeight: 1.5 },

  item: { flexDirection: 'row', marginTop: 9 },
  bullet: { width: 12, fontSize: 11, color: C.banana },
  itemBody: { flex: 1 },
  itemText: { fontSize: 11.5, lineHeight: 1.45 },
  // Sin fontStyle italic: obligaría a registrar Helvetica-Oblique. El gris + la etiqueta ya distinguen.
  itemTextPend: { fontSize: 11.5, lineHeight: 1.45, color: C.gray },
  cita: { fontSize: 10, color: C.gray, marginTop: 3, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: C.banana, lineHeight: 1.4 },
  tag: { fontSize: 8, color: C.gray, marginTop: 3, letterSpacing: 0.4 },

  // Tabla JTBD
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 7 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.gray, letterSpacing: 0.6 },
  cell: { fontSize: 10, lineHeight: 1.4, paddingRight: 8 },
  c1: { width: '30%' }, c2: { width: '30%' }, c3: { width: '40%' },

  error: { backgroundColor: '#fff4f4', borderWidth: 1, borderColor: '#f0d0d0', padding: 12, fontSize: 10, color: '#8a3a3a', marginTop: 16 },
  foot: { position: 'absolute', bottom: 18, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, color: C.gray },
})

function ItemRow({ it }: { it: DeckItem }) {
  const pend = it.origen === 'pendiente'
  return (
    <View style={s.item} wrap={false}>
      <Text style={s.bullet}>—</Text>
      <View style={s.itemBody}>
        <Text style={pend ? s.itemTextPend : s.itemText}>{it.texto}</Text>
        {!!it.cita && <Text style={s.cita}>&ldquo;{it.cita}&rdquo;</Text>}
        {!!ORIGEN_LABEL[it.origen] && <Text style={s.tag}>{ORIGEN_LABEL[it.origen]}</Text>}
      </View>
    </View>
  )
}

function Block({ b }: { b: DeckBlock }) {
  return (
    <View>
      <Text style={s.blockTitle} wrap={false}>{b.titulo}</Text>
      {!!b.parrafo && <Text style={s.parrafo}>{b.parrafo}</Text>}
      {b.items.map((it, i) => <ItemRow key={i} it={it} />)}
    </View>
  )
}

function Divider({ sec }: { sec: DeckSection }) {
  return (
    <Page size="A4" style={{ padding: 0 }}>
      <View style={s.divider}>
        <Text style={s.divNum}>{`0${sec.numero}`}</Text>
        <Text style={s.divKicker}>TALLER PROPUESTA DE VALOR</Text>
        <Text style={s.divTitle}>{sec.titulo}</Text>
      </View>
    </Page>
  )
}

function Tabla({ filas }: { filas: DeckSection['tabla'] }) {
  if (!filas.length) return null
  return (
    <View>
      <Text style={s.blockTitle} wrap={false}>Cómo lo resolvemos, trabajo por trabajo</Text>
      <View style={[s.row, { borderBottomColor: C.ink }]} wrap={false}>
        <Text style={[s.th, s.c1]}>JOB TO BE DONE</Text>
        <Text style={[s.th, s.c2]}>SOLUCIÓN</Text>
        <Text style={[s.th, s.c3]}>CÓMO SE RESUELVE</Text>
      </View>
      {filas.map((f, i) => (
        <View key={i} style={s.row} wrap={false}>
          <Text style={[s.cell, s.c1]}>{f.job}</Text>
          <Text style={[s.cell, s.c2]}>{f.solucion}</Text>
          <View style={s.c3}>
            <Text style={s.cell}>{f.comoSeResuelve}</Text>
            {!!ORIGEN_LABEL[f.origen] && <Text style={s.tag}>{ORIGEN_LABEL[f.origen]}</Text>}
          </View>
        </View>
      ))}
    </View>
  )
}

export function DeckDocument({ view }: { view: DeckView }) {
  return (
    <Document title={`Taller Propuesta de Valor — ${view.marca}`}>
      <Page size="A4" style={{ padding: 0 }}>
        <View style={s.cover}>
          <View style={s.coverBar} />
          <Text style={s.coverTitle}>Taller de{'\n'}Propuesta de Valor</Text>
          <Text style={s.coverBrand}>{view.marca}</Text>
          <Text style={s.coverDate}>{view.fecha}</Text>
        </View>
      </Page>

      {/* flatMap, no fragmentos: <Document> espera <Page> como hijos directos. */}
      {view.secciones.flatMap(sec => [
        <Divider key={`d${sec.numero}`} sec={sec} />,
        <Page key={`p${sec.numero}`} size="A4" style={s.page}>
          <View style={s.body}>
            <Text style={s.secHead}>{`PARTE 0${sec.numero} · ${sec.titulo.toUpperCase()}`}</Text>
            {sec.error
              ? <Text style={s.error}>{`Esta parte no se pudo generar: ${sec.error}`}</Text>
              : (
                <>
                  {sec.blocks.map((b, i) => <Block key={i} b={b} />)}
                  <Tabla filas={sec.tabla} />
                </>
              )}
          </View>
          <View style={s.foot} fixed>
            <Text>Mellow &amp; Banana · Branding</Text>
            <Text>{view.marca}</Text>
          </View>
        </Page>,
      ])}
    </Document>
  )
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/deck/preview.test.tsx`
Expected: PASS (2 tests). Se escribe `tmp/deck-completo.pdf`.

- [ ] **Step 5: Abrir el PDF y mirarlo**

Run: `xdg-open tmp/deck-completo.pdf`
Expected: portada negra con barra amarilla, tres divisores amarillos con el número al fondo, contenido legible, citas con barra amarilla al margen, etiquetas de origen visibles.

> Que compile no significa que se entienda. Si el layout está roto, arreglarlo acá antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add src/lib/deck/DeckDocument.tsx src/lib/deck/preview.test.tsx
git commit -m "feat(deck): renderizador PDF con identidad M&B y marcado de origen"
```

---

## FASE C — Cableado

### Task C1: Servicio y ruta de descarga

**Files:**
- Create: `src/lib/deck/service.ts`
- Create: `src/app/api/projects/[id]/deck/route.ts`
- Modify: `src/app/admin/projects/[id]/DeliverablePanel.tsx`

**Interfaces:**
- Consumes: `buildDeckView` de `./view-model`; `DeckDocument` de `./DeckDocument`; `getProjectWithSessions`, `getSessionWithAnswers`, `getDeliverable` de `@/lib/db/store`; `db` de `@/lib/db/client`.
- Produces: `async function buildProjectDeckView(projectId: string): Promise<DeckView | null>`

`buildProjectDeckView` devuelve `null` si el proyecto no existe o si todavía no tiene entregable guardado.

El corpus para verificar citas son **todas** las respuestas de **todas** las sesiones del proyecto (`rawText` y `normalizedText`), porque el entregable se genera sobre el conjunto de respondientes.

- [ ] **Step 1: Implementar `src/lib/deck/service.ts`**

```ts
import { db } from '@/lib/db/client'
import { getProjectWithSessions, getSessionWithAnswers, getDeliverable } from '@/lib/db/store'
import type { Deliverable } from '@/lib/deliverable/schema'
import { buildDeckView, type DeckView } from './view-model'

export async function buildProjectDeckView(projectId: string): Promise<DeckView | null> {
  const project = await getProjectWithSessions(db, projectId)
  if (!project) return null

  const saved = await getDeliverable(db, projectId)
  if (!saved) return null

  const sessions = project.sessions as { id: string }[]
  const corpus: string[] = []
  for (const sesion of sessions) {
    const full = await getSessionWithAnswers(db, sesion.id)
    if (!full) continue
    for (const a of full.answers as { rawText: string; normalizedText?: string | null }[]) {
      if (a.rawText) corpus.push(a.rawText)
      if (a.normalizedText) corpus.push(a.normalizedText)
    }
  }

  return buildDeckView({
    projectName: project.name,
    deliverable: saved.content as Deliverable,
    corpus,
    now: new Date(),
  })
}
```

- [ ] **Step 2: Implementar la ruta `src/app/api/projects/[id]/deck/route.ts`**

```ts
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { buildProjectDeckView } from '@/lib/deck/service'
import { DeckDocument } from '@/lib/deck/DeckDocument'

export const runtime = 'nodejs'

function slug(name: string): string {
  const out = (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out || 'taller'
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const view = await buildProjectDeckView(id)
  if (!view) return new Response('Sin entregable generado', { status: 404 })

  const buffer = await renderToBuffer(createElement(DeckDocument, { view }) as ReactElement<DocumentProps>)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="taller-${slug(view.marca)}.pdf"`,
    },
  })
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Agregar el botón "Descargar PDF" al panel**

En `src/app/admin/projects/[id]/DeliverablePanel.tsx`, junto a los botones de generar/regenerar, agregar un enlace de descarga. Sólo se muestra cuando ya hay un entregable guardado (la variable que el panel usa hoy para saberlo; si el panel recibe el entregable por props como `deliverable`, la condición es `!!deliverable`).

```tsx
{!!deliverable && (
  <a
    href={`/api/projects/${projectId}/deck`}
    style={{ textDecoration: 'underline' }}
  >
    Descargar PDF del taller
  </a>
)}
```

> Ajustar el nombre exacto de las props (`deliverable`, `projectId`) a las que el componente ya recibe. No inventar props nuevas: leer el archivo primero.

- [ ] **Step 5: Verificar lint y build**

Run: `npm run lint -- --max-warnings=999 && npm run build`
Expected: build sin errores. (El lint ya arrastra 57 errores previos de `no-explicit-any`; no agregar ninguno nuevo.)

- [ ] **Step 6: Correr la suite completa**

Run: `npm test`
Expected: PASS. Si fallan `store.test.ts` o `normalize/service.test.ts` por timeout, re-correrlos aislados: es una flakiness conocida de pglite inicializando WASM bajo carga, no una regresión.

Run: `npx vitest run src/lib/db/store.test.ts src/lib/normalize/service.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/deck/service.ts src/app/api/projects/[id]/deck/route.ts src/app/admin/projects/[id]/DeliverablePanel.tsx
git commit -m "feat(deck): ruta de descarga del PDF del taller y botón en el panel"
```

---

## FASE D — Verificación real

### Task D1: Verificación end-to-end contra un proyecto de verdad

**Files:** ninguno (verificación).

> **Bloqueante conocido:** la cuenta de OpenRouter está en saldo negativo (-$0.16 al 2026-07-10). Sin recargar, la generación devuelve 402 y no hay entregable que renderizar. Los pasos 2 y 3 requieren crédito; el paso 1 no.

- [ ] **Step 1: Verificar el PDF con datos sintéticos**

Run: `npx vitest run src/lib/deck/preview.test.tsx && xdg-open tmp/deck-completo.pdf`
Expected: el PDF se ve terminado. Leerlo entero.

- [ ] **Step 2: Generar un entregable real**

Levantar `npm run dev`, completar dos entrevistas con la misma empresa, entrar a `/admin`, abrir el proyecto y generar el entregable.
Expected: las cuatro partes con datos.

- [ ] **Step 3: Descargar el PDF desde el panel y leerlo**

Expected: las citas que aparecen entre comillas se pueden encontrar textualmente en las respuestas de las entrevistas. Los ítems marcados como propuesta del equipo son, efectivamente, cosas que el cliente no dijo. Los pendientes son huecos reales.

> Esta es la única verificación que importa. Si una cita no aparece en las respuestas, `citaVerificada` tiene un bug y hay que arreglarlo antes de dar esto por terminado.

- [ ] **Step 4: Commit final (si hubo ajustes)**

```bash
git add -A && git commit -m "chore(deck): ajustes tras la verificación end-to-end"
```

---

## Self-Review

**Cobertura del spec:**
- Arquitectura en tres unidades → A1/A2 (view-model), B1 (renderizador), C1 (servicio y ruta). El `Mailer` queda fuera por decisión explícita de alcance.
- Contenido del PDF (portada, 3 divisores, 3 partes, cierre) → B1.
- `personalidad` sin sección → A2, constante `PARTES_IMPRESAS`, con test que verifica que "Cuidador" no aparece en la vista.
- Marcado de origen visible → A2 (dato) + B1 (`ORIGEN_LABEL`).
- Verificación de citas → A1, con test de cita inventada y de cita que cruza dos respuestas.
- Pendientes que se imprimen → A2 (`PENDIENTE`), con test de lista vacía.
- Errores y bordes (parte en error, un solo respondiente, listas vacías) → A2 y su tabla de tests; el caso "un solo respondiente" no requiere código nuevo (lo maneja el preámbulo del prompt) y no se testea acá.
- Testing (view-model con objetos, renderizador a buffer, precedente `preview.test.tsx`) → A1, A2, B1.
- Envío por correo, `Mailer`, variables `GMAIL_*` → **fuera de este plan**, por pedido del usuario.

**Placeholders:** ninguno. El único punto donde el plan pide leer antes de escribir es el Step 4 de C1 (nombres de props del panel), y está marcado explícitamente porque el archivo existe y no debe inventarse su interfaz.

**Consistencia de tipos:** `DeckItem`, `DeckBlock`, `DeckSection`, `DeckView` se definen en A2 y se consumen con los mismos nombres en B1 y C1. `buildDeckView` recibe `{projectName, deliverable, corpus, now}` en A2, B1 y C1. `citaVerificada(cita, corpus)` se define en A1 y se usa en A2. `buildProjectDeckView(projectId)` se define en C1 y se usa en la ruta.

**Riesgo abierto:** `POST /api/projects/[id]/deliverable` sigue sin autenticación, y esta nueva ruta `GET /api/projects/[id]/deck` **también nace abierta** — expone el análisis completo del cliente a cualquiera con el ID del proyecto. Es coherente con el estado actual del sistema y no lo empeora cualitativamente, pero debe cerrarse junto con el resto. Registrado en `melo-banana-pendientes-seguridad`.
