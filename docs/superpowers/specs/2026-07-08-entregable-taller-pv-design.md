# Diseño — Generación del entregable del Taller de Propuesta de Valor

> Fecha: 2026-07-08
> Estado: aprobado para plan
> Feature: la app genera, desde las entrevistas, el insumo del **Taller de Propuesta de Valor** (el entregable de 3 partes) como primera versión que el equipo de estrategia refina.

## 1. Contexto y objetivo

Melo & Banana corre un pipeline manual (`docs/Fase1_Flujo_de_trabajo.md`): recibe entrevistas → extrae insights con Claude → arma un tablero en Miro → taller en vivo → deck → entrega. Hoy el equipo de estrategia hace la extracción a mano corriendo el skill `docs/analisis-entrevista-proyectiva/SKILL.md`, que produce el **insumo del Taller de Propuesta de Valor**. El entregable final real es un deck de 15 slides con identidad M&B (referencia: `docs/mbanana_info-taller-pv_2026-07-06_2159/.../TALLER PROPUESTA DE VALOR_*.pdf`).

Esta app ya reemplaza la recepción (entrevista conversacional en vez del Google Form) y captura respuestas estructuradas por marca. Falta **cerrar la etapa de extracción**: que la app reproduzca lo que hoy hace el skill a mano y genere el entregable de 3 partes.

**Objetivo de este spec:** el motor de generación del entregable + su presentación en el panel admin. Fuera de alcance (ver §8): deck/PPT automático, dibujo visual del mapa, audios y deploy.

### Regla de oro (del skill)

El análisis se construye sobre lo que el cliente dijo, no sobre lo que imaginamos. Lo que la entrevista no cubre **no se inventa**: se marca como *pendiente del taller*. Lo que aporta el equipo (referentes, ejes, posición ideal) se marca como *propuesta del equipo*, nunca como dato del cliente.

## 2. El entregable: qué se genera y qué es plantilla fija

El deck tiene 15 slides. **Solo 5 son contenido generado por IA**; el resto es plantilla fija (portada, índice, 3 divisores, 3 slides educativos de Strategyzer, cierre) y no entra en este motor.

Slides generados y su mapeo a los pasos del motor:

| Slide del deck | Paso del motor | Contenido |
|---|---|---|
| Declaración del problema | `problema` | ¿Qué problema resolvemos para el consumidor? · Para la marca · ¿Cómo pensamos hacerlo? · ¿Por qué es relevante? + párrafo "Problema" (contexto mundo/consumidor) |
| Panorama de la categoría | `competencia` | Lista de marcas competidoras · 2 ejes de comparación · posición actual vs ideal |
| Perfil de usuario | `perfil` | Gains · Jobs to be done · Pains (círculo Strategyzer) |
| Propuesta de valor (tabla + síntesis) | `propuestaValor` | Fórmula (Nombre + Verbo + Razón de ser) · beneficio central · tabla JTBD → pain reliever/gain creator → cómo se resuelve |

La **lectura proyectiva de personalidad** (paso `personalidad`) no tiene slide propio: alimenta el "¿Cómo pensamos hacerlo?" y el "qué NO quiere ser" de la Parte 1, tal como el skill indica.

## 3. Nivel de agregación: por proyecto (empresa), no por sesión

Un proyecto real tiene **varios respondientes** del cliente (Cacao Hunters ~9, Going 6). El corazón del skill es **triangular**: lo que casi todos repiten es hecho; donde se contradicen es una **tensión a nombrar** (no promediar) — muchas veces esa tensión ES el hallazgo.

Por eso el entregable es **por proyecto**, agregando N sesiones. El motor recibe una **lista de sesiones** (respondientes) y hoy N puede ser 1..9. Con N=1 simplemente no hay tensiones que cruzar; el mismo motor funciona.

### Agrupación híbrida

- **Automática:** al completarse una entrevista, se asigna a un proyecto cuyo nombre normalizado (lowercase + trim + colapso de espacios) coincida con el campo `company`; si no existe, se crea.
- **Corrección manual:** en el panel, el empleado puede reasignar una sesión a otro proyecto o mover sesiones entre proyectos (resuelve "Going" vs "going sas").

## 4. Arquitectura del motor

Módulo nuevo `src/lib/deliverable/`. Cinco pasos segmentados (una llamada Claude enfocada por paso) para maximizar calidad. Cada paso es un módulo con: constructor de prompt + esquema de salida + parser.

```
src/lib/deliverable/
  steps/
    personalidad.ts   # paso 0 — no produce slide, alimenta problema
    problema.ts       # paso 1
    competencia.ts    # paso 2
    perfil.ts         # paso 3
    propuesta-valor.ts# paso 4
  prompt-preamble.ts  # preámbulo compartido (rol, regla de oro, tono, triangulación)
  schema.ts           # tipos de cada parte + Deliverable
  generator.ts        # orquesta la secuencia, resuelve dependencias
  service.ts          # ensureNormalized por sesión, llama generator, persiste
```

### Dependencias entre pasos

```
personalidad(0) ──▶ problema(1)
{answers} ─────────▶ competencia(2)
{problema, personalidad} ──▶ perfil(3)
{problema, perfil} ──▶ propuestaValor(4)
```

MVP: ejecución **secuencial** (simple de construir y depurar; volumen bajo, latencia no crítica; 5 llamadas entran cómodo en el timeout de 300s de Vercel). Paralelizar `personalidad`+`competencia` es optimización posterior.

### Cómo se porta el skill

