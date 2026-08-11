# Fase 3 — Pipeline de estrategia · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** las 14 etapas del Proceso de Estrategia versionadas en la plataforma (borrador de Claude → aprobación humana en el panel), expuestas por MCP.

**Architecture:** espejo del patrón fase 2: tablas paralelas `strategy_stages`/`strategy_versions`, store paralelo, validación por etapa antes de tocar la base, herramientas MCP simétricas (`guardar_etapa` con `fase`, `estado_estrategia`, `contexto_proyecto` ampliado) y panel espejo del landscape. Spec: `valkyria/specs/2026-08-11-fase3-pipeline-estrategia-design.md`.

**Tech Stack:** Next.js 16 (App Router), Drizzle + Neon, mcp-handler + zod, Vitest + PGlite.

## Global Constraints

- Código, comentarios y mensajes en castellano, con la voz de los archivos vecinos (leé el archivo espejo antes de escribir el tuyo).
- Comillas tipográficas `“ ”` en los mensajes de usuario donde el vecino las use — NO las aplanes a `"` (hay test canario en el repo).
- Claude nunca aprueba: toda escritura MCP es borrador con `author: 'claude'`. Aprobar vive en el panel.
- Validar antes de resolver el proyecto y antes de tocar la base: una escritura mal formada no deja rastro.
- Migraciones solo aditivas; columnas de tiempo nuevas con `{ withTimezone: true }`.
- El email del entrevistado nunca sale hacia el chat.
- Tests con PGlite, sin red. `npx vitest run <archivo>` por tarea; la suite completa al final (el flake conocido de pglite bajo carga se re-corre una vez antes de investigar).
- Commits chicos por tarea, mensajes estilo `feat(estrategia): …` / `test(estrategia): …`.

---

### Task 1: Modelo de etapas de estrategia

**Files:**
- Create: `src/lib/estrategia/stages.ts`
- Test: `src/lib/estrategia/stages.test.ts`

**Interfaces:**
- Consumes: `StageStatus` de `@/lib/landscape/stages` (mismos estados, misma semántica).
- Produces: `EstrategiaKey`, `ETAPA_ORDER: EstrategiaKey[]` (14), `ESENCIA: EstrategiaKey[]` (11), `ETAPA_LABEL: Record<EstrategiaKey, string>`, `ETAPA_HINT: Partial<Record<EstrategiaKey, string>>`, `buildEtapasEstrategia(estado: { stage: EstrategiaKey; status: StageStatus }[]): EtapaEstrategia[]`.

- [ ] **Step 1: Test que falla**

```ts
// src/lib/estrategia/stages.test.ts
import { describe, expect, it } from 'vitest'
import { ETAPA_ORDER, ETAPA_LABEL, ETAPA_HINT, ESENCIA, buildEtapasEstrategia } from './stages'

describe('etapas de estrategia', () => {
  it('son 14, arrancan en diagnóstico y cierran en cuadros', () => {
    expect(ETAPA_ORDER).toHaveLength(14)
    expect(ETAPA_ORDER[0]).toBe('diagnostico')
    expect(ETAPA_ORDER[13]).toBe('cuadros')
  })

  it('la esencia son las 11 etapas entre consumidor y cuadros', () => {
    expect(ESENCIA).toEqual(ETAPA_ORDER.slice(2, 13))
  })

  it('toda etapa tiene label, y cuadros tiene su hint', () => {
    for (const k of ETAPA_ORDER) expect(ETAPA_LABEL[k]).toBeTruthy()
    expect(ETAPA_HINT.cuadros).toBe('se llena desde lo aprobado')
  })

  it('buildEtapasEstrategia devuelve las 14 aunque no haya filas', () => {
    const etapas = buildEtapasEstrategia([])
    expect(etapas).toHaveLength(14)
    expect(etapas.every(e => e.status === 'pendiente')).toBe(true)
  })

  it('buildEtapasEstrategia respeta el estado guardado', () => {
    const etapas = buildEtapasEstrategia([{ stage: 'concepto', status: 'aprobada' }])
    expect(etapas.find(e => e.key === 'concepto')?.status).toBe('aprobada')
  })
})
```

- [ ] **Step 2: Correr y ver el fallo**

Run: `npx vitest run src/lib/estrategia/stages.test.ts` — Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementación**

