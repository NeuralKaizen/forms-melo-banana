# Navegación por grupos y carril desplegable · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cabecera del proyecto por grupos de fases (sin Entrega, con Estrategia adentro) y carril de estrategia agrupado desplegable con siguiente/anterior.

**Architecture:** se rehace `src/lib/pipeline/phases.ts` al modelo de grupos (tres grupos; las pantallas de la fase 1 como tabs del grupo activo), `ProjectHeader` se reescribe sobre ese modelo y lo adoptan todas las pantallas; el workspace de estrategia pasa a dos columnas con carril agrupado desplegable. Spec: `valkyria/specs/2026-08-11-estrategia-ux-navegacion-design.md`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Vitest + Testing Library.

## Global Constraints

- Código, comentarios y mensajes en castellano con la voz de los archivos vecinos; comillas tipográficas “ ” en texto de usuario donde los vecinos las usen.
- **Copy visible en español neutro** (tuteo: "elige", "mira") — nunca voseo.
- **Cero movimiento nuevo**: sin animaciones de despliegue, slides ni auto-scroll; a lo sumo `transition-colors duration-200` como los vecinos.
- Lenguaje visual existente: fondo activo `#fffdf0`, acento `var(--banana)`, tinta `var(--ink)`, muteds `#6b6155`/`#a59c89`, tarjetas `rounded-2xl border border-black/5 bg-white shadow-sm`.
- El workspace del landscape no se toca (solo hereda la cabecera).
- TDD por tarea; `npx vitest run <archivo>` por tarea y suite completa al final (flake conocido de pglite bajo carga: re-correr una vez).
- Commits por tarea `feat(ux): …` / `refactor(ux): …` .

---

### Task 1: Modelo de grupos en el pipeline

**Files:**
- Modify: `src/lib/pipeline/phases.ts` (reescritura del modelo público)
- Modify: `src/lib/pipeline/signals.ts` (señal nueva de estrategia)
- Test: `src/lib/pipeline/grupos.test.ts` (nuevo)

**Interfaces:**
- Consumes: `ProjectSignals` existente; `ETAPA_ORDER` no hace falta (los conteos llegan por señal).
- Produces (contrato para Tasks 2 y 3):

```ts
export type PantallaKey = 'entrevistas' | 'propuesta' | 'taller' | 'landscape' | 'estrategia'
export type GrupoKey = 'propuesta-valor' | 'landscape' | 'estrategia'
export type PhaseStatus = 'pendiente' | 'en_curso' | 'espera' | 'completa'  // se conserva

export interface Tab { key: PantallaKey; label: string; href: string }
export interface Grupo {
  key: GrupoKey
  label: string            // 'Entrevistas / Propuesta de valor' | 'Landscape' | 'Estrategia'
  status: PhaseStatus
  detalle: string          // una línea: '2 de 6 aprobadas', 'Taller hecho', …
  href: string             // a dónde va el clic en el grupo
  tabs?: Tab[]             // solo el grupo 'propuesta-valor' las tiene
  dependencia?: string     // la nota ámbar contextual (hoy solo landscape la trae)
}

export function deriveGrupos(projectId: string, s: ProjectSignals): Grupo[]
export function grupoDePantalla(p: PantallaKey): GrupoKey
```

Reglas de derivación (reusar la lógica interna existente, que ya está bien):
- `propuesta-valor`: `href` a `/entrevistas`; `tabs` = Entrevistas/Propuesta/Taller con sus hrefs.
  Estado: `completa` si el taller está completo (`tienePostTaller`); `espera` si el taller está en
  espera; `en_curso` si hay sesiones o entregable; `pendiente` si no hay nada. `detalle` = el
  detalle de la sub-fase que está frenando (el de taller si hay entregable, el de propuesta si hay
  sesiones, el de entrevistas si no).
- `landscape`: estado y detalle idénticos a la fase actual, incluida la `dependencia` de los
  competidores del taller.
- `estrategia`: mismo patrón con `s.estrategiaEtapasAprobadas`/`s.estrategiaEtapasTotal` (señales
  nuevas): `completa` todas aprobadas, `en_curso` si hay alguna, `pendiente` si ninguna;
  detalle `'n de m aprobadas'` / `'Sin empezar'`.
