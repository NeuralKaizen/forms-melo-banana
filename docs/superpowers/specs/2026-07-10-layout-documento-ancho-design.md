# Layout ancho con paneles crema para el documento del entregable

**Fecha:** 2026-07-10
**Alcance:** solo layout/presentación de la vista de proyecto (`/admin/projects/[id]`). El documento del entregable (spec `2026-07-10-panel-documento-entregable-design.md`) se sentía angosto y con demasiado texto corrido; esta iteración lo ensancha y organiza los bloques en grilla con paneles. Cero cambios de lógica, datos o rutas.

## Decisión (validada con mockups en el visual companion)

- Layout **B**: página ancha con bloques a dos columnas (elegido sobre: columna ancha simple, riel lateral de navegación, pestañas por sección).
- Tratamiento **V1**: cada bloque en un panel crema suave (elegido sobre: pestaña banana en el título, cards con header propio).

## Ancho de página

- `src/app/admin/projects/[id]/page.tsx`: el `<main>` pasa de `max-w-3xl` a `max-w-5xl` (ambas ramas: éxito y "no encontrado").
- `src/components/AdminBar.tsx` gana una prop opcional `wide?: boolean` (default `false`): con `wide`, el header usa `max-w-5xl`; sin ella, `max-w-3xl` como hoy. Solo la vista de proyecto la pasa. Lista de proyectos y página de sesión no cambian.

## Grilla de bloques (en `DeliverableDocument`)

- Dentro de la hoja blanca de cada sección, los bloques se colocan en `grid grid-cols-1 md:grid-cols-2` con gap generoso (`gap-x-8 gap-y-6` aprox.), **en orden de documento, por pares**.
- **Regla del impar:** si el número de bloques de la sección es impar, el último bloque ocupa el ancho completo (`md:col-span-2`).
- **La tabla JTBD siempre ocupa el ancho completo** (`md:col-span-2`), después de los bloques.
- Con los contenidos actuales del view-model queda: sección 01 = [mundo | marca], [consumidor | cómo], [relevante ancho]; sección 02 = [competidores | referentes], [variables | pos. actual], [pos. ideal ancho]; sección 03 = [jobs | gains], [pains | síntesis], tabla ancha. Si el perfil de la sección 3 falla (bloques colapsan a [error, síntesis]), la regla sigue funcionando: quedan en par.
- El error de sección completa (`sec.error`) no usa grilla: el `ErrorBox` ocupa la hoja como hoy.
- En móvil (`< md`) todo cae a una columna, mismo orden.

## Paneles crema (bloques)

- Cada bloque (`Block`) se envuelve en un panel: fondo **`#fbf8ee`** ("crema profundo" — entra a la paleta del documento porque el crema `#fffdf2` casi no se distingue sobre blanco), `rounded-xl`, padding generoso (`p-5` aprox.).
- El título del bloque queda serif como hoy pero **pierde la línea inferior** (`border-b`): el panel ya da la separación.
- La tabla JTBD también va dentro de un panel crema a lo ancho, con su título igual (sin línea).
- Ítems, citas (borde banana), etiquetas de origen y `ErrorBox` no cambian de estilo; solo viven dentro del panel.
- La banda banana de sección y el número translúcido no cambian.

## Sin cambios

- Lógica completa: view-model, regenerar, busy/error, personalidad plegada, respondientes (PDF en pestaña nueva), estados vacíos, endpoints.
- Login, lista de proyectos y página de sesión.
- Motion mínimo (solo `animate-fade` y transiciones de color/opacidad), español neutro.
- `section-parts.ts` y su test.

## Verificación

- `npx tsc --noEmit` limpio; suite Vitest completa; `next build`.
- Click-through con Cafe Lunar: grilla de pares correcta en las 3 secciones, bloque impar a lo ancho, tabla ancha, panel crema visible, ancho 1024 con AdminBar alineada, y responsive móvil (1 columna) con el viewport angosto.