```ts
// src/lib/estrategia/stages.ts
/**
 * Modelo de las etapas del Proceso de Estrategia (fase 3).
 * Ver valkyria/specs/2026-08-11-fase3-pipeline-estrategia-design.md y
 * docs/fase3/Procesos Estrategia y Naming.pdf (bloques 1–4).
 */
import type { StageStatus } from '@/lib/landscape/stages'

export type EstrategiaKey =
  | 'diagnostico' | 'consumidor'
  | 'rtbs' | 'concepto' | 'beneficios' | 'arquetipo' | 'personalidad' | 'valores'
  | 'territorio' | 'brand_ideal' | 'ingredients' | 'tagline' | 'manifiesto'
  | 'cuadros'

/**
 * El orden es de referencia, como en el PDF: la plataforma muestra estado pero no
 * encadena etapas — la esencia se trabaja en el orden que pida el proyecto.
 */
export const ETAPA_ORDER: EstrategiaKey[] = [
  'diagnostico', 'consumidor',
  'rtbs', 'concepto', 'beneficios', 'arquetipo', 'personalidad', 'valores',
  'territorio', 'brand_ideal', 'ingredients', 'tagline', 'manifiesto',
  'cuadros',
]

/** Las etapas del bloque 3 (esencia): las que `cuadros` resume y de las que avisa. */
export const ESENCIA: EstrategiaKey[] = ETAPA_ORDER.slice(2, 13)

export const ETAPA_LABEL: Record<EstrategiaKey, string> = {
  diagnostico: 'Diagnóstico',
  consumidor: 'Consumidor',
  rtbs: 'RTBs',
  concepto: 'Concepto estratégico',
  beneficios: 'Beneficios',
  arquetipo: 'Arquetipo',
  personalidad: 'Personalidad',
  valores: 'Valores',
  territorio: 'Territorio',
  brand_ideal: 'Brand Ideal',
  ingredients: 'Brand ingredients',
  tagline: 'Tagline / CCI',
  manifiesto: 'Manifiesto',
  cuadros: 'Cuadros finales',
}

export const ETAPA_HINT: Partial<Record<EstrategiaKey, string>> = {
  cuadros: 'se llena desde lo aprobado',
}

export interface EtapaEstrategia {
  key: EstrategiaKey
  label: string
  hint?: string
  status: StageStatus
}

/** Las 14 etapas siempre, aunque el proyecto todavía no tenga ninguna fila. */
export function buildEtapasEstrategia(estado: { stage: EstrategiaKey; status: StageStatus }[]): EtapaEstrategia[] {
  const porEtapa = new Map(estado.map(e => [e.stage, e.status]))
  return ETAPA_ORDER.map(key => ({
    key,
    label: ETAPA_LABEL[key],
    hint: ETAPA_HINT[key],
    status: porEtapa.get(key) ?? 'pendiente',
  }))
}
```

- [ ] **Step 4: Correr y ver el verde** — `npx vitest run src/lib/estrategia/stages.test.ts`
- [ ] **Step 5: Commit** — `git add src/lib/estrategia && git commit -m "feat(estrategia): modelo de las 14 etapas del proceso"`

---

### Task 2: Schema, migración y base de test

**Files:**
- Modify: `src/lib/db/schema.ts` (agregar al final, antes del bloque OAuth o después — mantener el orden por fases con un comentario de sección)
- Modify: `src/lib/db/testdb.ts` (dos CREATE TABLE más en el `exec`)
- Create: `drizzle/0003_*.sql` (generada, no manuscrita)

**Interfaces:**
- Produces: `strategyStages`, `strategyVersions` (tablas Drizzle espejo de las de landscape).

- [ ] **Step 1: Schema**

```ts
// src/lib/db/schema.ts — agregar
// Fase 3 · Estrategia. Ver valkyria/specs/2026-08-11-fase3-pipeline-estrategia-design.md
// Espejo del patrón del landscape: estado por etapa + versiones append-only.
/** Una fila por etapa de estrategia de un proyecto. El estado, y nada más. */
export const strategyStages = pgTable('strategy_stages', {
  projectId: uuid('project_id').notNull().references(() => projects.id),
  stage: text('stage').notNull(),                          // EstrategiaKey
  status: text('status').notNull().default('pendiente'),   // StageStatus
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.projectId, t.stage] })])

/** Append-only: nada se pisa, igual que `landscape_versions`. */
export const strategyVersions = pgTable('strategy_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  stage: text('stage').notNull(),                          // EstrategiaKey
  content: jsonb('content').notNull(),
  author: text('author').notNull(),                        // 'claude' | 'humano'
  authorLabel: text('author_label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
}, (t) => [index('strategy_versions_project_stage').on(t.projectId, t.stage)])
```

- [ ] **Step 2: Generar la migración** — Run: `npx drizzle-kit generate` — debe salir `drizzle/0003_*.sql` con solo dos `CREATE TABLE` y un `CREATE INDEX` (verificar con `cat` que sea puramente aditiva; si propone otra cosa, parar y revisar el schema).
- [ ] **Step 3: testdb.ts** — en el `client.exec`, después de `landscape_versions`, agregar el espejo:

```sql
CREATE TABLE strategy_stages (
  project_id uuid NOT NULL REFERENCES projects(id),
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, stage)
);
CREATE TABLE strategy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  stage text NOT NULL,
  content jsonb NOT NULL,
  author text NOT NULL,
  author_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
CREATE INDEX strategy_versions_project_stage ON strategy_versions (project_id, stage);
```

- [ ] **Step 4: Verificar que nada se rompió** — `npx vitest run src/lib/db/store.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/lib/db/schema.ts src/lib/db/testdb.ts drizzle/ && git commit -m "feat(estrategia): tablas strategy_stages y strategy_versions con migración aditiva"`

---

### Task 3: Store de estrategia

**Files:**
- Modify: `src/lib/db/store.ts` — exportar el helper interno `esViolacionDeForeignKey` (una palabra: `export`), sin tocar nada más.
- Create: `src/lib/db/strategy-store.ts`
- Test: `src/lib/db/strategy-store.test.ts`

