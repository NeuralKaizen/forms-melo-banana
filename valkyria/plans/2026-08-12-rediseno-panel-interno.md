# Rediseño del panel interno · Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development
> (recomendado) o superpowers:executing-plans para implementar tarea por tarea. Los pasos usan
> checkbox (`- [ ]`) para seguimiento.

**Goal:** Reemplazar el lenguaje visual y la navegación del panel interno por una barra amarilla de
tres estados, un índice único de fases y etapas, y un área de trabajo tratada como sala de revisión.

**Architecture:** La navegación deja de estar repartida en cinco lugares (lateral oscura + tarjetas
de grupo + tabs + carril del workspace + aviso) y se concentra en dos componentes nuevos:
`AdminShell` (barra amarilla, tres estados derivados de la ruta) y `ProjectIndex` (árbol plano de
fases y etapas). Los workspaces pierden sus columnas laterales y quedan como documento editorial
+ pie de decisión. Todo el cambio es de presentación: no se toca el esquema de base, ni el MCP, ni
las rutas de API.

**Tech Stack:** Next.js 16 (App Router, server components), React 19, Tailwind v4, Vitest +
Testing Library + jsdom.

**Spec:** `valkyria/specs/2026-08-12-rediseno-panel-interno-design.md`

## Global Constraints

- **Idioma:** todo el texto de UI y todos los comentarios de código en español rioplatense, como el
  resto del repo. Los nombres de símbolos también van en español donde ya lo están (`señales`,
  `etapaActual`).
- **Tipografía:** las comillas tipográficas (`" "`, `'`) y los guiones largos (`—`) del texto de UI
  se escriben como esos caracteres, nunca como `"` o `-`. Hay un test canario que lo verifica por
  bytes; los subagentes de transcripción tienden a aplanarlos.
- **Tokens de color** (exactos, del spec): `--banana: #FFD400` · `--ink: #15120C` · `--line:
  #EDEAE1` · fondo `#FFFFFF` · cuerpo `#2C281F` · secundario `#5C5648` · rótulos `#A8A296` ·
  deshabilitado `#B5AF9F` · aprobado suave `#FFF3B8`.
- **Sin tarjetas ni sombras** en el contenido: separación por hairlines `1px solid var(--line)` y
  borde `1.5px solid var(--ink)` donde una sección tiene que pesar. Sombra sólo en lo que flota
  (barra abierta encima, menús).
- **Escala tipográfica:** 30px título de etapa · 19px nombre de proyecto en listas · 14px cuerpo ·
  13px UI · 10px rótulos en versalitas con `tracking .14em`. Prohibido inventar tamaños entre
  12.5 y 13.5.
- **Movimiento:** sólo color, opacidad y ancho. Nada que desplace contenido. Se respeta el bloque
  `@media (prefers-reduced-motion: reduce)` que ya existe en `globals.css`.
- **Fuera de alcance:** la entrevista pública (`/interview/*`, `/gracias`), `lib/pdf`, `lib/deck`,
  el servidor MCP y el esquema de base. **Ninguna migración.**
- **Tests:** `npm test` corre todo (Vitest). Los tests de componente llevan
  `// @vitest-environment jsdom` en la primera línea, como los existentes.
- **Commits frecuentes**, uno por tarea, en español, con el formato del repo
  (`feat(ux):`, `refactor:`, `test:`).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/pipeline/phases.ts` | Modelo de fases/etapas. Se renombra el vocabulario y se agrega `construirIndice` |
| `src/lib/pipeline/indice.ts` **(nuevo)** | Arma el árbol que consume el índice: fases con sus etapas, estados y colapso |
| `src/components/ProjectIndex.tsx` **(nuevo)** | Rinde el árbol. Único navegador del proyecto |
| `src/components/AdminShell.tsx` | Barra amarilla de tres estados + slot del índice |
| `src/components/BarraProyectos.tsx` **(nuevo)** | Cliente: riel ↔ abierta encima (hover, `»`, Escape) |
| `src/components/EtapaDocumento.tsx` **(nuevo)** | Documento editorial de una etapa + pie de decisión |
| `src/components/ComparadorVersiones.tsx` **(nuevo)** | Dos columnas aprobada/nueva |
| `.../landscape/ContenidoEtapa.tsx` | Reescrito: rótulo al margen, valor en columna de lectura |
| `.../landscape/LandscapeWorkspace.tsx` | Pierde las dos columnas laterales |
| `.../estrategia/EstrategiaWorkspace.tsx` | Igual; los bloques se van al índice |
| `src/app/admin/page.tsx` | Listado con hairlines |
| `src/components/ProjectHeader.tsx` + test | **Se elimina** |

**Orden de las tareas.** 1–2 preparan el modelo sin tocar pantallas. 3–5 construyen los componentes
nuevos con sus tests, todavía sin conectar. 6–8 los conectan y borran lo viejo. 9 limpia. Cada
tarea deja la suite verde y la app funcionando.

---

### Task 1: Renombrar el vocabulario a fase/etapa

Sin cambio de comportamiento: sólo nombres. Se hace primero para que todo lo que sigue hable el
idioma del spec.

**Files:**
- Modify: `src/lib/pipeline/phases.ts`
- Modify: `src/lib/pipeline/phases.test.ts`
- Modify: `src/lib/estrategia/stages.ts:31-42`
- Modify: `src/lib/estrategia/stages.test.ts`
- Modify: `src/app/admin/page.tsx`, `src/components/AdminShell.tsx`,
  `src/components/ProjectHeader.tsx`, y las cinco páginas de
  `src/app/admin/projects/[id]/{entrevistas,propuesta,taller,landscape,estrategia}/page.tsx`
  y `src/app/admin/projects/[id]/page.tsx` (todas importan `deriveGrupos`)
- Modify: `src/app/admin/projects/[id]/estrategia/EstrategiaWorkspace.tsx` (importa `GRUPOS_ETAPAS`)

**Interfaces:**
- Consumes: nada.
- Produces: `Fase`, `FaseKey`, `EtapaKey`, `deriveFases(projectId, s): Fase[]`,
  `faseActual(fases): Fase`, `faseDeEtapa(e: EtapaKey): FaseKey`, `BLOQUES: Bloque[]`.
  `Grupo`/`deriveGrupos`/`GRUPOS_ETAPAS` dejan de existir.

Mapa exacto del rename:

| Antes | Después |
|---|---|
| `Grupo` | `Fase` |
| `GrupoKey` | `FaseKey` |
| `PantallaKey` | `EtapaKey` |
| `GRUPO_LABEL` | `FASE_LABEL` |
| `GRUPO_DE_PANTALLA` | `FASE_DE_ETAPA` |
| `grupoDePantalla` | `faseDeEtapa` |
| `deriveGrupos` | `deriveFases` |
| `grupoActual` | `faseActual` |
| `GrupoEtapas` (estrategia) | `Bloque` |
| `GRUPOS_ETAPAS` (estrategia) | `BLOQUES` |

**No se renombran:** `Stage`, `StageKey`, `StageStatus`, `buildStages` del landscape (ya significan
"etapa" y tocarlos arrastra el store y el MCP sin ganancia), ni `Pantalla`/`derivePantallas`/
`pantallaActual`, que se conservan tal cual: `attention.ts` tipa `AttentionItem.fase` contra
`Pantalla`, y `construirIndice` (Task 2) las consume para el estado de las tres entradas de la
fase 1.

- [ ] **Step 1: Renombrar en el modelo**

En `src/lib/pipeline/phases.ts`, aplicar el mapa de arriba. El campo `tabs` de la fase
`propuesta-valor` se conserva por ahora (lo consume `ProjectHeader`, que muere en la Task 7).

- [ ] **Step 2: Renombrar en estrategia**

En `src/lib/estrategia/stages.ts`, `GrupoEtapas` → `Bloque` y `GRUPOS_ETAPAS` → `BLOQUES`.
Actualizar el comentario que dice "Agrupación del carril de navegación (fase 3 UX)" por:

```ts
/**
 * Los bloques del proceso (PDF, bloques 1–4). El índice del proyecto los usa como
 * sub-rótulo dentro de la fase Estrategia: 14 etapas planas no se leen.
 */