El prompt de cada paso = **preámbulo compartido** (rol "estratega de M&B", regla de oro de no-inventar, tono español colombiano + verbatim, instrucción de triangulación consenso/tensión) + **instrucciones específicas del paso** (el trozo relevante del `SKILL.md`) + **la estructura** de `references/estructura-y-ejemplo.md` + **input** (respuestas normalizadas de TODOS los respondientes, con nombre y cargo de cada uno + outputs de los pasos de los que depende) + **esquema JSON de salida**.

El texto guía del skill se embebe como **constantes versionadas en cada módulo de paso** (no se lee el .md en runtime), para que sea testeable y evolucione con el código.

### Marcado de origen (honra la regla de oro)

Cada bloque/ítem generado lleva `origen: 'cliente' | 'equipo' | 'pendiente'`. El esquema JSON lo exige. El panel lo renderiza distinto. Así el entregable es honesto sobre qué es dato, qué propone el equipo y qué queda para el taller.

### Input por respondiente

Antes de generar, se corre `ensureNormalized` por cada sesión del proyecto. El generador recibe, por sesión: `{ respondentName, role, answers: [{ questionId, text, imageChoice }] }` usando `normalizedText ?? rawText`.

### Modelo y cliente

Reuso del cliente OpenRouter actual (`src/lib/brief/service.ts`), modelo `anthropic/claude-sonnet-4.6`, `authToken: OPENROUTER_API_KEY`. Salida JSON estructurada por paso, parseada por esquema (con reintento del modelo ante desajuste, patrón ya usado).

## 5. Modelo de datos

Cambios sobre `src/lib/db/schema.ts`:

```ts
// NUEVO
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),               // nombre mostrado (marca)
  normalizedName: text('normalized_name').notNull(), // clave de agrupación
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// NUEVO
export const deliverables = pgTable('deliverables', {
  projectId: uuid('project_id').primaryKey().references(() => projects.id),
  content: jsonb('content').notNull(), // { personalidad, problema, competencia, perfil, propuestaValor }, cada parte con { data, generatedAt }
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// MODIFICADO: sessions gana project_id nullable
projectId: uuid('project_id').references(() => projects.id),
```

- Cada parte del `content` guarda su propio `generatedAt` → habilita **regenerar por parte** sin rehacer todo.
- La tabla `briefs` (brief genérico per-sesión, en pausa y sin uso) se **retira**: el brief viejo y su prompt/generator/endpoint se eliminan. El PDF actual construye desde respuestas, no desde `briefs`, así que no se rompe.

Store (`src/lib/db/store.ts`) suma: `findOrCreateProject(normalizedName, name)`, `assignSessionToProject`, `listProjects`, `getProjectWithSessions`, `saveDeliverable(projectId, content)`, `getDeliverable(projectId)`. Se retiran `saveBrief`/`getBrief`.

## 6. API y panel

**Rutas API:**
- `POST /api/projects/[id]/deliverable` — corre el pipeline completo, persiste, devuelve el entregable.
- `POST /api/projects/[id]/deliverable?part=problema|competencia|perfil|propuestaValor|personalidad` — regenera una sola parte (reusa outputs guardados de las dependencias).
- `PATCH /api/sessions/[id]` — reasignar `project_id` (corrección manual de agrupación).

Generación **síncrona** con estado de carga en el panel.

**Panel admin:**
- Nueva vista de **proyectos** (`/admin` pasa a listar proyectos; cada uno lista sus sesiones agrupadas). Se puede reasignar una sesión a otro proyecto.
- Vista de proyecto: botón **"Generar entregable"** + render de las 4 partes con la anatomía real del deck, marcando visualmente *dato del cliente* / *propuesta del equipo* / *pendiente del taller*, con **regenerar por parte**.
- El mapa (Parte 2) se muestra en MVP como **datos** (lista de marcas + los 2 ejes + posición actual/ideal en texto), no como dibujo.

## 7. Errores y bordes

- **Sesión sin respuestas suficientes / proyecto vacío:** el paso marca los bloques como *pendiente del taller* en vez de inventar.
- **Fallo de una llamada Claude:** el paso falla de forma aislada; los demás se conservan; el panel permite reintentar esa parte. La generación completa reporta qué partes quedaron pendientes.
- **JSON inválido del modelo:** reintento por esquema; si persiste, la parte queda marcada como error regenerable.
- **N=1 respondiente:** sin triangulación; el prompt lo maneja (no fuerza tensiones inexistentes).
- **Normalización best-effort:** si `ensureNormalized` no corre (sin key), se usa `rawText` — comportamiento actual.

## 8. Fuera de alcance (próximas iteraciones)

**Grupo A — extensiones de esta feature (nivel 2):**
- Deck/PPT automático con plantilla M&B (hoy: contenido en panel para copiar).
- Dibujo visual del mapa de ejes con marcas ubicadas (hoy: datos en texto).

**Grupo B — frente independiente (entrevista en vivo, no toca este motor):**
- Audios ElevenLabs (`gen:audio`, `/public/audio` vacío).
- Deploy a Vercel + env vars en prod.

## 9. Testing

- Por paso: test del constructor de prompt (incluye respuestas de N respondientes, marca dependencias) + del parser de esquema, con fixtures de respuestas.
- Triangulación: fixture con contradicción entre respondientes → el prompt instruye nombrar la tensión (verificable a nivel de prompt-builder / esquema, no del LLM).
- Store: `findOrCreateProject`, `assignSessionToProject`, `saveDeliverable`/`getDeliverable` sobre pglite.
- Panel: render de las 4 partes con los tres orígenes; estado vacío; estado "generando".
- Reuso del stack vitest + pglite existente.