**Interfaces:**
- Consumes: `AnyDb`, `ErrorNoEncontrado`, `esViolacionDeForeignKey` de `@/lib/db/store`; `strategyStages`, `strategyVersions` del schema; `EstrategiaKey`, `ETAPA_ORDER` de `@/lib/estrategia/stages`; `StageStatus` de `@/lib/landscape/stages`.
- Produces:
  - `type StrategyVersionRow = typeof strategyVersions.$inferSelect`
  - `setStrategyStageStatus(db, projectId, stage, status): Promise<void>`
  - `saveStrategyVersion(db, projectId, stage, { content, author, authorLabel? }): Promise<StrategyVersionRow>` — siempre borrador; primera versión mueve `pendiente → en_curso`, nunca degrada `aprobada`/`no_aplica`.
  - `listStrategyVersions(db, projectId, stage?): Promise<StrategyVersionRow[]>` — más nueva primero, desempate por id.
  - `approveStrategyVersion(db, versionId, scope: { projectId, stage }): Promise<StrategyVersionRow>` — UPDATE con los tres campos en el WHERE; `ErrorNoEncontrado` si no matchea.
  - `interface StrategyStageState { stage: EstrategiaKey; status: StageStatus; versiones: number; actual: StrategyVersionRow | null; aprobada: boolean; borradorNuevo: StrategyVersionRow | null }`
  - `strategyState(db, projectId): Promise<StrategyStageState[]>` — siempre las 14.
  - `summarizeStrategy(estado): { aprobadas: number; total: number }` — `no_aplica` fuera de numerador y denominador.

El código es el espejo 1:1 de las funciones homónimas de landscape en `src/lib/db/store.ts` (líneas de `setStageStatus` a `summarizeLandscape`): copiá cada función, renombrá tablas/tipos/claves a estrategia, conservá los comentarios que explican el desempate por id, el catch de FK y la regla del `borradorNuevo` (adaptando "seis etapas" → "catorce"). No hay equivalente de `selectTendencias` ni de la actividad (`listLandscapeActivity`) — la estrategia no tiene gate de selección.

- [ ] **Step 1: Tests que fallan**

```ts
// src/lib/db/strategy-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { makeTestDb, type TestDb } from './testdb'
import { createProject, ErrorNoEncontrado } from './store'
import {
  saveStrategyVersion, listStrategyVersions, approveStrategyVersion,
  strategyState, summarizeStrategy, setStrategyStageStatus,
} from './strategy-store'

let db: TestDb
let projectId: string

beforeEach(async () => {
  db = await makeTestDb()
  projectId = (await createProject(db, 'Marca Test')).id
})

describe('saveStrategyVersion', () => {
  it('guarda un borrador y mueve la etapa a en_curso', async () => {
    const v = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'x', racional: 'y' }, author: 'claude' })
    expect(v.approvedAt).toBeNull()
    const estado = await strategyState(db, projectId)
    expect(estado.find(e => e.stage === 'concepto')?.status).toBe('en_curso')
  })

  it('sobre una etapa aprobada no la degrada: queda como borradorNuevo', async () => {
    const v1 = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'a', racional: 'b' }, author: 'claude' })
    await approveStrategyVersion(db, v1.id, { projectId, stage: 'concepto' })
    await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'c', racional: 'd' }, author: 'claude' })
    const etapa = (await strategyState(db, projectId)).find(e => e.stage === 'concepto')!
    expect(etapa.status).toBe('aprobada')
    expect(etapa.aprobada).toBe(true)
    expect(etapa.borradorNuevo).not.toBeNull()
    expect(etapa.actual?.id).toBe(v1.id) // la aprobada manda
  })

  it('proyecto inexistente tira ErrorNoEncontrado', async () => {
    await expect(saveStrategyVersion(db, '00000000-0000-4000-8000-000000000000', 'concepto', { content: {}, author: 'claude' }))
      .rejects.toBeInstanceOf(ErrorNoEncontrado)
  })
})

describe('approveStrategyVersion', () => {
  it('con versionId de otra etapa no aprueba nada (scope en el WHERE)', async () => {
    const v = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'a', racional: 'b' }, author: 'claude' })
    await expect(approveStrategyVersion(db, v.id, { projectId, stage: 'arquetipo' }))
      .rejects.toBeInstanceOf(ErrorNoEncontrado)
  })
})

describe('strategyState / summarizeStrategy', () => {
  it('devuelve las 14 etapas aunque no haya filas', async () => {
    expect(await strategyState(db, projectId)).toHaveLength(14)
  })

  it('no_aplica no cuenta ni en aprobadas ni en total', async () => {
    await setStrategyStageStatus(db, projectId, 'manifiesto', 'no_aplica')
    const resumen = summarizeStrategy(await strategyState(db, projectId))
    expect(resumen.total).toBe(13)
    expect(resumen.aprobadas).toBe(0)
  })
})

describe('listStrategyVersions', () => {
  it('viene de la más nueva a la más vieja', async () => {
    await saveStrategyVersion(db, projectId, 'rtbs', { content: { items: ['1'] }, author: 'claude' })
    const v2 = await saveStrategyVersion(db, projectId, 'rtbs', { content: { items: ['2'] }, author: 'claude' })
    const lista = await listStrategyVersions(db, projectId, 'rtbs')
    expect(lista).toHaveLength(2)
    expect(lista[0].id).toBe(v2.id)
  })
})
```

Nota: si `createProject` no existe con esa firma en `store.ts`, usá la función real de creación de proyectos que usan los tests vecinos de `store.test.ts` (leerlo primero) y ajustá la llamada.

