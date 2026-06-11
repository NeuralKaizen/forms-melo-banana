# Diseño — Export de la entrevista a PDF (template determinista)

**Fecha:** 2026-06-11
**Estado:** aprobado en dirección (pendiente revisión final del spec)

## Objetivo

Dejar un **PDF** como entregable directo para el equipo de Mellow & Banana, sin que
tengan que entrar a una UI. El PDF es un **template fijo** (logo, títulos, preguntas =
boilerplate idéntico para todos los clientes) cuyos huecos se rellenan con la **respuesta
literal** del forms. Sin IA, sin texto generado/repetido por cliente.

## Decisiones cerradas

- **Contenido:** solo respuestas literales (no el brief de IA, diferido).
- **Proyectivas:** chips con la etiqueta de lo elegido (no miniaturas de imagen).
- **Generación:** `@react-pdf/renderer` (server-side, sin navegador headless → apto Vercel).
- **Entrega:** endpoint `GET /api/sessions/[id]/pdf` que arma el PDF al vuelo desde la
  base y lo devuelve como descarga. No se guarda nada extra.
- **Botón de descarga:** solo en el panel admin de la sesión (`/admin/[sessionId]`).
  La pantalla `/gracias` del cliente queda simple, sin PDF.

## Dependencia nueva

`@react-pdf/renderer` (devuelve `Document`/`Page`/`View`/`Text`/`StyleSheet` y
`renderToBuffer`). Corre en runtime Node (no edge).

---

## Piezas

### 1. View-model puro — `src/lib/pdf/answers-view.ts`

Toda la lógica de mapeo, sin React ni PDF → testeable de forma aislada. Lee `SCRIPT`
de `@/lib/script/questions` para los títulos/preguntas/opciones.

```ts
export interface TextItem { prompt: string; answer: string }
export interface Chip { label: string; value: string; swatch?: string }
export interface BriefView {
  company: string
  contact: string
  date: string
  sections: { title: string; items: TextItem[] }[]
  projective: Chip[]
}

export function buildBriefView(
  session: { name?: string | null; company?: string | null; role?: string | null; completedAt?: Date | null },
  answers: { questionId: string; rawText: string; imageChoice?: string | null }[],
): BriefView
```

Reglas:
- `company` = `session.company` o `'(sin empresa)'`.
- `contact` = `[session.name, session.role].filter(Boolean).join(' · ')`.
- `date` = `session.completedAt` formateada `dd mmm yyyy` en español (o `''` si falta).
- **Secciones de texto:** recorrer `SCRIPT` excepto la sección `identity` y excepto la
  sección `projective`. Por cada pregunta `type === 'open'`: `{ prompt: q.prompt, answer: rawText || '—' }`.
- **Proyectiva:** por cada pregunta de la sección `projective` que tenga respuesta, un chip:
  - `label` = etiqueta corta por id: animal→`'Animal'`, color→`'Color'`, genero→`'Género'`,
    edad_hombre/edad_mujer→`'Edad'`, olor→`'Olor'`, ciudad→`'Ciudad'`.
  - `value` = label de la opción elegida (busca la opción por `imageChoice` en `q.options`);
    si no se encuentra, usa el `imageChoice` crudo.
  - `swatch` (solo color-grid) = un hex representativo de la rampa de la opción: `colors[Math.floor(colors.length / 2)]`.
  - **Edad:** incluir solo la variante que coincide con el género elegido
    (lee el `imageChoice` de `genero`); si hay respuesta "stale" de la otra, se ignora.
- Una respuesta cuyo `rawText` es vacío y sin `imageChoice` cuenta como faltante.

### 2. Template PDF — `src/lib/pdf/BriefDocument.tsx`

Componente `<Document>` de react-pdf que recibe `{ view: BriefView }` y solo pinta:
- Banda superior banana (`#E9B949`).
- Encabezado: bloque-logo banana con "Mellow & Banana", título serif "Brief de entrevista",
  subtítulo "Ejercicio proyectivo de marca", y empresa / contacto / fecha.
- Secciones de texto: título de sección (mayúsculas, gris), y por item: pregunta (gris,
  chico) + respuesta (tinta).
- Proyectiva: título de sección + chips en fila (etiqueta gris + valor; si hay `swatch`,
  un cuadradito de ese color antes del valor).
- Pie: "Mellow & Banana · Branding" y un id corto de sesión.

Estilo con `StyleSheet.create`. Tipografía built-in: **Times-Roman** para títulos
(evoca el serif de marca), **Helvetica** para el cuerpo. Paleta: tinta `#1F1B14`,
gris `#9A917D`, crema `#FAF6EC`, banana `#E9B949`, borde `#ECE4D2`.

### 3. Endpoint — `src/app/api/sessions/[id]/pdf/route.ts`

```ts
export const runtime = 'nodejs'
export async function GET(_req, { params }) { /* … */ }
```
- `const { id } = await params`.
- `getSessionWithAnswers(db, id)`; si no existe → `404`.
- `const view = buildBriefView(full, full.answers)`.
- `const buffer = await renderToBuffer(<BriefDocument view={view} />)`.
- Devolver `new Response(buffer, { headers: { 'content-type': 'application/pdf',
  'content-disposition': \`attachment; filename="brief-\${slug}.pdf"\` } })`,
  con `slug` = `company` en minúsculas, no-alfanumérico→`-`, fallback `'entrevista'`.

### 4. Botón en admin — `src/app/admin/[sessionId]/page.tsx`

Agregar un enlace de descarga junto al título:
`<a href={\`/api/sessions/\${sessionId}/pdf\`} ...>Descargar PDF</a>`.
(Cambio mínimo; no se toca el resto del panel.)

---

## Tests

- **`src/lib/pdf/answers-view.test.ts`** (node): construir un `session`+`answers` de prueba y
  verificar: secciones de texto en orden con sus respuestas; respuesta faltante → `'—'`;
  chip proyectivo mapea id→label (`leon`→`'León'`); swatch de color = hex medio de la rampa;
  edad respeta el género elegido (ignora la variante stale); `contact`/`company`/`date` correctos.
- **`src/lib/pdf/BriefDocument.test.tsx`** (node): `renderToBuffer(<BriefDocument view={…} />)`
  devuelve un `Buffer` no vacío cuyos primeros bytes son `'%PDF'`.
- El endpoint y el botón se verifican a mano (descargar el PDF y abrirlo).

---

## Orden de implementación

1. Dependencia `@react-pdf/renderer`.
2. `answers-view.ts` (+test) — lógica pura.
3. `BriefDocument.tsx` (+test) — template.
4. `route.ts` — endpoint de descarga.
5. Botón en el panel admin.

## Fuera de alcance

- Brief de IA en el PDF — diferido.
- Miniaturas de imágenes de las proyectivas — se eligieron chips.
- Fuente de marca custom (registrar `.ttf`) — después; por ahora Times/Helvetica built-in.
- PDF en la pantalla `/gracias` del cliente — queda simple, sin descarga.