```

- [ ] **Step 3: Propagar a los consumidores**

Buscar y reemplazar en los archivos listados arriba:

```bash
grep -rln "deriveGrupos\|grupoActual\|grupoDePantalla\|GRUPOS_ETAPAS\|GrupoKey\|PantallaKey" src
```

Cada archivo tiene que compilar con los nombres nuevos. Las variables locales llamadas `grupos`
pasan a `fases`.

- [ ] **Step 4: Correr la suite**

Run: `npm test`
Expected: PASS, mismo número de tests que antes del rename. Si algún test falla por un nombre,
es que quedó una referencia vieja.

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: vocabulario fase/etapa/bloque en el modelo del recorrido"
```

---

### Task 2: El árbol del índice (`construirIndice`)

Función pura que arma lo que el índice va a rendir. Sale a su propio archivo porque `phases.ts` ya
tiene 230 líneas y esto es otra responsabilidad: `phases.ts` dice en qué estado está cada fase,
`indice.ts` arma la lista navegable.

**Files:**
- Create: `src/lib/pipeline/indice.ts`
- Create: `src/lib/pipeline/indice.test.ts`

**Interfaces:**
- Consumes: `Fase`, `FaseKey`, `EtapaKey` de `./phases` (Task 1); `Stage` de
  `@/lib/landscape/stages`; `EtapaEstrategia`, `BLOQUES` de `@/lib/estrategia/stages`.
- Produces:

```ts
export type EstadoEtapa = 'aprobada' | 'actual' | 'pendiente' | 'no_aplica'

export interface EntradaIndice {
  key: string          // 'entrevistas' | 'landscape:tendencias' | 'estrategia:personalidad'
  label: string
  href: string
  estado: EstadoEtapa
  /** Sub-rótulo del bloque, sólo en Estrategia y sólo en la primera etapa de cada bloque. */
  bloque?: string
  /** Esta etapa espera una decisión del equipo. */
  espera: boolean
}

export interface FaseIndice {
  key: FaseKey
  label: string
  /** '6/6', '✓', '6 de 14' — lo que va a la derecha del título. */
  avance: string
  entradas: EntradaIndice[]
  /** Cuántas quedaron ocultas por el colapso. 0 si no se colapsó nada. */
  ocultas: number
}

export function construirIndice(input: {
  projectId: string
  fases: Fase[]
  /** De `derivePantallas`: el estado fino de entrevistas, propuesta, taller y landscape. */
  pantallas: Pantallas
  /** Namespaceada: 'entrevistas' | 'landscape:tendencias' | 'estrategia:personalidad'. */
  etapaActiva: string
  stagesLandscape: Stage[]
  etapasEstrategia: EtapaEstrategia[]
  /** Keys namespaceadas de las etapas que esperan una decisión del equipo. */
  esperanDecision: string[]
}): FaseIndice[]

/**
 * Qué etapas tienen una versión guardada sin aprobar — es decir, esperan al equipo.
 * Se exporta acá y no en el store porque es criterio de presentación: el store no sabe
 * de "esperar".
 */
export function esperanDecision(
  fase: 'landscape' | 'estrategia',
  estado: { stage: string; actual?: { approvedAt?: Date | null } | null; borradorNuevo?: unknown }[],
): string[]
```

`esperanDecision` devuelve la key namespaceada (`landscape:panorama`) de cada etapa que tenga
una versión actual sin `approvedAt`, o un `borradorNuevo` (que siempre espera decisión). Las
páginas la llaman una vez por fase y concatenan los dos arrays.

**Reglas** (del spec, sección 4):
- Las fases `entrevistas`, `propuesta`, `taller` producen **una entrada cada una**, no un título con
  hijos. Van agrupadas bajo la fase `propuesta-valor` con label `Entrevistas / Propuesta de valor`.
- `landscape` produce sus 6 etapas; `estrategia` sus 14, con `bloque` seteado en la primera etapa
  de cada bloque de `BLOQUES`.
- **Colapso:** si una fase tiene más de 6 entradas, se muestran las aprobadas más recientes, la
  activa y las dos siguientes — concretamente, la ventana `[max(0, iActiva - 3), iActiva + 3)`
  recortada a 6 entradas — y `ocultas` cuenta el resto. Si la fase activa no contiene la etapa
  activa, la ventana son las primeras 6.

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/lib/pipeline/indice.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { construirIndice, esperanDecision } from './indice'
import { deriveFases, derivePantallas } from './phases'
import { projectSignals } from './signals'
import { buildStages } from '@/lib/landscape/stages'
import { buildEtapasEstrategia } from '@/lib/estrategia/stages'

const señales = projectSignals({ sessions: [], tieneEntregable: false })

const base = () => ({
  projectId: 'p1',
  fases: deriveFases('p1', señales),
  pantallas: derivePantallas('p1', señales),
  etapaActiva: 'landscape:tendencias',
  stagesLandscape: buildStages([]),
  etapasEstrategia: buildEtapasEstrategia([]),
  esperanDecision: [] as string[],
})

describe('construirIndice', () => {
  it('agrupa entrevistas, propuesta y taller como tres entradas de una sola fase', () => {
    const [primera] = construirIndice(base())
    expect(primera.label).toBe('Entrevistas / Propuesta de valor')
    expect(primera.entradas.map(e => e.key)).toEqual(['entrevistas', 'propuesta', 'taller'])
  })

  it('la fase landscape trae sus seis etapas con href propio', () => {
    const fase = construirIndice(base()).find(f => f.key === 'landscape')!
    expect(fase.entradas).toHaveLength(6)
    expect(fase.entradas[0].href).toBe('/admin/projects/p1/landscape?etapa=setup')
  })

  it('marca como actual la etapa activa y sólo esa', () => {
    const fase = construirIndice(base()).find(f => f.key === 'landscape')!
    const actuales = fase.entradas.filter(e => e.estado === 'actual')
    expect(actuales.map(e => e.key)).toEqual(['landscape:tendencias'])
  })

  it('colapsa una fase de más de seis etapas y cuenta las ocultas', () => {
    const fase = construirIndice({ ...base(), etapaActiva: 'estrategia:personalidad' })
      .find(f => f.key === 'estrategia')!
    expect(fase.entradas).toHaveLength(6)
    expect(fase.ocultas).toBe(8)
    expect(fase.entradas.some(e => e.key === 'estrategia:personalidad')).toBe(true)
  })

  it('pone el rótulo del bloque en la primera etapa de cada bloque de estrategia', () => {
    // Sin colapso: con la primera etapa activa la ventana arranca en 0.
    const fase = construirIndice({ ...base(), etapaActiva: 'estrategia:diagnostico' })
      .find(f => f.key === 'estrategia')!
    expect(fase.entradas[0].bloque).toBe('Diagnóstico y consumidor')
    expect(fase.entradas[1].bloque).toBeUndefined()
  })

  it('marca espera=true sólo en las etapas que le pasaron', () => {
    const fase = construirIndice({ ...base(), esperanDecision: ['landscape:panorama'] })
      .find(f => f.key === 'landscape')!
    expect(fase.entradas.filter(e => e.espera).map(e => e.key)).toEqual(['landscape:panorama'])
  })

  it('el avance de una fase sin etapas propias sale del estado de la fase', () => {
    const [primera] = construirIndice(base())
    expect(primera.avance).toBe('Sin respondientes')
  })
})