- [ ] **Step 2: Correr y ver el fallo** — `npx vitest run src/lib/db/strategy-store.test.ts`
- [ ] **Step 3: Implementar `strategy-store.ts`** (espejo descrito arriba) y exportar `esViolacionDeForeignKey` en `store.ts`.
- [ ] **Step 4: Verde** — `npx vitest run src/lib/db/strategy-store.test.ts src/lib/db/store.test.ts`
- [ ] **Step 5: Commit** — `git commit -m "feat(estrategia): store con versiones append-only y gate humano"`

---

### Task 4: Validación de contenido por etapa

**Files:**
- Create: `src/lib/mcp/validar-estrategia.ts`
- Test: `src/lib/mcp/validar-estrategia.test.ts`

**Interfaces:**
- Consumes: `ErrorDeHerramienta` de `./errores`; `EstrategiaKey` de `@/lib/estrategia/stages`.
- Produces: `validarContenidoEstrategia(etapa: EstrategiaKey, contenido: unknown): void` — tira `ErrorDeHerramienta` con mensaje accionable; no devuelve nada si está bien.

Formas mínimas (del spec, sección "Validación de contenido"): campos de texto no vacíos y listas con al menos un elemento. `cuadros` exige `brandEssence` y `consumidor` como objetos no vacíos de pares campo→texto (estructura libre).

- [ ] **Step 1: Tests que fallan**

```ts
// src/lib/mcp/validar-estrategia.test.ts
import { describe, it, expect } from 'vitest'
import { validarContenidoEstrategia } from './validar-estrategia'
import { ErrorDeHerramienta } from './errores'

const validos: Record<string, unknown> = {
  diagnostico: { problema: 'p', insight: 'i', ventaja: 'v', diferenciales: ['d1'] },
  consumidor: { metodologia: 'm', frases: ['f1'] },
  rtbs: { items: ['r1'] },
  concepto: { concepto: 'c', racional: 'r' },
  beneficios: { funcionales: ['f'], emocionales: ['e'] },
  arquetipo: { arquetipo: 'a', justificacion: 'j' },
  personalidad: { rasgos: ['r'] },
  valores: { items: [{ valor: 'v', validacion: 'ok' }] },
  territorio: { texto: 't' },
  brand_ideal: { texto: 't' },
  ingredients: { items: ['i'] },
  tagline: { texto: 't' },
  manifiesto: { texto: 't' },
  cuadros: { brandEssence: { proposito: 'p' }, consumidor: { jtbd: 'j' } },
}

const invalidos: Record<string, unknown> = {
  diagnostico: { problema: 'p', insight: 'i', ventaja: 'v', diferenciales: [] },
  consumidor: { metodologia: '', frases: ['f'] },
  rtbs: { items: [] },
  concepto: { concepto: 'c' },
  beneficios: { funcionales: ['f'], emocionales: [] },
  arquetipo: { arquetipo: '  ', justificacion: 'j' },
  personalidad: {},
  valores: { items: [{ valor: 'v' }] },
  territorio: { texto: '' },
  brand_ideal: {},
  ingredients: { items: [''] },
  tagline: { texto: '   ' },
  manifiesto: { otroCampo: 'x' },
  cuadros: { brandEssence: {}, consumidor: { jtbd: 'j' } },
}

describe('validarContenidoEstrategia', () => {
  it('rechaza lo que no es objeto', () => {
    expect(() => validarContenidoEstrategia('concepto', null)).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEstrategia('concepto', ['lista'])).toThrow(ErrorDeHerramienta)
  })

  for (const [etapa, contenido] of Object.entries(validos))
    it(`acepta un ${etapa} bien formado`, () => {
      expect(() => validarContenidoEstrategia(etapa as never, contenido)).not.toThrow()
    })

  for (const [etapa, contenido] of Object.entries(invalidos))
    it(`rechaza un ${etapa} mal formado con mensaje accionable`, () => {
      expect(() => validarContenidoEstrategia(etapa as never, contenido)).toThrow(ErrorDeHerramienta)
    })
})
```

- [ ] **Step 2: Correr y ver el fallo** — `npx vitest run src/lib/mcp/validar-estrategia.test.ts`
- [ ] **Step 3: Implementación**

