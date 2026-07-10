# El panel del proyecto muestra el documento del entregable

**Fecha:** 2026-07-10
**Alcance:** la vista de proyecto (`/admin/projects/[id]`) deja de renderizar las 5 partes crudas del `Deliverable` y renderiza el mismo documento de 3 secciones que imprime el PDF del taller, reutilizando el view-model existente (`buildDeckView` / `buildProjectDeckView`). Además, el nombre de cada respondiente abre el PDF de su entrevista en pestaña nueva.

## Contexto

El rediseño visual del admin (spec `2026-07-10-admin-rediseno-visual-design.md`) dejó el shell del panel con identidad M&B, pero el contenido del entregable sigue siendo el JSON crudo del motor: párrafos con `**Etiqueta:**`, badges de color en cada ítem, 5 cards idénticas sin numeración, tabla apretada y grises variados. El PDF del taller (`src/lib/deck/DeckDocument.tsx`) ya resolvió la presentación de este mismo contenido con un sistema visual aprobado; el panel debe ser su espejo HTML.

## Arquitectura y datos

- `src/app/admin/projects/[id]/page.tsx` llama a `buildProjectDeckView(projectId)` (`src/lib/deck/service.ts`, ya existe: arma corpus y verifica citas) además de lo que ya carga, y pasa el `DeckView | null` al panel. También pasa la parte `personalidad` cruda del deliverable (es insumo interno, el view-model no la incluye).
- Componente nuevo **`DeliverableDocument`** (`src/app/admin/projects/[id]/DeliverableDocument.tsx`): presentacional puro, recibe `{ view: DeckView, busy, onRegenerate }` y renderiza las 3 secciones + tabla. Es el espejo HTML de `DeckDocument` (PDF).
- **`DeliverablePanel`** queda como shell interactivo: card de respondientes, botón "Generar entregable / Regenerar todo", errores de generación, card plegada de personalidad, y delega el documento a `DeliverableDocument`.
- **Regenerar**: mismos endpoints `POST /api/projects/[id]/deliverable?part=…`. Tras éxito, `location.reload()` (el servidor rearma el view-model con corpus); se elimina la actualización en memoria (`setD`).
- **Mapeo sección→partes** en `src/app/admin/projects/[id]/section-parts.ts`: función pura `partsOfSection(numero: 1|2|3): PartKey[]` → `1=['problema']`, `2=['competencia']`, `3=['perfil','propuestaValor']`. Con test unitario.

## El documento en HTML

Mismo sistema visual del deck (paleta cerrada: ink `#1a1510`, crema `#fffdf2`, banana `#ffd400`, gris `#6b6155`, borde `#e6dfd0`):

- **Encabezado de sección**: banda banana redondeada (`bg-[var(--banana)]`) con kicker "TALLER PROPUESTA DE VALOR" (uppercase, tracking, ink al 60%), título en serif, y el número grande ("01", "02", "03") en serif ink translúcido a la derecha. Sin motion.
- **Bloques**: título en `font-serif` con línea inferior `#e6dfd0`; párrafos `text-[15px]` con `leading-relaxed`.
- **Ítems**: fila con guion largo "—" en banana + texto en ink; ítems `pendiente` en gris `#6b6155`. La cita cuelga debajo: `border-l-2` banana, texto gris, tamaño menor. El origen aparece como etiqueta minúscula debajo (lowercase, tracking suave, gris) SOLO para `equipo` ("propuesta del equipo") y `pendiente` ("pendiente del taller") — los ítems de cliente van limpios. Desaparecen los badges de colores.
- Del `DeckView` se renderizan solo las `secciones` (con su tabla). `marca` no se repite (ya está en el header de la página), `fecha` es del PDF, y `completo`/`faltantes` no se muestran: los errores por sección ya comunican lo que falta.
- **Tabla JTBD**: columnas 30/30/40, header uppercase con tracking en gris y línea inferior ink, filas con divisores `#e6dfd0`, celdas `text-sm` con aire vertical.
- **Errores de sección/bloque/tabla** (los trae el view-model): bloque suave `#fff4f4` con borde `#f0d0d0` y texto `#8a3a3a` (colores del deck).
- **Grises**: dentro del área del documento solo `#6b6155` (texto secundario) y `#e6dfd0` (líneas). Los grises `#8a8170`/`#a59c89` siguen siendo válidos en el shell (respondientes, estados vacíos), no dentro del documento.

## Personalidad (apoyo)

Card discreta al final del documento, plegada con `<details>`/`<summary>` nativo (sin JS ni animación): summary "Personalidad (insumo interno)" + su botón fantasma "Regenerar". Dentro: arquetipo, atributos, qué NO quiere ser, tensiones — en el mismo idioma tipográfico del documento (sin badges).

## Regenerar por sección

- Botón fantasma en el encabezado de cada sección (estilo actual del botón "Regenerar"). Sección 3 lleva dos: "Regenerar perfil" y "Regenerar propuesta de valor".
- Estado ocupado por parte como hoy (`busy: PartKey | 'full' | null`); los botones se deshabilitan mientras hay una generación en curso.
- Sin entregable guardado (`view === null`): estado vacío con copy "Todavía no hay entregable. Genera el documento cuando las entrevistas estén completas." (el botón "Generar entregable" vive arriba, en la card de respondientes).

## Respondientes

- El nombre del respondiente pasa de linkear `/admin/${s.id}` a abrir `/api/sessions/${s.id}/pdf` en pestaña nueva (`target="_blank" rel="noopener"`), con un icono pequeño de documento (aria-hidden) al lado del nombre. Mismo estilo de link (underline con hover banana).
- La página de detalle `/admin/[sessionId]` queda accesible solo por URL directa (sin link en la UI). No se elimina.
- El select "mover a…" y el resto de la card no cambian.

## Restricciones

- Sin rutas ni APIs nuevas. Los endpoints de generación no cambian.
- Motion mínimo (mismas reglas del spec anterior): solo `animate-fade` y transiciones de color/opacidad; `<details>` nativo sin animar.
- Español neutro en todo copy.
- Sin cambios en login, lista de proyectos ni página de sesión.

## Manejo de errores

- Error de generación (POST falla): bloque inline rojo suave como hoy, en el shell.
- Errores de contenido (parte no generada): los marca el view-model y se renderizan dentro del documento con el estilo de error del deck.
- `buildProjectDeckView` devuelve `null` si no hay entregable → estado vacío.

## Verificación

- Test unitario de `partsOfSection` (mapeo completo y exhaustivo de las 3 secciones).
- Suite Vitest completa en verde; `next build` limpio.
- Click-through con el caso Cafe Lunar: documento completo renderizado, regenerar una sección (recarga y persiste), abrir el PDF de un respondiente en pestaña nueva, estado sin entregable (proyecto nuevo o mock).