describe('esperanDecision', () => {
  it('devuelve las etapas con versión sin aprobar, namespaceadas', () => {
    expect(esperanDecision('landscape', [
      { stage: 'setup', actual: { approvedAt: new Date() } },
      { stage: 'panorama', actual: { approvedAt: null } },
    ])).toEqual(['landscape:panorama'])
  })

  it('una etapa aprobada con borrador nuevo también espera', () => {
    expect(esperanDecision('estrategia', [
      { stage: 'personalidad', actual: { approvedAt: new Date() }, borradorNuevo: { id: 'v2' } },
    ])).toEqual(['estrategia:personalidad'])
  })

  it('una etapa sin nada guardado no espera a nadie', () => {
    expect(esperanDecision('landscape', [{ stage: 'setup', actual: null }])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run src/lib/pipeline/indice.test.ts`
Expected: FAIL con "Failed to resolve import ./indice".

- [ ] **Step 3: Implementar `construirIndice`**

Create `src/lib/pipeline/indice.ts`. La firma y los tipos son los del bloque **Produces** de arriba,
copiados tal cual. La implementación:

```ts
const VENTANA = 6

/** La ventana de etapas visibles cuando una fase tiene más de seis. */
function colapsar<T>(entradas: T[], iActiva: number): { visibles: T[]; ocultas: number } {
  if (entradas.length <= VENTANA) return { visibles: entradas, ocultas: 0 }
  const desde = iActiva < 0
    ? 0
    : Math.min(Math.max(0, iActiva - 3), entradas.length - VENTANA)
  return { visibles: entradas.slice(desde, desde + VENTANA), ocultas: entradas.length - VENTANA }
}
```

Para el estado de cada entrada: `'actual'` si su `key` es `etapaActiva`; si no, `'aprobada'` cuando
el `status` de la etapa es `'aprobada'`, `'no_aplica'` cuando es `'no_aplica'`, y `'pendiente'` en
el resto. Para las tres entradas de la fase 1, `'aprobada'` cuando la `Pantalla` correspondiente
está `completa`.

El `href` de una etapa de landscape/estrategia es
`/admin/projects/${projectId}/${fase}?etapa=${key}`; el de las tres primeras es la ruta de su
pantalla, sin query.

Para `esperanDecision`: recorre el estado y devuelve `` `${fase}:${e.stage}` `` cuando
`e.actual && !e.actual.approvedAt`, o cuando `e.borradorNuevo` existe.

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run src/lib/pipeline/indice.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/indice.ts src/lib/pipeline/indice.test.ts
git commit -m "feat(ux): el árbol de fases y etapas que consume el índice del proyecto"
```

---

### Task 3: Tokens de color y tipografía

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/app/globals.test.ts`

`--cream` **no se borra**: la entrevista pública lo usa (`bg-cream` en `InterviewLayout`). Lo que
cambia es que el panel deja de usarlo.

- [ ] **Step 1: Escribir el test que falla**

Create `src/app/globals.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, './globals.css'), 'utf8')

describe('tokens del panel', () => {
  it('define los tokens del rediseño con los valores del spec', () => {
    for (const [token, valor] of [
      ['--banana', '#FFD400'],
      ['--ink', '#15120C'],
      ['--line', '#EDEAE1'],
      ['--aprobado', '#FFF3B8'],
    ]) {
      expect(css).toContain(`${token}: ${valor}`)
    }
  })

  it('conserva --cream, que sigue usando la entrevista pública', () => {
    expect(css).toContain('--cream')
  })

  it('conserva el bloque de prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/app/globals.test.ts`
Expected: FAIL — `--banana` hoy vale `#ffd400` en minúscula y `--ink` vale `#1a1510`.

- [ ] **Step 3: Actualizar los tokens**

En `src/app/globals.css`, el bloque `:root` queda:

```css
:root {
  --cream: #fffdf2;        /* sólo la entrevista pública */
  --ink: #15120C;
  --banana: #FFD400;
  --line: #EDEAE1;
  --aprobado: #FFF3B8;
  --cuerpo: #2C281F;
  --secundario: #5C5648;
  --rotulo: #A8A296;
  --apagado: #B5AF9F;
}
```

El `body` pasa a `background: #fff; color: var(--cuerpo);`. Se conserva `.bg-cream`,
`.underline-banana`, las animaciones `animate-q`/`animate-fade` y el bloque de
`prefers-reduced-motion` tal cual: los usa la entrevista.

- [ ] **Step 4: Correr los tests**

Run: `npm test`
Expected: PASS. Ojo con los tests de la entrevista: si alguno afirma sobre `#1a1510`, actualizarlo
al valor nuevo sólo si el elemento es del panel; si es de la entrevista, revisar que el cambio de
`--ink` no la rompa visualmente (el tono es casi idéntico, `#1a1510` → `#15120C`).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/globals.test.ts
git commit -m "feat(ux): tokens del rediseño del panel, sin tocar los de la entrevista"
```

---

### Task 4: `ProjectIndex`

**Files:**
- Create: `src/components/ProjectIndex.tsx`
- Create: `src/components/ProjectIndex.test.tsx`

**Interfaces:**
- Consumes: `FaseIndice`, `EntradaIndice` de `@/lib/pipeline/indice` (Task 2).
- Produces: `<ProjectIndex nombre={string} subtitulo={string} fases={FaseIndice[]} />`

Es un server component (sin `'use client'`): sólo rinde links. El colapso ya viene resuelto por
`construirIndice`; el renglón `＋ n etapas más` es un link a la fase con `?todas=1`, no un toggle
con estado.

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/components/ProjectIndex.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectIndex } from './ProjectIndex'
import type { FaseIndice } from '@/lib/pipeline/indice'

const fases: FaseIndice[] = [
  {
    key: 'landscape', label: 'Landscape', avance: '2/6', ocultas: 0,
    entradas: [
      { key: 'landscape:setup', label: 'Setup', href: '/x?etapa=setup', estado: 'aprobada', espera: false },
      { key: 'landscape:tendencias', label: 'Tendencias', href: '/x?etapa=tendencias', estado: 'actual', espera: false },
      { key: 'landscape:panorama', label: 'Panorama', href: '/x?etapa=panorama', estado: 'pendiente', espera: true },
    ],
  },
  {
    key: 'estrategia', label: 'Estrategia', avance: '6 de 14', ocultas: 8,
    entradas: [
      { key: 'estrategia:personalidad', label: 'Personalidad', href: '/y?etapa=personalidad', estado: 'pendiente', bloque: 'Esencia de marca', espera: false },
    ],
  },
]

describe('ProjectIndex', () => {
  it('muestra el nombre del proyecto y su subtítulo', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="Estrategia · 6 de 14 etapas" fases={fases} />)
    expect(screen.getByText('Café Lunar')).toBeTruthy()
    expect(screen.getByText('Estrategia · 6 de 14 etapas')).toBeTruthy()
  })

  it('rinde cada fase con su avance', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    expect(screen.getByText('Landscape')).toBeTruthy()
    expect(screen.getByText('2/6')).toBeTruthy()
    expect(screen.getByText('6 de 14')).toBeTruthy()
  })

  it('marca la etapa actual con aria-current="page" y sólo esa', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    const actuales = screen.getAllByRole('link').filter(a => a.getAttribute('aria-current') === 'page')
    expect(actuales).toHaveLength(1)
    expect(actuales[0].textContent).toContain('Tendencias')
  })

  it('la etapa que espera al equipo lo dice de forma accesible, no sólo con color', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    const panorama = screen.getByRole('link', { name: /Panorama/ })
    expect(panorama.textContent).toContain('Espera al equipo')
  })

  it('ofrece revelar las etapas ocultas cuando la fase está colapsada', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    expect(screen.getByText('＋ 8 etapas más')).toBeTruthy()
  })

  it('no ofrece revelar nada cuando la fase no está colapsada', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={[fases[0]]} />)
    expect(screen.queryByText(/etapas más/)).toBeNull()
  })

  it('muestra el rótulo del bloque cuando la entrada lo trae', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    expect(screen.getByText('Esencia de marca')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run src/components/ProjectIndex.test.tsx`
Expected: FAIL con "Failed to resolve import ./ProjectIndex".

- [ ] **Step 3: Implementar el componente**

Create `src/components/ProjectIndex.tsx`. Estructura:

```tsx
import Link from 'next/link'
import type { EntradaIndice, FaseIndice } from '@/lib/pipeline/indice'

const PUNTO: Record<EntradaIndice['estado'], string> = {
  aprobada: 'bg-[var(--banana)]',
  actual: 'bg-white ring-1 ring-white/70',
  pendiente: 'bg-[#E0DCD0]',
  no_aplica: 'bg-transparent ring-1 ring-[#E0DCD0]',
}
```

- Contenedor: `<nav aria-label="Índice del proyecto" className="flex w-[222px] flex-none flex-col border-r border-[var(--line)]">`.
- Cabecera: nombre en `font-serif text-[16px] font-medium`, subtítulo en `text-[11.5px] text-[var(--rotulo)]`, con `border-b border-[var(--line)]` debajo.
- Cada fase: título en `text-[10px] font-bold uppercase tracking-[.15em] text-[var(--ink)]` con el `avance` a la derecha en `text-[10.5px] text-[#B5AF9F] tabular-nums`.
- Cada entrada: `<Link>` con `aria-current={estado === 'actual' ? 'page' : undefined}`, punto de 6px con la clase de `PUNTO`, label en `text-[13px]`. La activa lleva `bg-[var(--ink)] text-white font-semibold`.
- **Accesibilidad del "espera":** cuando `espera` es true, además del punto banana va
  `<span className="sr-only">Espera al equipo</span>`. El color no puede ser el único
  portador de la información.
- El bloque, cuando viene: `<p className="mt-2.5 px-3 text-[8.5px] font-bold uppercase tracking-[.13em] text-[#B5AF9F]">`.
- Las ocultas: `<Link href={...}>＋ {ocultas} etapas más</Link>` en `text-[#B5AF9F]`.

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run src/components/ProjectIndex.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProjectIndex.tsx src/components/ProjectIndex.test.tsx
git commit -m "feat(ux): índice del proyecto — fases como títulos, etapas como renglones"
```

---

### Task 5: La barra amarilla de tres estados

**Files:**
- Create: `src/components/BarraProyectos.tsx`
- Create: `src/components/BarraProyectos.test.tsx`
- Modify: `src/components/AdminShell.tsx`
- Create: `src/components/AdminShell.test.tsx`

**Interfaces:**
- Consumes: `Wordmark` de `./Brand`; `attentionItems`, `AttentionItem` de
  `@/lib/pipeline/attention`.
- Produces:

```ts
export interface ProyectoBarra {
  id: string
  name: string
  iniciales: string      // 'CL' — de las dos primeras palabras del nombre
  faseActual: string     // 'Estrategia · 6 de 14'
  espera: boolean
}

// Cliente: maneja riel ↔ abierta encima.
export function BarraProyectos(props: { proyectos: ProyectoBarra[]; activeProjectId: string }): JSX.Element

// Server: elige el estado según haya o no proyecto activo.
export async function AdminShell(props: {
  activeProjectId?: string
  indice?: React.ReactNode
  children: React.ReactNode
}): Promise<JSX.Element>
```

`AdminShell` gana la prop `indice`: las páginas de proyecto le pasan el `<ProjectIndex />` ya
armado, así el shell no consulta la base por etapas.

**Estado ancho** (sin `activeProjectId`), del spec sección 1: wordmark, rótulo `Panel`, una sola
sección real **Proyectos** con contador, y el bloque `Nos toca` con hasta tres ítems de
`attentionItems` filtrados por `bloqueo === 'equipo'`, **cada uno con el avatar de iniciales
delante**. Nada de "Entrevistas" ni "Archivo del estudio": esas rutas no existen.

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/components/BarraProyectos.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { BarraProyectos, type ProyectoBarra } from './BarraProyectos'

const proyectos: ProyectoBarra[] = [
  { id: 'a', name: 'Café Lunar', iniciales: 'CL', faseActual: 'Estrategia · 6 de 14', espera: false },
  { id: 'b', name: 'Vestir Bien', iniciales: 'VB', faseActual: 'Propuesta de valor', espera: true },
]

describe('BarraProyectos', () => {
  it('arranca recogida: muestra iniciales, no nombres', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    expect(screen.getByText('CL')).toBeTruthy()
    expect(screen.queryByText('Café Lunar')).toBeNull()
  })

  it('el control de abrir declara aria-expanded=false y lo alterna', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    const boton = screen.getByRole('button', { name: /Ver los nombres/ })
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(boton)
    expect(boton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Café Lunar')).toBeTruthy()
  })

  it('Escape la vuelve a recoger', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    fireEvent.click(screen.getByRole('button', { name: /Ver los nombres/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Café Lunar')).toBeNull()
  })

  it('marca el proyecto activo con aria-current', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    const activo = screen.getByRole('link', { name: /CL/ })
    expect(activo.getAttribute('aria-current')).toBe('page')
  })

  it('el proyecto que espera al equipo lo dice de forma accesible', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    expect(screen.getByRole('link', { name: /VB/ }).textContent).toContain('Tiene algo esperando')
  })
})

describe('PanelIndiceMovil', () => {
  it('arranca cerrado y abre el índice al tocarlo', () => {
    render(<PanelIndiceMovil><p>Índice del proyecto</p></PanelIndiceMovil>)
    const boton = screen.getByRole('button', { name: /Abrir el índice/ })
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Índice del proyecto')).toBeNull()
    fireEvent.click(boton)
    expect(screen.getByText('Índice del proyecto')).toBeTruthy()
  })

  it('Escape lo cierra', () => {
    render(<PanelIndiceMovil><p>Índice del proyecto</p></PanelIndiceMovil>)
    fireEvent.click(screen.getByRole('button', { name: /Abrir el índice/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Índice del proyecto')).toBeNull()
  })
})
```

El import del test es `import { BarraProyectos, PanelIndiceMovil, type ProyectoBarra } from './BarraProyectos'`.

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run src/components/BarraProyectos.test.tsx`
Expected: FAIL con "Failed to resolve import ./BarraProyectos".

- [ ] **Step 3: Implementar `BarraProyectos`**

Create `src/components/BarraProyectos.tsx` con `'use client'` arriba. Un `useState` para
`abierta`, un `useEffect` que registra `keydown` y cierra con `Escape`. El riel es
`w-[58px] bg-[var(--banana)]`; la capa abierta es `absolute inset-y-0 left-0 w-[230px]
bg-[var(--banana)] shadow-[14px_0_34px_rgba(0,0,0,.22)]` con un velo hermano
`absolute inset-0 bg-[rgba(21,18,12,.14)]`. Ambos aparecen con `onMouseEnter` en el riel y por
clic en el botón; el botón tiene `aria-expanded` y `aria-label="Ver los nombres de los proyectos"`.

Avatares: `h-[34px] w-[34px] rounded-[9px] font-serif text-[13px]`; el activo
`bg-[var(--ink)] text-white`, el resto `bg-[rgba(21,18,12,.1)]`. El `espera` agrega el punto
con anillo **y** `<span className="sr-only">Tiene algo esperando</span>`.

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run src/components/BarraProyectos.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Escribir el test de las funciones puras de la barra**

Create `src/components/barra.ts` **y** `src/components/barra.test.ts`.

**Por qué un módulo aparte y no `AdminShell.tsx`:** `AdminShell` importa `@/lib/db/client`, que
ejecuta `neon(process.env.DATABASE_URL!)` en el momento del import. Cualquier test que importe
`AdminShell` falla con *"No database connection string was provided to `neon()`"* antes de correr
una sola aserción. Verificado. Las funciones puras viven en `barra.ts`, que no importa nada de
base, y `AdminShell` las importa desde ahí.

```ts
import { describe, it, expect } from 'vitest'
import { estadoBarra, iniciales } from './barra'

describe('estadoBarra', () => {
  it('es ancha sin proyecto activo y riel con uno', () => {
    expect(estadoBarra(undefined)).toBe('ancha')
    expect(estadoBarra('p1')).toBe('riel')
  })
})

describe('iniciales', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(iniciales('Café Lunar')).toBe('CL')
    expect(iniciales('Almacén del Sur')).toBe('AD')
  })

  it('con una sola palabra toma las dos primeras letras', () => {
    expect(iniciales('Lunar')).toBe('LU')
  })
})
```

- [ ] **Step 6: Correr el test para verificar que falla**

Run: `npx vitest run src/components/barra.test.ts`
Expected: FAIL con "Failed to resolve import ./barra".

- [ ] **Step 7: Crear `barra.ts` y reescribir `AdminShell`**

Create `src/components/barra.ts` — sin imports de base, sin JSX:

```ts
/** Ancha cuando elegís proyecto, riel cuando estás adentro de uno. Sale de la ruta, no de estado. */
export const estadoBarra = (activeProjectId?: string): 'ancha' | 'riel' =>
  activeProjectId ? 'riel' : 'ancha'

/** 'Café Lunar' → 'CL'. Con una sola palabra, sus dos primeras letras. */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/)
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  return (palabras[0][0] + palabras[1][0]).toUpperCase()
}
```

Modify `src/components/AdminShell.tsx` para importarlas de `./barra`.

El componente mantiene su carga de datos actual (`listProjectsWithCounts` + `landscapeState` +
`strategyState` por proyecto, con el N+1 aceptado y ya comentado). Con `estadoBarra === 'ancha'`
rinde la barra ancha descrita arriba; con `'riel'` rinde `<BarraProyectos />` seguido de
`{indice}`. El `<main>` pierde `max-w-6xl`: el área de trabajo ahora usa todo el ancho y es el
documento el que limita a `60ch`.

**Móvil** (spec sección 8). Por debajo de `md`, la barra amarilla y el índice se ocultan
(`hidden md:flex`, como hoy hace el `<aside>`) y se conserva la cabecera oscura existente,
que gana un botón cuando hay `indice`:

```tsx
<header className="flex items-center justify-between bg-[var(--ink)] px-6 py-4 md:hidden">
  <Link href="/admin" className="text-[15px] font-medium text-white"><Wordmark /></Link>
  {indice
    ? <PanelIndiceMovil>{indice}</PanelIndiceMovil>
    : <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Panel interno</span>}
</header>
```

`PanelIndiceMovil` es un cliente chico en el mismo archivo que `BarraProyectos`: un `button` con
`aria-expanded` y `aria-label="Abrir el índice del proyecto"` que despliega el índice como panel
desde la izquierda (`fixed inset-y-0 left-0 w-[260px] bg-white shadow-2xl`), con velo y cierre
por `Escape`. Reusa el mismo `useEffect` de `Escape` que `BarraProyectos`; extraer ese efecto a
un hook `useCerrarConEscape(cerrar: () => void, activo: boolean)` en el mismo archivo, para no
duplicarlo.

- [ ] **Step 8: Correr los tests**

Run: `npm test`
Expected: PASS. `ProjectHeader.test.tsx` sigue verde: todavía no se tocó.

- [ ] **Step 9: Commit**

```bash
git add src/components/BarraProyectos.tsx src/components/BarraProyectos.test.tsx src/components/barra.ts src/components/barra.test.ts src/components/AdminShell.tsx
git commit -m "feat(ux): barra amarilla de tres estados — ancha, riel y abierta encima"
```

---

### Task 6: El documento de la etapa y el comparador de versiones

**Files:**
- Create: `src/components/EtapaDocumento.tsx`
- Create: `src/components/EtapaDocumento.test.tsx`
- Create: `src/components/ComparadorVersiones.tsx`
- Create: `src/components/ComparadorVersiones.test.tsx`
- Modify: `src/app/admin/projects/[id]/landscape/ContenidoEtapa.tsx`
- Modify: `src/app/admin/projects/[id]/landscape/ContenidoEtapa.test.tsx`

**Interfaces:**
- Consumes: `ContenidoEtapa` de `../app/admin/projects/[id]/landscape/ContenidoEtapa`.
- Produces:

```tsx
export function EtapaDocumento(props: {
  ubicacion: string            // 'Estrategia · etapa 7 de 14'
  titulo: string
  content: unknown
  procedencia: string          // 'Escrito por Claude hace 2 h · sin aprobar'
  aprobada: boolean
  anterior?: { label: string; href: string }
  siguiente?: { label: string; href: string }
  onAprobar: () => void
  onPedirOtra?: () => void
  guardando?: boolean
  error?: string | null
}): JSX.Element

export function ComparadorVersiones(props: {
  aprobada: { content: unknown; cuando: string }
  nueva: { content: unknown; cuando: string }
  onMantener: () => void
  onAprobarNueva: () => void
  guardando?: boolean
}): JSX.Element
```

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/components/EtapaDocumento.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { EtapaDocumento } from './EtapaDocumento'

const base = {
  ubicacion: 'Estrategia · etapa 7 de 14',
  titulo: 'Personalidad',
  content: { rasgos: 'Cercana sin ser confianzuda', como_habla: 'Frases cortas' },
  procedencia: 'Escrito por Claude hace 2 h · sin aprobar',
  aprobada: false,
  onAprobar: () => {},
}

describe('EtapaDocumento', () => {
  it('muestra ubicación, título y procedencia', () => {
    render(<EtapaDocumento {...base} />)
    expect(screen.getByText('Estrategia · etapa 7 de 14')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Personalidad' })).toBeTruthy()
    expect(screen.getByText(/Escrito por Claude hace 2 h/)).toBeTruthy()
  })

  it('ofrece aprobar cuando la versión no está aprobada', () => {
    const onAprobar = vi.fn()
    render(<EtapaDocumento {...base} onAprobar={onAprobar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar etapa' }))
    expect(onAprobar).toHaveBeenCalledOnce()
  })

  it('no ofrece aprobar cuando ya está aprobada', () => {
    render(<EtapaDocumento {...base} aprobada procedencia="Aprobada por Flor · 12 ago" />)
    expect(screen.queryByRole('button', { name: 'Aprobar etapa' })).toBeNull()
  })

  it('rinde anterior y siguiente con el nombre de la etapa vecina', () => {
    render(<EtapaDocumento {...base}
      anterior={{ label: 'Arquetipo', href: '/x?etapa=arquetipo' }}
      siguiente={{ label: 'Valores', href: '/x?etapa=valores' }} />)
    expect(screen.getByRole('link', { name: /Arquetipo/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Valores/ })).toBeTruthy()
  })

  it('deshabilita el botón mientras guarda y muestra el error', () => {
    render(<EtapaDocumento {...base} guardando error="No se pudo guardar" />)
    expect(screen.getByRole('button', { name: /Guardando/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('No se pudo guardar')).toBeTruthy()
  })
})
```

Create `src/components/ComparadorVersiones.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { ComparadorVersiones } from './ComparadorVersiones'

const props = {
  aprobada: { content: { territorio: 'El café de barrio' }, cuando: '12 ago' },
  nueva: { content: { territorio: 'El café como pausa deliberada' }, cuando: 'hace 2 h' },
  onMantener: () => {},
  onAprobarNueva: () => {},
}

describe('ComparadorVersiones', () => {
  it('rinde las dos columnas rotuladas', () => {
    render(<ComparadorVersiones {...props} />)
    expect(screen.getByText(/Vigente · aprobada/)).toBeTruthy()
    expect(screen.getByText(/Nueva de Claude/)).toBeTruthy()
    expect(screen.getByText('El café de barrio')).toBeTruthy()
    expect(screen.getByText('El café como pausa deliberada')).toBeTruthy()
  })

  it('ofrece las dos decisiones y las reporta', () => {
    const onMantener = vi.fn()
    const onAprobarNueva = vi.fn()
    render(<ComparadorVersiones {...props} onMantener={onMantener} onAprobarNueva={onAprobarNueva} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mantener la aprobada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar la nueva' }))
    expect(onMantener).toHaveBeenCalledOnce()
    expect(onAprobarNueva).toHaveBeenCalledOnce()
  })

  it('explica que lo aprobado sigue vigente', () => {
    render(<ComparadorVersiones {...props} />)
    expect(screen.getByText(/sigue vigente hasta que decidas/)).toBeTruthy()
  })
})
```

Modify `ContenidoEtapa.test.tsx` — agregar al describe existente:

```tsx
it('rinde cada campo como fila de rótulo y valor, no como caja anidada', () => {
  const { container } = render(<ContenidoEtapa content={{ territorio_central: 'La pausa' }} />)
  expect(screen.getByText('Territorio central')).toBeTruthy()
  expect(screen.getByText('La pausa')).toBeTruthy()
  expect(container.querySelector('.bg-\\[\\#faf7ee\\]')).toBeNull()
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run src/components/EtapaDocumento.test.tsx src/components/ComparadorVersiones.test.tsx "src/app/admin/projects/[id]/landscape/ContenidoEtapa.test.tsx"`
Expected: FAIL — los dos primeros por import, el tercero por la caja `#faf7ee` que todavía existe.

- [ ] **Step 3: Reescribir `ContenidoEtapa`**

El `humanizar`, el manejo de arrays anidados y el `SIN_DATOS` se conservan tal cual — ya están
probados y resuelven el jsonb libre. Lo que cambia es `Campos` y el contenedor de nivel superior:

```tsx
function Campos({ objeto }: { objeto: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {Object.entries(objeto).map(([clave, valor]) => (
        <div key={clave} className="flex flex-col gap-1 sm:flex-row sm:gap-6">
          <p className="w-[112px] flex-none pt-[3px] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">
            {humanizar(clave)}
          </p>
          <div className="min-w-0 max-w-[60ch] flex-1"><Valor valor={valor} /></div>
        </div>
      ))}
    </div>
  )
}
```

El nivel superior usa el mismo patrón con `border-b border-[var(--line)]` entre filas. `Valor`
pasa el texto a `text-[14px] leading-[1.66] text-[var(--cuerpo)]`. Desaparece
`rounded-xl bg-[#faf7ee] p-3`.

En móvil (`flex-col`) el rótulo va arriba del valor, como pide el spec sección 8.

- [ ] **Step 4: Implementar `EtapaDocumento` y `ComparadorVersiones`**

Create los dos archivos con `'use client'` (usan handlers). `EtapaDocumento`: ubicación en
versalitas, `<h1 className="font-serif text-[30px] font-normal tracking-[-.02em]">`, el
`<ContenidoEtapa />`, y el pie `border-t-[1.5px] border-[var(--ink)]` con la procedencia a la
izquierda y los botones a la derecha — `Pedir otra versión` hairline, `Aprobar etapa`
`bg-[var(--banana)] text-[var(--ink)]`. El botón muestra `Guardando…` y va `disabled` con
`guardando`. Anterior/siguiente como links hairline redondeados, con `‹`/`›` y el nombre.

`ComparadorVersiones`: marco `border border-[var(--line)] rounded-[9px]` partido en dos columnas
con `divide-x`; cabecera izquierda `bg-[#F8F6F0]`, derecha `bg-[var(--banana)]`; cada cuerpo rinde
su `<ContenidoEtapa />`. Arriba, la franja `bg-[var(--ink)] text-white` con el texto:

```
Claude reescribió esta etapa después de que el equipo la aprobara. Lo aprobado sigue vigente hasta que decidas.
```

- [ ] **Step 5: Correr los tests**

Run: `npx vitest run src/components/EtapaDocumento.test.tsx src/components/ComparadorVersiones.test.tsx "src/app/admin/projects/[id]/landscape/ContenidoEtapa.test.tsx"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/EtapaDocumento.tsx src/components/EtapaDocumento.test.tsx src/components/ComparadorVersiones.tsx src/components/ComparadorVersiones.test.tsx "src/app/admin/projects/[id]/landscape/ContenidoEtapa.tsx" "src/app/admin/projects/[id]/landscape/ContenidoEtapa.test.tsx"
git commit -m "feat(ux): la etapa como documento editorial y el conflicto de versiones como pantalla"
```

---

### Task 7: Conectar los workspaces y borrar `ProjectHeader`

La tarea que hace visible todo lo anterior. Es la más grande; por eso viene después de que sus
piezas ya están probadas.

**Files:**
- Modify: `src/app/admin/projects/[id]/landscape/LandscapeWorkspace.tsx` + `.test.tsx`
- Modify: `src/app/admin/projects/[id]/estrategia/EstrategiaWorkspace.tsx` + `.test.tsx`
- Modify: las 5 páginas de `src/app/admin/projects/[id]/*/page.tsx`
- Delete: `src/components/ProjectHeader.tsx`, `src/components/ProjectHeader.test.tsx`

**Interfaces:**
- Consumes: `construirIndice` (Task 2), `ProjectIndex` (Task 4), `AdminShell` con prop `indice`
  (Task 5), `EtapaDocumento` y `ComparadorVersiones` (Task 6).
- Produces: nada nuevo.

**Cambio de contrato en los workspaces:** la etapa activa deja de vivir en `useState` y pasa a
venir de la query string (`?etapa=`), porque ahora quien navega es el índice, que rinde links.
Cada workspace recibe `etapaActiva: string` como prop desde su page, que la lee de `searchParams`.

- [ ] **Step 1: Actualizar el test de `LandscapeWorkspace`**

En `LandscapeWorkspace.test.tsx`, reemplazar las aserciones sobre el carril de etapas
(`getByRole('button', ...)` de `StageRow`) por la nueva forma. Los tests del gate de tendencias
se conservan íntegros — esa lógica no cambia. Agregar:

```tsx
it('la etapa que se muestra sale de la prop, no de un estado interno', () => {
  render(<LandscapeWorkspace {...props} etapaActiva="panorama" />)
  expect(screen.getByRole('heading', { name: 'Panorama de categoría' })).toBeTruthy()
})

it('con borrador nuevo rinde el comparador en vez del documento simple', () => {
  render(<LandscapeWorkspace {...propsConBorrador} etapaActiva="contexto" />)
  expect(screen.getByRole('button', { name: 'Mantener la aprobada' })).toBeTruthy()
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run "src/app/admin/projects/[id]/landscape/LandscapeWorkspace.test.tsx"`
Expected: FAIL — `etapaActiva` no es una prop todavía.

- [ ] **Step 3: Reescribir `LandscapeWorkspace`**

- Se va el `grid lg:grid-cols-[176px_minmax(0,1fr)_248px]` y con él el `<nav>` de etapas y el
  `<aside>` de actividad. Queda una sola columna.
- Se va `useState<StageKey>` y `irAEtapa`; entra `etapaActiva` como prop.
- `viendoBorrador` se conserva sólo si el comparador lo necesita; con `ComparadorVersiones`
  mostrando las dos a la vez, **se elimina** — junto con `AvisoBorradorNuevo`, que el comparador
  reemplaza.
- El gate de tendencias (`aprobarSeleccion`, `TendenciaCard`, `MIN/MAX_TENDENCIAS`) se conserva
  con su lógica intacta; sólo cambia su presentación: las tarjetas pasan a filas hairline y la
  barra negra flotante pasa al pie de decisión de `EtapaDocumento`.
- La actividad pasa a una sección al final del documento; el bloque "Conectado a Claude"
  **se elimina** (decisión del spec, sección 7).

- [ ] **Step 4: Correr los tests del landscape**

Run: `npx vitest run "src/app/admin/projects/[id]/landscape/"`
Expected: PASS.

- [ ] **Step 5: Reescribir `EstrategiaWorkspace`**

Los cambios, uno por uno (no mirar la Task anterior: acá el archivo es distinto):

- Se elimina el `grid` de dos columnas y con él el carril agrupado desplegable: `EtapaRow`,
  `EtapaDot`, el `useState` del grupo abierto y el import de `BLOQUES`. Los bloques los rinde
  ahora el índice.
- Se elimina `useState<EstrategiaKey>` y entra `etapaActiva: EstrategiaKey` como prop.
- Se eliminan `AvisoBorradorNuevo` y `viendoBorrador`: los reemplaza `ComparadorVersiones`.
- `aprobarVersion` se conserva con su `fetch` a `/api/projects/${projectId}/estrategia/${etapa}`
  intacto; lo que cambia es quién lo dispara (el pie de `EtapaDocumento`).
- El render queda: si la etapa tiene `borradorNuevo`, `<ComparadorVersiones />`; si tiene
  contenido, `<EtapaDocumento />`; si no, el vacío "Esta etapa todavía no tiene una versión
  guardada", ahora sin la caja `rounded-2xl … shadow-sm`.
- `anterior`/`siguiente` salen de `ETAPA_ORDER`: el elemento previo y el siguiente de
  `ETAPA_ORDER.indexOf(etapaActiva)`, con su `ETAPA_LABEL` y su href `?etapa=<key>`. En los
  extremos, la prop va `undefined`.

Run: `npx vitest run "src/app/admin/projects/[id]/estrategia/"`
Expected: PASS.

- [ ] **Step 6: Conectar las cinco páginas**

En cada `page.tsx`, reemplazar `<ProjectHeader ... />` por el índice pasado al shell. Las cinco
páginas ya cargan `landscapeEstado`, `estrategia` y arman `señales`: eso no cambia. Ejemplo
completo, el de estrategia:

```tsx
export default async function EstrategiaView({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ etapa?: string }>
}) {
  const { id } = await params
  const { etapa } = await searchParams
  // …carga existente: project, deliverable, landscapeEstado, estado, etapas, resumen, señales…

  // La query manda, pero sólo si nombra una etapa real: una `?etapa=` inventada cae a la
  // primera sin aprobar en vez de romper la página.
  const primeraSinAprobar = etapas.find(e => e.status !== 'aprobada')?.key ?? ETAPA_ORDER[0]
  const etapaActiva: EstrategiaKey =
    etapa && (ETAPA_ORDER as string[]).includes(etapa) ? (etapa as EstrategiaKey) : primeraSinAprobar

  const fases = deriveFases(id, señales)
  const pantallas = derivePantallas(id, señales)
  const indice = construirIndice({
    projectId: id,
    fases,
    pantallas,
    etapaActiva: `estrategia:${etapaActiva}`,
    stagesLandscape: buildStages(landscapeEstado),
    etapasEstrategia: etapas,
    esperanDecision: [
      ...esperanDecision('landscape', landscapeEstado),
      ...esperanDecision('estrategia', estado),
    ],
  })

  const actual = pantallaActual(fases, pantallas)

  return (
    <AdminShell
      activeProjectId={id}
      indice={
        <ProjectIndex
          nombre={project.name}
          subtitulo={`${actual.label} · ${actual.detalle}`}
          fases={indice}
        />
      }
    >
      <EstrategiaWorkspace projectId={id} etapaActiva={etapaActiva} etapas={etapas}
        resumen={resumen} contenidoPorEtapa={contenidoPorEtapa} />
    </AdminShell>
  )
}
```

Las otras cuatro páginas son el mismo patrón con dos diferencias: `etapaActiva` es su propia key
sin namespace (`'entrevistas'`, `'propuesta'`, `'taller'`) o con el de landscape
(`` `landscape:${etapaActiva}` ``), y las tres primeras no leen `searchParams` porque no tienen
etapas internas.

- [ ] **Step 7: Borrar `ProjectHeader`**

```bash
git rm src/components/ProjectHeader.tsx src/components/ProjectHeader.test.tsx
grep -rn "ProjectHeader" src   # tiene que no devolver nada
```

- [ ] **Step 8: Suite completa y compilación**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: todo verde. El flake conocido de pglite bajo carga puede aparecer en corrida fría:
repetir antes de dar por rota la suite.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ux): el índice reemplaza la cabecera por grupos y los carriles de los workspaces"
```

---

### Task 8: El listado de `/admin`

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/lib/pipeline/attention.ts`
- Modify: `src/lib/pipeline/attention.test.ts`