```ts
// src/lib/mcp/validar-estrategia.ts
import type { EstrategiaKey } from '@/lib/estrategia/stages'
import { ErrorDeHerramienta } from './errores'

/**
 * Formas mínimas por etapa: campos requeridos no vacíos, listas con al menos un
 * elemento. A propósito liviana — Claude escribe borradores y el control de calidad
 * real es humano en el panel. Validar acá pone el error donde sale gratis: Claude
 * todavía tiene el turno y reintenta.
 */
export function validarContenidoEstrategia(etapa: EstrategiaKey, contenido: unknown): void {
  if (typeof contenido !== 'object' || contenido === null || Array.isArray(contenido))
    throw new ErrorDeHerramienta('El contenido tiene que ser un objeto JSON.')
  const c = contenido as Record<string, unknown>

  const texto = (campo: string) => {
    if (typeof c[campo] !== 'string' || !(c[campo] as string).trim())
      throw new ErrorDeHerramienta(`La etapa “${etapa}” necesita “${campo}” como texto no vacío.`)
  }
  const listaDeTextos = (campo: string) => {
    const v = c[campo]
    if (!Array.isArray(v) || v.length === 0 || v.some(x => typeof x !== 'string' || !x.trim()))
      throw new ErrorDeHerramienta(
        `La etapa “${etapa}” necesita “${campo}” como lista de textos no vacíos, con al menos uno.`,
      )
  }
  const objetoConTexto = (campo: string) => {
    const v = c[campo]
    if (typeof v !== 'object' || v === null || Array.isArray(v) || Object.keys(v).length === 0)
      throw new ErrorDeHerramienta(
        `La etapa “cuadros” necesita “${campo}” como objeto no vacío de pares campo→texto ` +
        '(el layout del cuadro es del archivo de Estrategia; acá va el contenido).',
      )
  }

  switch (etapa) {
    case 'diagnostico': texto('problema'); texto('insight'); texto('ventaja'); listaDeTextos('diferenciales'); break
    case 'consumidor': texto('metodologia'); listaDeTextos('frases'); break
    case 'rtbs': listaDeTextos('items'); break
    case 'concepto': texto('concepto'); texto('racional'); break
    case 'beneficios': listaDeTextos('funcionales'); listaDeTextos('emocionales'); break
    case 'arquetipo': texto('arquetipo'); texto('justificacion'); break
    case 'personalidad': listaDeTextos('rasgos'); break
    case 'valores': {
      const items = c.items
      if (!Array.isArray(items) || items.length === 0)
        throw new ErrorDeHerramienta('La etapa “valores” necesita “items”: una lista de { valor, validacion }.')
      items.forEach((item, i) => {
        if (typeof item !== 'object' || item === null)
          throw new ErrorDeHerramienta(`El valor ${i + 1} tiene que ser un objeto { valor, validacion }.`)
        const v = item as Record<string, unknown>
        for (const campo of ['valor', 'validacion'] as const)
          if (typeof v[campo] !== 'string' || !(v[campo] as string).trim())
            throw new ErrorDeHerramienta(`Al valor ${i + 1} le falta “${campo}” como texto no vacío.`)
      })
      break
    }
    case 'territorio': case 'brand_ideal': case 'tagline': case 'manifiesto': texto('texto'); break
    case 'ingredients': listaDeTextos('items'); break
    case 'cuadros': objetoConTexto('brandEssence'); objetoConTexto('consumidor'); break
  }
}
```

- [ ] **Step 4: Verde** — `npx vitest run src/lib/mcp/validar-estrategia.test.ts`
- [ ] **Step 5: Commit** — `git commit -m "feat(estrategia): validación de las formas mínimas por etapa"`

---

### Task 5: Herramientas MCP

**Files:**
- Modify: `src/lib/mcp/tools.ts`
- Test: `src/lib/mcp/tools.test.ts` (agregar describes; no tocar los existentes)

**Interfaces:**
- Consumes: todo lo de las tasks 1, 3 y 4.
- Produces:
  - `guardarEtapa(db, { proyecto, etapa, contenido, fase? })` — `fase?: 'landscape' | 'estrategia'`, default `'landscape'` (los llamadores existentes no cambian).
  - `estadoEstrategia(db, ref)` — espejo de `estadoLandscape` con `ETAPA_LABEL` y su propio `bloqueoDe` (sin la rama de tendencias).
  - `contextoProyecto` devuelve además `estrategia: [{ etapa, titulo, estado, contenidoAprobado }]` (solo contenido aprobado, igual que la sección `landscape`).

Comportamiento de `guardarEtapa` con `fase: 'estrategia'`:
1. Si `etapa` no está en `ETAPA_ORDER` → `ErrorDeHerramienta` listando las claves válidas de estrategia.
2. `validarContenidoEstrategia(etapa, contenido)` antes de resolver el proyecto.
3. `saveStrategyVersion(..., { content, author: 'claude' })`.
4. Mensaje espejo del de landscape (con `ETAPA_LABEL`), y **si `etapa === 'cuadros'`**: consultar `strategyState` y, si hay etapas de `ESENCIA` con estado distinto de `aprobada` y de `no_aplica`, anexar al mensaje: `Ojo: los cuadros se llenan desde contenido aprobado y estas etapas de esencia todavía no lo están: <labels>. Es un aviso, no un bloqueo.`

- [ ] **Step 1: Tests que fallan** (mismo patrón que los describes existentes de `tools.test.ts` — leelo primero para copiar el setup de db/proyecto que ya usa)