- Se eliminan del módulo: la fase `entrega`, `neighbours`, `PhaseKey` y `PHASE_LABEL` (o quedan
  como alias internos si algún archivo aún los importa — la Task 2 elimina esos usos; al final de
  la Task 2 no debe quedar ningún import de los símbolos viejos).
- `currentPhase` se reemplaza por `grupoActual(grupos): Grupo` (primera no completa, o la última).
- `signals.ts`: `projectSignals` gana el input opcional `estrategia?: { aprobadas: number; total: number }`
  y produce `estrategiaEtapasAprobadas`/`estrategiaEtapasTotal` (default 0 / 14 — importá el 14 de
  `ETAPA_ORDER.length` de `@/lib/estrategia/stages`, no un literal).

- [ ] **Step 1: Test que falla** — `src/lib/pipeline/grupos.test.ts` con estos casos (armá las señales a mano, sin base):

```ts
import { describe, expect, it } from 'vitest'
import { deriveGrupos, grupoDePantalla, grupoActual } from './phases'
import { projectSignals } from './signals'

const base = { sessions: [{ status: 'completed' }], tieneEntregable: true, landscape: { aprobadas: 4, total: 6 } }

describe('deriveGrupos', () => {
  it('devuelve los tres grupos en orden, sin entrega', () => {
    const g = deriveGrupos('p1', projectSignals(base))
    expect(g.map(x => x.key)).toEqual(['propuesta-valor', 'landscape', 'estrategia'])
  })

  it('el grupo 1 lleva las tres tabs con sus hrefs', () => {
    const g = deriveGrupos('p1', projectSignals(base))
    expect(g[0].tabs?.map(t => t.key)).toEqual(['entrevistas', 'propuesta', 'taller'])
    expect(g[0].tabs?.[0].href).toBe('/admin/projects/p1/entrevistas')
    expect(g[1].tabs).toBeUndefined()
  })

  it('estrategia muestra su avance cuando hay señal', () => {
    const g = deriveGrupos('p1', projectSignals({ ...base, estrategia: { aprobadas: 2, total: 14 } }))
    expect(g[2].status).toBe('en_curso')
    expect(g[2].detalle).toBe('2 de 14 aprobadas')
  })

  it('sin señal de estrategia queda pendiente y sin empezar', () => {
    const g = deriveGrupos('p1', projectSignals(base))
    expect(g[2].status).toBe('pendiente')
    expect(g[2].detalle).toBe('Sin empezar')
  })

  it('landscape conserva su dependencia del taller', () => {
    const g = deriveGrupos('p1', projectSignals({ ...base }))
    expect(g[1].dependencia).toMatch(/competidores del taller/)
  })

  it('grupoDePantalla mapea las cinco pantallas', () => {
    expect(grupoDePantalla('entrevistas')).toBe('propuesta-valor')
    expect(grupoDePantalla('taller')).toBe('propuesta-valor')
    expect(grupoDePantalla('landscape')).toBe('landscape')
    expect(grupoDePantalla('estrategia')).toBe('estrategia')
  })

  it('grupoActual es el primero no completo', () => {
    const g = deriveGrupos('p1', projectSignals(base))
    expect(grupoActual(g).key).toBe('propuesta-valor') // taller sin post-taller → espera
  })
})
```

- [ ] **Step 2: Correr y ver el fallo** — `npx vitest run src/lib/pipeline/grupos.test.ts`
- [ ] **Step 3: Implementar** la reescritura descrita en Interfaces (conservando los comentarios del archivo que expliquen derivaciones que sobreviven, p.ej. el del taller en Miro y el de la dependencia).
- [ ] **Step 4: Verde + tipos** — `npx vitest run src/lib/pipeline/ && npx tsc --noEmit 2>&1 | head -30` — los errores de tsc que queden deben ser SOLO de los consumidores viejos (`ProjectHeader`, páginas, `AdminShell`), que arregla la Task 2; listalos en el reporte.
- [ ] **Step 5: Commit** — `git commit -m "feat(ux): modelo de grupos del recorrido, sin entrega"`

---

### Task 2: Cabecera nueva y adopción en todas las pantallas