- [ ] **Step 1: Escribir el test que falla**

**Mismo motivo que en la Task 5:** `admin/page.tsx` importa `@/lib/db/client`, que ejecuta
`neon(process.env.DATABASE_URL!)` al importarse, así que un test que importe la página falla antes
de la primera aserción. La función pura va a `attention.ts` — sólo importa tipos de `./phases` y es
su tema natural, la cola del equipo.

Agregar al final de `src/lib/pipeline/attention.test.ts` (el import de `vitest` ya está arriba):

```ts
import { mostrarSeccionEsperando } from './attention'

describe('mostrarSeccionEsperando', () => {
  it('con tres pendientes o menos, la barra ya los muestra y la sección sobra', () => {
    expect(mostrarSeccionEsperando(0)).toBe(false)
    expect(mostrarSeccionEsperando(3)).toBe(false)
  })

  it('con más de tres, la sección se justifica', () => {
    expect(mostrarSeccionEsperando(4)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/pipeline/attention.test.ts`
Expected: FAIL — `mostrarSeccionEsperando` no existe.

- [ ] **Step 3: Agregar la función y reescribir el listado**

En `src/lib/pipeline/attention.ts`:

```ts
/** La barra amarilla ya muestra hasta tres pendientes; repetirlos es el ruido que estamos sacando. */
export const mostrarSeccionEsperando = (pendientes: number) => pendientes > 3
```