```ts
// agregar a src/lib/mcp/tools.test.ts
describe('guardarEtapa con fase estrategia', () => {
  it('clave inválida lista las etapas de estrategia', async () => {
    await expect(guardarEtapa(db, { proyecto: 'Marca Test', etapa: 'setup', contenido: {}, fase: 'estrategia' }))
      .rejects.toThrow(/diagnostico.*cuadros/s)
  })

  it('contenido inválido no deja rastro', async () => {
    await expect(guardarEtapa(db, { proyecto: 'Marca Test', etapa: 'concepto', contenido: { concepto: 'x' }, fase: 'estrategia' }))
      .rejects.toBeInstanceOf(ErrorDeHerramienta)
    const estado = await strategyState(db, projectId)
    expect(estado.find(e => e.stage === 'concepto')?.versiones).toBe(0)
  })

  it('camino feliz: borrador esperando aprobación', async () => {
    const r = await guardarEtapa(db, {
      proyecto: 'Marca Test', etapa: 'concepto',
      contenido: { concepto: 'c', racional: 'r' }, fase: 'estrategia',
    })
    expect(r.esperandoAprobacion).toBe(true)
    expect(r.etapa).toBe('concepto')
  })

  it('cuadros con esencia sin aprobar avisa sin bloquear', async () => {
    const r = await guardarEtapa(db, {
      proyecto: 'Marca Test', etapa: 'cuadros',
      contenido: { brandEssence: { proposito: 'p' }, consumidor: { jtbd: 'j' } }, fase: 'estrategia',
    })
    expect(r.mensaje).toMatch(/aviso, no un bloqueo/)
  })

  it('sin fase sigue siendo landscape puro (regresión)', async () => {
    await expect(guardarEtapa(db, { proyecto: 'Marca Test', etapa: 'concepto', contenido: {} }))
      .rejects.toThrow(/no es una etapa del landscape/)
  })
})

describe('estadoEstrategia', () => {
  it('con cero versiones el bloqueo dice que falta el borrador, no manda al panel', async () => {
    const r = await estadoEstrategia(db, 'Marca Test')
    expect(r.etapas).toHaveLength(14)
    expect(r.etapas[0].bloqueo).toMatch(/no hay ningún borrador/)
    expect(r.etapas[0].hayBorradorEsperandoAprobacion).toBe(false)
  })

  it('con un borrador guardado pide aprobación desde el panel', async () => {
    await guardarEtapa(db, {
      proyecto: 'Marca Test', etapa: 'concepto',
      contenido: { concepto: 'c', racional: 'r' }, fase: 'estrategia',
    })
    const etapa = (await estadoEstrategia(db, 'Marca Test')).etapas.find(e => e.etapa === 'concepto')!
    expect(etapa.hayBorradorEsperandoAprobacion).toBe(true)
    expect(etapa.bloqueo).toMatch(/apruebe/)
  })
})

describe('contextoProyecto con estrategia', () => {
  it('incluye solo el contenido aprobado', async () => {
    const r1 = await guardarEtapa(db, {
      proyecto: 'Marca Test', etapa: 'concepto',
      contenido: { concepto: 'c', racional: 'r' }, fase: 'estrategia',
    })
    let ctx = await contextoProyecto(db, 'Marca Test')
    expect(ctx.estrategia.find((e: { etapa: string }) => e.etapa === 'concepto')?.contenidoAprobado).toBeNull()

    await approveStrategyVersion(db, r1.versionId, { projectId, stage: 'concepto' })
    ctx = await contextoProyecto(db, 'Marca Test')
    expect(ctx.estrategia.find((e: { etapa: string }) => e.etapa === 'concepto')?.contenidoAprobado)
      .toEqual({ concepto: 'c', racional: 'r' })
  })
})
```

- [ ] **Step 2: Correr y ver el fallo** — `npx vitest run src/lib/mcp/tools.test.ts`
- [ ] **Step 3: Implementar** en `tools.ts`: la rama `fase === 'estrategia'` de `guardarEtapa` (espejo de la de landscape con los 4 puntos de arriba), `estadoEstrategia` (espejo de `estadoLandscape`, con `bloqueoDeEstrategia` sin la rama de tendencias) y la sección `estrategia` en `contextoProyecto` (espejo del `.map` de landscape con `strategyState` + `ETAPA_LABEL`).
- [ ] **Step 4: Verde** — `npx vitest run src/lib/mcp/tools.test.ts`
- [ ] **Step 5: Commit** — `git commit -m "feat(estrategia): guardar_etapa con fase, estado_estrategia y contexto ampliado"`

---

### Task 6: Registro MCP en la ruta

**Files:**
- Modify: `src/app/api/mcp/route.ts`

**Interfaces:**
- Consumes: `estadoEstrategia` (Task 5), `ETAPA_ORDER` de `@/lib/estrategia/stages`.
- Produces: herramienta `estado_estrategia` registrada; `guardar_etapa` acepta `fase`.

- [ ] **Step 1: Cambios**

En `guardar_etapa`: el `inputSchema` pasa a

```ts
inputSchema: z.object({
  proyecto: z.string().describe('Nombre de la marca o id del proyecto'),
  fase: z.enum(['landscape', 'estrategia']).default('landscape')
    .describe('A qué proceso pertenece la etapa'),
  etapa: z.string().describe('Clave de la etapa dentro de la fase'),
  contenido: z.record(z.string(), z.unknown()).describe('El resultado de la etapa, como objeto JSON'),
}),
```

(la validación de la clave contra la fase ya vive en `guardarEtapa` y devuelve la lista válida — el `z.enum(STAGE_ORDER)` anterior se reemplaza porque el set depende de la fase). El handler pasa `fase` a `guardarEtapa`. La `description` se amplía: después de la parte de tendencias, agregar: `Para las etapas de estrategia mandá fase: "estrategia"; las claves son las 14 del Proceso de Estrategia (diagnostico, consumidor, rtbs, concepto, beneficios, arquetipo, personalidad, valores, territorio, brand_ideal, ingredients, tagline, manifiesto, cuadros). Los cuadros se llenan desde contenido aprobado.`

Registrar la herramienta nueva (espejo de `estado_landscape`):

```ts
server.registerTool('estado_estrategia', {
  title: 'Estado de la estrategia',
  description:
    'Qué etapa del Proceso de Estrategia está en curso, cuál está aprobada, si hay un borrador ' +
    'esperando aprobación y qué bloquea el avance. Llamá a esto cuando pregunten en qué va la ' +
    'estrategia o qué falta.',
  inputSchema: z.object({
    proyecto: z.string().describe('Nombre de la marca o id del proyecto'),
  }),
}, async ({ proyecto }) => responder(() => estadoEstrategia(db, proyecto)))
```

