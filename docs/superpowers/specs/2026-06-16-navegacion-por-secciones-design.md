# Navegación por secciones, indicador de sección y branding banana

**Fecha:** 2026-06-16
**Estado:** Aprobado, listo para plan de implementación

## Objetivo

Durante la entrevista, el cliente debe poder:

1. **Volver a preguntas anteriores** desde un riel lateral, agrupadas por sección y numeradas (1, 2, 3…).
2. **Ver en qué sección está** en todo momento.
3. Percibir **branding de Mellow & Banana** — una banana visible de forma sutil y recurrente.

## Contexto actual

- El flujo vive en `src/app/interview/[sessionId]/page.tsx`. Mantiene un índice `i` sobre `visibleQuestions(saved)` (lista plana, ya filtrada por branching `showIf`).
- `InterviewScreen` (preguntas abiertas) y `ProjectiveScreen` (image/color/gender grid) **renderizan cada uno su propio shell**: fondo crema exterior + tarjeta centrada (`max-w-md` / `md:max-w-xl`) + header con `Wordmark` + `ProgressDots`.
- Entre secciones hay pantallas `Breather` (intro de sección y cierre), disparadas por `sectionIntro(id)` y `closingAfter(...)`. Un set `introduced` evita repetir cada intro.
- Las preguntas se agrupan en `SCRIPT` (`src/lib/script/questions.ts`) en secciones: `identity`, `project`, `consumer`, `design`, `projective`. **`identity` no forma parte del flujo de voz** (`interviewQuestions()` la excluye), así que el riel cubre 4 secciones: Proyecto, Consumidor, Diseño, Proyectivo.
- Lenguaje del producto: español neutro (tuteo). Estética: "Blanco Apple + tinte crema" (#fffdf2), banana #ffd400, ink #1a1510, fondo exterior #ece4d2. Usuario **sensible al movimiento**: motion mínimo y localizado, nada de fondos animados.

## Decisiones de diseño (validadas con companion visual)

- **Layout desktop:** tarjeta más ancha de **dos columnas** — riel integrado a la izquierda, contenido de la pregunta a la derecha.
- **Layout móvil:** la tarjeta vuelve a una columna; el riel se reemplaza por una **tira superior de 4 segmentos** (uno por sección), que se llenan de banana; el segmento activo muestra el nombre de la sección.
- **Alcance de navegación:** solo se puede saltar a **preguntas ya respondidas** (más la actual). Las futuras quedan deshabilitadas. No hay salto libre hacia adelante.
- **Banana:** un **glyph SVG** limpio (no emoji) como acento recurrente, junto al wordmark y en la barra móvil.
- **Breathers:** se mantienen full-screen sin riel — son momentos de pausa entre secciones.

## Arquitectura

### 1. Helper de datos: `visibleSections(answers)` en `src/lib/script/flow.ts`

Agrupa las preguntas visibles por su sección del `SCRIPT`, preservando el orden y respetando el branching.

Firma propuesta:

```ts
export interface SectionView {
  key: Section['key']          // 'project' | 'consumer' | 'design' | 'projective'
  title: string
  questions: { question: Question; index: number; localNumber: number }[]
}

export function visibleSections(answers: Answers): SectionView[]
```

- `index` = posición global de la pregunta en `visibleQuestions(answers)` (la misma lista que indexa `i` en la página). Es el valor que se pasa a `onJump`.
- `localNumber` = número dentro de la sección, contiguo, empezando en 1.
- Solo incluye secciones del flujo de voz (excluye `identity`). Una sección sin preguntas visibles no aparece.
- Debe quedar consistente con `visibleQuestions(answers)`: recorrer `SCRIPT`, filtrar por `showIf`, y numerar global+local en un solo paso para garantizar que `index` coincide con el índice plano.

### 2. `BananaGlyph` en `src/components/Brand.tsx`

Pequeño componente SVG de una banana, color configurable (default banana-yellow), tamaño por prop. Limpio, sin detalle excesivo. Se usa en el riel (junto al `Wordmark`) y en la tira móvil.

### 3. `SectionNav` (nuevo, `src/components/SectionNav.tsx`)

Componente responsive. Props:

```ts
{
  sections: SectionView[]
  currentIndex: number          // i actual
  answeredIds: Set<string>      // ids con respuesta guardada
  onJump: (index: number) => void
}
```

Reglas de estado por chip/pregunta:
- **actual** (`index === currentIndex`): relleno banana, no navega.
- **respondida** (`answeredIds.has(id)`): clickeable; `onClick` → `onJump(index)`.
- **futura**: atenuada, `disabled`, sin handler.

Render:
- **Desktop (`hidden md:flex`, columna):** arriba `BananaGlyph` + `Wordmark`. Por cada sección: su `title` (resaltado si es la sección activa) y una fila de chips con `localNumber`. La sección activa es la que contiene `currentIndex`.
- **Móvil (`md:hidden`, tira superior):** 4 segmentos con ancho proporcional al nº de preguntas de cada sección, llenado según progreso. El segmento activo muestra `🍌/glyph {title} · {localActual}/{totalSección}`. Tocar un segmento de una sección anterior llama `onJump` con el `index` de la **primera** pregunta de esa sección (toda sección anterior está respondida). Segmentos de secciones futuras deshabilitados.

### 4. `InterviewLayout` (nuevo, `src/components/InterviewLayout.tsx`)

Extrae el shell compartido. Props: `{ sections, currentIndex, answeredIds, onJump, children }`.

- Fondo crema exterior (#ece4d2), centrado.
- Tarjeta crema de dos columnas en desktop (`md:max-w-3xl` aprox., a ajustar visualmente): izquierda `SectionNav` (riel), derecha `children`.
- En móvil: una columna; `SectionNav` se renderiza como tira superior (mismo componente, su parte `md:hidden`), luego `children`.

### 5. `page.tsx`

- Calcular `const sections = visibleSections(saved)` y `const answeredIds = new Set(Object.keys(saved))`.
- Envolver la pantalla de pregunta activa:

```tsx
<InterviewLayout sections={sections} currentIndex={i} answeredIds={answeredIds} onJump={setI}>
  {q.type === 'open'
    ? <InterviewScreen {...common} voice={voice} />
    : <ProjectiveScreen {...common} />}
</InterviewLayout>
```

- `onJump` = `setI` (los índices ya vienen acotados a respondidas desde `SectionNav`).
- Breathers e intros de sección siguen renderizándose **fuera** del `InterviewLayout` (full-screen, sin riel), igual que hoy.

### 6. `InterviewScreen` y `ProjectiveScreen`

- Eliminar el shell propio: el `<div>` exterior de fondo, la tarjeta y el header (`Wordmark` + `ProgressDots`).
- Devolver solo el **contenido de la columna derecha**: pregunta (con su `withHighlight` / grids) + bloque de controles (mic/textarea/grids + Atrás/Regrabar/Siguiente), en un contenedor que se centra verticalmente dentro de la columna.
- Conservar el botón **"Atrás"** lineal (complementa los saltos del riel).
- `ProgressDots` deja de usarse en estas pantallas (el riel/tira es el nuevo indicador de progreso). Mantener el componente en el repo por si se reutiliza; no es necesario borrarlo.

## Data flow

```
page.tsx
  saved (Answers) ──> visibleQuestions(saved) ──> q, i
  saved ──> visibleSections(saved) ──> sections
  saved ──> answeredIds (Set de keys)
       │
       └─> <InterviewLayout sections currentIndex=i answeredIds onJump=setI>
              └─ <SectionNav …>  (riel desktop / tira móvil)
              └─ children: <InterviewScreen|ProjectiveScreen> (solo contenido)
```

Al cambiar de pregunta o responder, `saved`/`i` cambian → `sections` y `answeredIds` se recalculan → el riel refleja estado. El branching (`showIf` sobre `genero`) ya está contemplado porque `visibleSections` filtra igual que `visibleQuestions`.

## Manejo de casos borde

- **Branching de género:** al cambiar `genero`, `edad_hombre`/`edad_mujer` entran/salen de la lista visible; `visibleSections` se recalcula y la numeración local de Proyectivo queda contigua. Las respuestas de una rama que deja de ser visible permanecen en `saved` pero no aparecen en el riel.
- **Saltar atrás y reasignar:** saltar conserva `saved`; las preguntas posteriores ya respondidas siguen siendo clickeables (permite volver a donde estabas).
- **Intros de sección:** no se repiten al saltar (set `introduced`); además solo se salta a preguntas respondidas, que ya pasaron su intro.
- **Sección sin preguntas visibles:** no se renderiza en el riel ni como segmento.

## Estrategia de testing (TDD)

- `visibleSections` (unit, `flow`): agrupación correcta por sección, numeración local contigua desde 1, `index` global coincidente con `visibleQuestions`, exclusión de `identity`, branching de género (con `genero=mujer` se oculta `edad_hombre` y la numeración sigue contigua).
- `SectionNav` (componente): sección activa resaltada; chip de pregunta respondida invoca `onJump` con el `index` correcto; chip futuro deshabilitado y sin handler; tira móvil salta al inicio de la sección.
- Ajustar tests existentes de `InterviewScreen`/`ProjectiveScreen` que dependan del shell viejo (header `Wordmark`/`ProgressDots`).
- Mantener verde `next build` y la suite Vitest.

## Fuera de alcance (YAGNI)

- Salto libre hacia adelante a preguntas no respondidas.
- Drawer/cajón en móvil con lista completa de preguntas (se eligió la tira de segmentos).
- Animaciones más allá de las transiciones `animate-q` ya existentes.
- Reordenar o editar el contenido de las preguntas.