`admin/page.tsx` la importa de `@/lib/pipeline/attention`.

La `<table>` con `<thead>` gris se reemplaza por filas hairline: nombre en
`font-serif text-[19px]`, fase actual y detalle debajo en `text-[12.5px] text-[var(--secundario)]`,
chip de estado (`Nos toca` `bg-[var(--banana)]` / `Esperando` `bg-[#F3F0E7] text-[#7E7868]`), las
tres marcas del recorrido y el "hace cuánto" a la derecha. Se van `rounded-2xl`, `border-black/5`
y `shadow-sm`.

- [ ] **Step 4: Correr los tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/lib/pipeline/attention.ts src/lib/pipeline/attention.test.ts
git commit -m "feat(ux): listado de proyectos con hairlines, sin tabla ni tarjetas"
```

---

### Task 9: Barrido de restos del lenguaje viejo

**Files:**
- Modify: los que aparezcan en el grep.
- Create: `src/components/panel-visual.test.ts`

- [ ] **Step 1: Escribir el test canario**

Create `src/components/panel-visual.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/** Archivos del panel: la entrevista pública tiene su propio lenguaje y no entra acá. */
function archivosDelPanel(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === 'interview' || e === 'gracias') continue
      archivosDelPanel(p, acc)
    } else if (/\.tsx$/.test(e) && !/\.test\.tsx$/.test(e)) acc.push(p)
  }
  return acc
}