Actualizar también la `description` de `contexto_proyecto`: donde dice "y el estado del landscape…", queda "…, el estado del landscape y el de la estrategia, con el contenido de las etapas aprobadas de ambos".

- [ ] **Step 2: Verificar tipos y que los tests de tools sigan verdes** — `npx tsc --noEmit && npx vitest run src/lib/mcp/`
- [ ] **Step 3: Commit** — `git commit -m "feat(estrategia): registrar estado_estrategia y la fase en guardar_etapa"`

---

### Task 7: Ruta del panel para guardar y aprobar (con los tests HTTP que faltaban)

**Files:**
- Create: `src/app/api/projects/[id]/estrategia/[stage]/route.ts`
- Test: `src/app/api/projects/[id]/estrategia/estrategia-route.test.ts`
- Test: `src/app/api/projects/[id]/landscape/landscape-route.test.ts` (salda la deuda de fase 2)

**Interfaces:**
- Consumes: `saveStrategyVersion`, `approveStrategyVersion` (Task 3), `ETAPA_ORDER`/`EstrategiaKey` (Task 1), `esUuidValido` de `@/lib/landscape/ids`, `ErrorDeValidacion`/`ErrorNoEncontrado` de `@/lib/db/store`.
- Produces: `POST /api/projects/[id]/estrategia/[stage]` con acciones `guardar` (autor humano) y `aprobar`. Sin `seleccionar-tendencias`.

La ruta es el espejo de `src/app/api/projects/[id]/landscape/[stage]/route.ts` sin el case de tendencias: copiá el archivo, cambiá imports y tipos a estrategia, conservá los comentarios de los chequeos de body y del mapeo de errores (404/400/500).

- [ ] **Step 1: Tests que fallan** (mismo patrón de mock de db que `src/app/api/oauth/oauth-routes.test.ts`: `vi.mock('@/lib/db/client')` con `makeTestDb`)

```ts
// src/app/api/projects/[id]/estrategia/estrategia-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

import { POST } from './[stage]/route'
import { db } from '@/lib/db/client'
import { createProject } from '@/lib/db/store'
import { saveStrategyVersion } from '@/lib/db/strategy-store'

let projectId: string
beforeEach(async () => { projectId = (await createProject(db, `Marca ${Math.random()}`)).id })

function post(id: string, stage: string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/projects/${id}/estrategia/${stage}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id, stage }) },
  )
}

describe('POST /api/projects/[id]/estrategia/[stage]', () => {
  it('guardar crea un borrador humano', async () => {
    const res = await post(projectId, 'concepto', { accion: 'guardar', content: { concepto: 'c', racional: 'r' } })
    expect(res.status).toBe(200)
    expect((await res.json()).approvedAt).toBeNull()
  })

  it('aprobar sella la versión', async () => {
    const v = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'c', racional: 'r' }, author: 'claude' })
    const res = await post(projectId, 'concepto', { accion: 'aprobar', versionId: v.id })
    expect(res.status).toBe(200)
    expect((await res.json()).approvedAt).not.toBeNull()
  })

  it('aprobar con versionId inexistente devuelve 404', async () => {
    const res = await post(projectId, 'concepto', { accion: 'aprobar', versionId: '00000000-0000-4000-8000-000000000000' })
    expect(res.status).toBe(404)
  })

  it('etapa desconocida devuelve 400', async () => {
    const res = await post(projectId, 'tendencias', { accion: 'guardar', content: {} })
    expect(res.status).toBe(400)
  })
})
```