**Files:**
- Rewrite: `src/components/ProjectHeader.tsx`
- Test: `src/components/ProjectHeader.test.tsx` (nuevo)
- Modify: `src/app/admin/projects/[id]/{page,entrevistas/page,propuesta/page,taller/page,landscape/page,estrategia/page}.tsx`, `src/components/AdminShell.tsx`, `src/app/admin/page.tsx` (grep `derivePhases|ProjectHeader|currentPhase|neighbours|PhaseKey` para no dejar usos viejos)
- Delete: `src/app/admin/projects/[id]/entrega/` completo

**Interfaces:**
- Consumes: `deriveGrupos`, `grupoDePantalla`, `grupoActual`, tipos `Grupo`/`PantallaKey` (Task 1).
- Produces: `ProjectHeader({ name, grupos, active }: { name: string; grupos: Grupo[]; active: PantallaKey })` — deriva el grupo activo con `grupoDePantalla(active)`; muestra la `dependencia` del grupo activo si existe.

Estructura del componente (esqueleto obligatorio; los estilos afinan sobre esto con el lenguaje visual de Global Constraints):

```tsx
<header className="space-y-5">
  {/* breadcrumb '← Proyectos' + <h1 serif> igual que hoy */}
  <nav aria-label="Recorrido del proyecto">
    <ol className="grid gap-2 sm:grid-cols-3">
      {grupos.map(g => (
        <li key={g.key}>
          <Link href={g.href} aria-current={esActivo(g) ? 'step' : undefined}
                className={/* tarjeta: rounded-2xl border bg-white p-3; activa: border-[var(--banana)] bg-[#fffdf0] */}>
            {/* fila 1: <Dot status={g.status}/> (reusar el Dot actual tal cual) + label 13px */}
            {/* fila 2: detalle 11.5px #a59c89 */}
          </Link>
          {esActivo(g) && g.tabs && (
            <div role="tablist" className="mt-1.5 flex gap-1 px-1">
              {g.tabs.map(t => (
                <Link key={t.key} href={t.href}
                      className={/* tab fina 12.5px py-1 px-2.5 rounded-lg; activa (t.key === active): font-semibold text-ink bg-[#fffdf0] shadow-[inset_0_-2px_0_0_var(--banana)]; resto text-[#6b6155] hover:bg-[#faf7ee] */}>
                  {t.label}
                </Link>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  </nav>
  {/* la nota ámbar de dependencia del grupo activo, mismo markup que hoy */}
</header>
```

Adopción por página (patrón, igual en todas): calcular `const estrategia = summarizeStrategy(await strategyState(db, id))` donde no esté ya, pasarlo a `projectSignals({ ..., estrategia })`, `const grupos = deriveGrupos(id, señales)`, `<ProjectHeader name={...} grupos={grupos} active="<pantalla>" />`. La página de estrategia deja de armar el link aparte. En `AdminShell`/`admin/page.tsx`, reemplazar cualquier uso de `currentPhase`/fases por `grupoActual`/grupos (leer cómo lo usan y conservar su semántica visible). Borrar `entrega/` y todo import muerto.

- [ ] **Step 1: Test que falla** — `ProjectHeader.test.tsx` (Testing Library, como los tests de componentes vecinos — mirá `src/app/admin/login/page.test.tsx` para el setup):
  casos: (a) renderiza los tres grupos con label y detalle; (b) `active="estrategia"` marca el grupo estrategia con `aria-current`; (c) las tabs solo aparecen con `active` dentro del grupo 1 (con `active="taller"` hay `role="tablist"`; con `active="landscape"` no); (d) la dependencia del grupo activo se muestra y la de un grupo inactivo no.
- [ ] **Step 2: Correr y ver el fallo.**
- [ ] **Step 3: Implementar** el componente y la adopción en TODAS las pantallas listadas; borrar `entrega/`.
- [ ] **Step 4: Verde total** — `npx vitest run src/components src/app/admin && npx tsc --noEmit && npm run build` (el build ya no lista `/admin/projects/[id]/entrega`). `grep -rn "entrega\b" src/ --include="*.tsx" --include="*.ts" | grep -v estrategia` no devuelve usos de la fase.
- [ ] **Step 5: Commit** — `git commit -m "feat(ux): cabecera por grupos con tabs de fase 1, sin entrega"`

---

### Task 3: Carril desplegable y siguiente/anterior en el workspace de estrategia