const raiz = path.resolve(__dirname, '..')
const panel = [
  ...archivosDelPanel(path.join(raiz, 'app', 'admin')),
  path.join(raiz, 'components', 'AdminShell.tsx'),
  path.join(raiz, 'components', 'ProjectIndex.tsx'),
  path.join(raiz, 'components', 'EtapaDocumento.tsx'),
  path.join(raiz, 'components', 'BarraProyectos.tsx'),
  path.join(raiz, 'components', 'ComparadorVersiones.tsx'),
]

describe('lenguaje visual del panel', () => {
  it('no quedan grises del lenguaje viejo', () => {
    const viejos = ['#a59c89', '#8a8170', '#6b6155', '#4a4438', '#b3ab9b', '#fffdf0', '#faf7ee']
    for (const f of panel) {
      const src = readFileSync(f, 'utf8').toLowerCase()
      for (const g of viejos) expect(`${f}: ${src.includes(g) ? g : 'ok'}`).toBe(`${f}: ok`)
    }
  })

  it('no quedan tarjetas con sombra en el panel', () => {
    for (const f of panel) {
      const src = readFileSync(f, 'utf8')
      expect(`${f}: ${src.includes('shadow-sm') ? 'shadow-sm' : 'ok'}`).toBe(`${f}: ok`)
    }
  })
})
```

- [ ] **Step 2: Correr el test para ver qué quedó**

Run: `npx vitest run src/components/panel-visual.test.ts`
Expected: FAIL, listando los archivos con restos. Esa lista es el trabajo de esta tarea.

- [ ] **Step 3: Limpiar cada archivo que aparezca**

Reemplazar por los tokens: `#a59c89` → `var(--rotulo)`, `#8a8170`/`#6b6155` →
`var(--secundario)`, `#4a4438` → `var(--cuerpo)`, `#b3ab9b` → `var(--apagado)`, `#fffdf0` →
`var(--aprobado)` donde marca aprobación, blanco donde era fondo. Quitar `shadow-sm` y los
`rounded-2xl border border-black/5` que envuelven contenido.