```ts
// src/app/api/projects/[id]/landscape/landscape-route.test.ts — la deuda de fase 2
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', async () => {
  const { makeTestDb } = await import('@/lib/db/testdb')
  const db = await makeTestDb()
  return { db }
})

import { POST } from './[stage]/route'
import { db } from '@/lib/db/client'
import { createProject } from '@/lib/db/store'

let projectId: string
beforeEach(async () => { projectId = (await createProject(db, `Marca ${Math.random()}`)).id })

describe('POST /api/projects/[id]/landscape/[stage] — aprobar', () => {
  it('con versionId inexistente devuelve 404, no 500', async () => {
    const res = await POST(
      new Request(`http://localhost/api/projects/${projectId}/landscape/contexto`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion: 'aprobar', versionId: '00000000-0000-4000-8000-000000000000' }),
      }),
      { params: Promise.resolve({ id: projectId, stage: 'contexto' }) },
    )
    expect(res.status).toBe(404)
  })
})
```

(Misma nota que en Task 3 sobre la firma real de `createProject`; y si `Math.random()` molesta al canario de estilo, usá un contador.)

- [ ] **Step 2: Correr y ver el fallo** — `npx vitest run src/app/api/projects`
- [ ] **Step 3: Implementar la ruta** (espejo descrito arriba).
- [ ] **Step 4: Verde** — `npx vitest run src/app/api/projects`
- [ ] **Step 5: Commit** — `git commit -m "feat(estrategia): ruta del panel para guardar y aprobar, con tests HTTP (salda deuda fase 2)"`

---

### Task 8: Panel — pantalla de estrategia y navegación

**Files:**
- Create: `src/app/admin/projects/[id]/estrategia/page.tsx`
- Create: `src/app/admin/projects/[id]/estrategia/EstrategiaWorkspace.tsx`
- Test: `src/app/admin/projects/[id]/estrategia/EstrategiaWorkspace.test.tsx`
- Modify: la navegación del proyecto — buscá dónde se declara la pestaña/entrada "Landscape" (`grep -rn "landscape" src/components/AdminShell.tsx src/components/ProjectHeader.tsx`) y agregá "Estrategia" al lado, apuntando a `/admin/projects/[id]/estrategia`.

**Interfaces:**
- Consumes: `strategyState`, `summarizeStrategy` (Task 3), `buildEtapasEstrategia`, `ETAPA_LABEL`, `ETAPA_HINT` (Task 1), la ruta de Task 7, y los componentes existentes del landscape.
- Produces: pantalla `/admin/projects/[id]/estrategia` con la lista de las 14 etapas, visor de versiones, botón de aprobar que sella la versión visible, y el aviso de borrador nuevo sobre etapa aprobada.

Antes de escribir nada: leé enteros `src/app/admin/projects/[id]/landscape/page.tsx`, `LandscapeWorkspace.tsx` y `ContenidoEtapa.tsx`. El trabajo es un espejo con tres restas y una regla:

1. **Resta el gate de tendencias** (toda la lógica de `TendenciasContent`, selección y long list).
2. **Resta la actividad** (`listLandscapeActivity` no tiene equivalente en estrategia).
3. **Resta `derivePhases`/`projectSignals` si piden señales que estrategia no tiene** — la cabecera usa lo mismo que usa la página de landscape hoy; no agregues señales nuevas al pipeline de fases en esta tarea.
4. **Regla de reuso:** si `ContenidoEtapa.tsx` no importa nada específico de landscape (revisá sus imports), importalo directamente desde `../landscape/ContenidoEtapa`; si está acoplado, copialo a `estrategia/` con nombre propio. No lo generalices con props nuevas.

El fetch de guardar/aprobar del workspace apunta a `/api/projects/${id}/estrategia/${stage}` con los mismos bodies (`{ accion: 'guardar', content, autor }` / `{ accion: 'aprobar', versionId }`).

- [ ] **Step 1: Test que falla** — espejo de los casos de `LandscapeWorkspace.test.tsx` que apliquen (leelo primero; renderiza el workspace con estado armado a mano). Cubrir como mínimo: (a) renderiza las 14 etapas con sus labels; (b) una etapa aprobada con `borradorNuevo` muestra el aviso con “Ver la nueva / Ver la aprobada”; (c) el botón de aprobar manda `versionId` de la versión visible al endpoint de estrategia (mock de `fetch`, assert de URL y body).
- [ ] **Step 2: Correr y ver el fallo** — `npx vitest run src/app/admin/projects/[id]/estrategia`
- [ ] **Step 3: Implementar** `page.tsx` (server component espejo del de landscape: `strategyState` + `summarizeStrategy` + `buildEtapasEstrategia`, cabecera con `AdminShell`/`ProjectHeader` igual que la página de landscape) y `EstrategiaWorkspace.tsx` (client component espejo).
- [ ] **Step 4: Verde + navegación** — `npx vitest run src/app/admin/projects` y verificar a mano con `npm run dev` que `/admin/projects/<id>/estrategia` carga y la pestaña aparece (usar `npm run db:projects` para un id real).
- [ ] **Step 5: Commit** — `git commit -m "feat(estrategia): pantalla del panel con visor de versiones y aprobación"`

---

### Task 9: Instrucciones del proyecto de claude.ai

**Files:**
- Modify: `docs/fase2/instrucciones-claude-ai.md`

Las instrucciones son un solo documento (decisión del spec). Agregar, después de la sección del landscape, una sección "Proceso de Estrategia" que diga, con la voz del documento existente (leerlo primero):

- El mapa bloques del PDF → etapas: bloque 1 → `diagnostico`; bloque 2 → `consumidor`; bloque 3 → las 11 etapas de esencia (orden libre, el que pida el proyecto); bloque 4 → solo `cuadros`.
- Arrancar siempre por `contexto_proyecto` (trae entrevistas, propuesta de valor, landscape aprobado y estrategia aprobada) y `estado_estrategia` para saber qué falta.
- Guardar cada etapa al terminarla con `guardar_etapa` y `fase: "estrategia"`; todo entra como borrador y el equipo aprueba en el panel.
- `cuadros` se redacta desde contenido aprobado; si falta esencia por aprobar, la herramienta avisa.
- El camino "si el núcleo no queda claro" (bloque 1) se trabaja en el chat con los documentos que el equipo cargue — la plataforma no interviene ahí.

- [ ] **Step 1: Escribir la sección.**
- [ ] **Step 2: Commit** — `git commit -m "docs(estrategia): instrucciones de claude.ai para el proceso de estrategia"`

---

### Task 10: Verificación final

- [ ] **Step 1: Suite completa** — `npm test` — Expected: verde (si falla solo el flake conocido de pglite, re-correr una vez).
- [ ] **Step 2: Tipos y build** — `npx tsc --noEmit && npm run build` — Expected: sin errores; el build lista la ruta `/admin/projects/[id]/estrategia` y `/api/projects/[id]/estrategia/[stage]`.
- [ ] **Step 3: Lint** — `npm run lint` — Expected: sin errores nuevos.
- [ ] **Step 4: Commit final si quedó algo suelto y push** — el push a `main` dispara el deploy con la migración `0003` corriendo en el build.