**Files:**
- Modify: `src/app/admin/projects/[id]/estrategia/EstrategiaWorkspace.tsx`
- Modify: `src/app/admin/projects/[id]/estrategia/estrategia-workspace.test.tsx` (agregar casos; ajustar los que asuman el layout viejo)
- Modify: `src/lib/estrategia/stages.ts` (solo agregar el modelo de grupos del carril)

**Interfaces:**
- Consumes: `ETAPA_ORDER`, `ESENCIA`, `ETAPA_LABEL`, `EtapaEstrategia` (existentes).
- Produces en `stages.ts`:

```ts
export interface GrupoEtapas { titulo: string; etapas: EstrategiaKey[] }
export const GRUPOS_ETAPAS: GrupoEtapas[] = [
  { titulo: 'Diagnóstico y consumidor', etapas: ['diagnostico', 'consumidor'] },
  { titulo: 'Esencia de marca', etapas: ESENCIA },
  { titulo: 'Cierre', etapas: ['cuadros'] },
]
```

Cambios en el workspace (el resto del archivo — aprobar, aviso de borrador, estados — no se toca):

1. **Grilla**: `lg:grid-cols-[176px_minmax(0,1fr)_248px]` → `lg:grid-cols-[240px_minmax(0,1fr)]`; el `<aside>` derecho se elimina y su texto pasa al pie del carril como línea discreta (punto verde + `"Conectado a Claude — este proyecto es contexto del equipo en sus conversaciones."`, 11px, sin tarjeta).
2. **Carril agrupado desplegable**: estado `abiertos: Set<string>` (títulos de grupo) inicializado con el grupo de la etapa activa. Cabecera de grupo = `<button>` con título (11px uppercase tracking como el label "Etapas" actual) + contador `n de m` (aprobadas del grupo, sin contar `no_aplica`, estilo `summarizeStrategy`) + chevron ▸/▾ (el svg de chevron que ya usa el proyecto, rotado — sin transición de rotación). Clic alterna SIN animación. Filas de etapa: las actuales (`EtapaRow`) con texto subido a 14px / sub 11.5px.
3. **`irAEtapa`** además expande el grupo destino y pliega los demás (`setAbiertos(new Set([grupoDe(key)]))`).
4. **Breadcrumb de posición** sobre el título: `"{titulo del grupo} · etapa {i+1} de 14"` (índice en `ETAPA_ORDER`).
5. **Pie siguiente/anterior** bajo el contenido (después de la barra de aprobar): fila `justify-between`; a la izquierda `‹ {label anterior}`, a la derecha `{label siguiente} ›` como botones de texto (13px, `text-[#6b6155] hover:text-ink`, el siguiente `font-medium text-ink`); en los extremos el lado inexistente no se renderiza. Ambos llaman `irAEtapa`.
6. El contador global "n de 14 aprobadas" se muda del label "Etapas" a una línea bajo el título del carril (mismo estilo actual, no se pierde).

- [ ] **Step 1: Tests que fallan** — agregar a `estrategia-workspace.test.tsx`:
  (a) renderiza los tres grupos con sus contadores y solo el grupo de la etapa activa arranca expandido (las filas de los otros no están en el DOM);
  (b) clic en la cabecera de un grupo plegado muestra sus filas;
  (c) el pie muestra anterior/siguiente correctos para una etapa del medio, y navega: clic en "siguiente" cambia el contenido a la etapa siguiente y expande su grupo;
  (d) en `diagnostico` (primera) no hay "anterior"; en `cuadros` (última) no hay "siguiente";
  (e) los casos existentes (14 etapas listadas al expandir todo, aviso de borrador, aprobar con fetch) se ajustan al nuevo DOM sin cambiar su intención.
- [ ] **Step 2: Correr y ver el fallo.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verde** — `npx vitest run src/app/admin/projects src/lib/estrategia && npx tsc --noEmit`
- [ ] **Step 5: Commit** — `git commit -m "feat(ux): carril de estrategia agrupado desplegable con siguiente y anterior"`

---

### Task 4: Verificación final

- [ ] **Step 1:** `npm test` (flake de pglite: una re-corrida) — verde.
- [ ] **Step 2:** `npx tsc --noEmit && npm run build && npm run lint` — sin errores nuevos (los `no-explicit-any` preexistentes en archivos no tocados no cuentan); el build no lista `/entrega` y sí `/estrategia`.
- [ ] **Step 3:** Commit final si quedó algo suelto.