Los candidatos conocidos: `PhaseNote.tsx`, `StatePill.tsx`, `ProgressDots.tsx`,
`RespondentsList.tsx`, `DeliverablePanel.tsx`, `DeliverableDocument.tsx`, `admin/login/page.tsx`,
`admin/[sessionId]/page.tsx`.

**No tocar** `InterviewLayout.tsx`, `MicButton.tsx`, `ProjectiveScreen.tsx`, `InterviewScreen.tsx`,
`ColorGrid.tsx`, `AgeGrid.tsx`, `GenderChoice.tsx`, `Breather.tsx`, `IdentityForm.tsx`,
`ImageGrid.tsx`, `SectionNav.tsx`: son de la entrevista pública, fuera de alcance.

- [ ] **Step 4: Correr todo**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: verde.

- [ ] **Step 5: Verificar el canario de tipografía**

Run: `npx vitest run -t "tipograf"`
Expected: PASS. Si falla, alguien aplanó las comillas tipográficas al editar texto de UI.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(ux): barrido de los grises y las tarjetas del lenguaje viejo en el panel"
```

---

## Verificación final (manual, con el usuario)

Antes de mergear, en el dev server (puerto 3001; el 3000 lo toma otro proyecto), con Cafe Lunar
sembrado:

- [ ] `/admin` — barra ancha con la cola "Nos toca", listado con hairlines, sin tabla.
- [ ] Clic en un proyecto — la barra se recoge a riel, aparece el índice, no se desplaza el contenido.
- [ ] Hover en el riel — la barra se abre encima con los nombres; `Escape` la cierra; con teclado
      el botón `»` responde y expone `aria-expanded`.
- [ ] Landscape — 6 etapas en el índice, documento editorial, pie de decisión, anterior/siguiente.
- [ ] Estrategia — 14 etapas con los tres bloques rotulados, colapso con `＋ n etapas más`.
- [ ] Una etapa con borrador nuevo — el comparador de dos columnas con las dos decisiones.
- [ ] Móvil (DevTools, 390px) — cabecera oscura, índice como panel, campos en una columna.
- [ ] `prefers-reduced-motion: reduce` activado — nada se mueve.

## Riesgos conocidos

- **`tienePostTaller` está hardcodeada en `false`** (`signals.ts:27`): la fase Taller nunca se
  completa. El índice lo va a mostrar con la misma honestidad que hoy la cabecera. No se arregla
  acá.
- **N+1 en `AdminShell` y en `/admin`**: dos lecturas por proyecto, ya aceptado y comentado en el
  código. El rediseño no lo empeora ni lo arregla.
- **Flake de pglite** bajo carga en corridas frías de la suite completa: verde al repetir.
- **La rama `fase3-pipeline-estrategia` sigue sin mergear.** Este trabajo va encima de ella, no de
  `main`: el índice depende de las 14 etapas de estrategia que introdujo esa rama.
