# Diseño — Ejercicio proyectivo completo + branching + navegación manual

**Fecha:** 2026-06-11
**Estado:** aprobado en dirección (pendiente revisión final del spec)

## Objetivo

Cerrar bien el formulario: (1) cambiar la navegación para que grabar ya no avance
solo, (2) completar el ejercicio proyectivo (7 preguntas, hoy solo existe "animal" y
con opciones equivocadas), (3) hacer la sección proyectiva **mouse-only** (sin texto/
voz), y (4) branching condicional género → edad. Las imágenes van de fotos reales libres.

## Decisiones cerradas

- **Navegación:** al cortar la grabación NO se avanza; solo llena el texto y para de
  grabar. La persona revisa/edita y toca **Siguiente** a mano. Aplica a las preguntas de voz.
- **Proyectiva mouse-only:** se elige con el mouse (clic → "Siguiente"). Sin "¿por qué?".
- **Imágenes:** color por CSS; género por SVG inline; animal/olor/ciudad/edad por fotos
  libres descargadas a `public/projective/` (el usuario puede reemplazar archivos).
- **Respiros:** se dejan en 7 y 12 (se mejoran después). El cierre se dispara tras la
  última pregunta real (usa `total`, que ahora es dinámico).

---

## 1. Navegación manual (quitar auto-advance)

En `src/components/InterviewScreen.tsx`, en la rama "stop" de `toggle()`, **eliminar** la
llamada `if (canSubmit(next, choice)) onAnswer(...)`. Cortar la grabación solo hace
`setText(next)` y `setListening(false)`. El botón **Siguiente** (ya existe, manual) es el
único que avanza. "Atrás" y "Regrabar" siguen igual.

Tests afectados (`InterviewScreen.test.tsx`): el test "2do toque guarda y avanza" cambia a
**"2do toque llena el texto y NO avanza"** (assert: textarea con el final, `onAnswer` NO
llamado; luego clic en "Siguiente" → `onAnswer` con ese texto). El test de image-grid
sin-choice deja de aplicar a InterviewScreen (la proyectiva se mueve a `ProjectiveScreen`)
— se elimina de este archivo y su cobertura va al test de `ProjectiveScreen`.

---

## 2. Modelo de datos (script/types.ts)

Extender el tipo de pregunta y unificar las opciones:

```ts
export type QuestionType = 'open' | 'image-grid' | 'color-grid' | 'gender'

export interface Option {
  id: string
  label: string
  src?: string       // image-grid: ruta bajo /public
  colors?: string[]  // color-grid: rampa de shades CSS (claro→oscuro)
}

export type Answers = Record<string, { rawText: string; imageChoice?: string }>

export interface Question {
  id: string
  type: QuestionType
  prompt: string
  highlight?: string
  audio: string
  options?: Option[]
  /** Si está y devuelve false, la pregunta se omite del flujo (branching). */
  showIf?: (answers: Answers) => boolean
}
```

`ImageOption` se reemplaza por `Option` (ImageGrid pasa a tipar `Option[]`). El campo
`audio` se mantiene (no se usa en la demo pero conserva el contrato y el test del SCRIPT).

---

## 3. Guion proyectivo (script/questions.ts)

La sección `projective` pasa de 1 a 7 preguntas. Prompts exactos de las capturas
(español neutro). Helper nuevo para imágenes:

```ts
const img = (id: string, label: string, src: string): Option => ({ id, label, src })
```

**Animal** (`animal`, image-grid) — "Si la compañía fuera un animal, ¿cuál sería?":
conejo, caballo, león, delfín, águila, iguana, perro, gato, flamenco
(`/projective/animal/<id>.jpg`).

**Color** (`color`, color-grid) — "Si la compañía fuera un color, ¿cuál sería?":
9 opciones con rampa CSS (`colors`):
- amarillo `['#FEF9C3','#FDE047','#EAB308','#CA8A04','#854D0E']`
- violeta `['#F3E8FF','#D8B4FE','#A855F7','#7E22CE','#581C87']`
- naranja `['#FFEDD5','#FDBA74','#F97316','#EA580C','#9A3412']`
- rojo `['#FEE2E2','#FCA5A5','#EF4444','#DC2626','#7F1D1D']`
- marrón `['#EFE2D2','#C9A27A','#92633B','#5C3A1E','#3B2412']`
- verde `['#ECFCCB','#BEF264','#84CC16','#4D7C0F','#365314']`
- azul `['#DBEAFE','#60A5FA','#2563EB','#1D4ED8','#0C2A66']`
- gris/negro `['#F3F4F6','#9CA3AF','#4B5563','#1F2937','#030712']`
- teal `['#CCFBF1','#5EEAD4','#14B8A6','#0F766E','#134E4A']`

**Género** (`genero`, gender) — "Si la compañía tuviera un género, ¿cuál sería?":
`[{id:'hombre',label:'Hombre'},{id:'mujer',label:'Mujer'}]` (render silueta SVG).

**Edad hombre** (`edad_hombre`, image-grid) — "Si la compañía tuviera una edad, ¿cuál
sería?": 5 opciones `20s,30s,40s,50s,60s` (`/projective/edad-hombre/<id>.jpg`).
`showIf: (a) => a['genero']?.imageChoice !== 'mujer'`.

**Edad mujer** (`edad_mujer`, image-grid) — mismo prompt, set femenino
(`/projective/edad-mujer/<id>.jpg`). `showIf: (a) => a['genero']?.imageChoice === 'mujer'`.

> Con estos predicados **siempre se muestra exactamente una** de las dos preguntas de
> edad (antes y después de elegir género), así el total de preguntas es **constante = 20**
> y la navegación por índice es estable.

**Olor** (`olor`, image-grid) — "Si la compañía tuviera un olor, ¿cuál sería?":
cerezo, piña, césped, río, caramelos, madera, hierba, naranjas, rosas
(`/projective/olor/<id>.jpg`).

**Ciudad** (`ciudad`, image-grid) — "Si la compañía fuera una ciudad, ¿cuál sería?":
bali, ny, barcelona, delhi, lasvegas, berlin, paris, dubai, marrakech
(`/projective/ciudad/<id>.jpg`).

Orden en SCRIPT: `animal, color, genero, edad_hombre, edad_mujer, olor, ciudad`.

`questions.test.ts`: actualizar/ampliar — ids únicos (ya está), y un test nuevo de que
la sección projective tiene esas 7 ids y que color-grid trae `colors` y image-grid trae `src`.

---

## 4. Flujo dinámico con branching (script/flow.ts)

Agregar:

```ts
import type { Answers } from './types'

export function visibleQuestions(answers: Answers): Question[] {
  return interviewQuestions().filter(q => !q.showIf || q.showIf(answers))
}
```

Test (`flow.test.ts`): con `{}` o `{genero:{imageChoice:'hombre'}}` → 20 preguntas con
`edad_hombre` y sin `edad_mujer`; con `{genero:{imageChoice:'mujer'}}` → 20 con
`edad_mujer` y sin `edad_hombre`.

---

## 5. ProjectiveScreen (componente nuevo, mouse-only)

`src/components/ProjectiveScreen.tsx` — sin micrófono ni textarea. Props:
`{ question, index, total, initial?, canGoBack?, onBack?, onAnswer }`.
Estado local `choice`. Encabezado igual a InterviewScreen (Wordmark + ProgressDots).
Render por `question.type`:
- `image-grid` → reusa `<ImageGrid options choice onSelect />`.
- `color-grid` → `<ColorGrid options choice onSelect />` (nuevo).
- `gender` → `<GenderChoice options choice onSelect />` (nuevo).
Botones: **Atrás** (si `canGoBack`) y **Siguiente** (deshabilitado hasta elegir). Al tocar
Siguiente: `onAnswer({ rawText: '', imageChoice: choice })`.

**ColorGrid** (`src/components/ColorGrid.tsx`): grilla 3×3 de tiles; cada tile muestra la
rampa `colors` como franjas verticales; check ✓ al seleccionar (mismo lenguaje visual que
ImageGrid).

**GenderChoice** (`src/components/GenderChoice.tsx`): 2 botones grandes lado a lado con
silueta SVG (hombre/mujer) y etiqueta; borde tinta al seleccionar.

Tests: `ProjectiveScreen.test.tsx` (jsdom) — selección por clic habilita Siguiente y
`onAnswer` lleva el `imageChoice`; sin selección, Siguiente deshabilitado. `ColorGrid` y
`GenderChoice` con un test mínimo de selección cada uno.

---

## 6. Página de entrevista (page.tsx)

- `const visible = visibleQuestions(saved)`; `const q = visible[i]`; `total = visible.length`.
- Routea: `q.type === 'open'` → `<InterviewScreen voice=… />`; si no → `<ProjectiveScreen />`.
- `answer()` igual que hoy (POST answer, breatherAfter con `visible.length`, avanza/breather).
  Para proyectivas, `imageChoice` ya viene y `rawText:''`.
- Breathers/cierre sin cambios de lógica (el cierre se dispara en `human === total`).
- "Atrás" decrementa `i` (lista de length constante 20 → estable).

---

## 7. Imágenes (assets)

Script `scripts/fetch-projective-images.sh`: descarga con `curl -L` fotos libres por
keyword (con licencia libre, p. ej. LoremFlickr con `?lock=<n>` para que sea
determinista) a `public/projective/<pregunta>/<id>.jpg`. Cubre animal (9), olor (9),
ciudad (9), edad-hombre (5), edad-mujer (5) = 37 imágenes. Color y género no usan assets.

- Keywords ciudad = nombre de la ciudad; animal/olor = el sustantivo en inglés.
- Edad = retratos genéricos por género (no se busca por década; la etiqueta 20's–60's va
  visible sobre la imagen). **Caveat:** la relevancia de fotos libres por keyword varía;
  el usuario puede reemplazar cualquier archivo. Producción debería curar manualmente.
- Las imágenes se commitean en el repo (`public/` es servido estático; sin config de
  dominios remotos en `next.config.ts`).

Si una descarga falla, el script reporta el faltante (no deja un 0-byte silencioso).

---

## Orden de implementación

1. Navegación manual (InterviewScreen) — aislado.
2. Tipos + guion proyectivo (types.ts, questions.ts) + ImageGrid a `Option`.
3. Flujo dinámico `visibleQuestions` (flow.ts).
4. ColorGrid + GenderChoice + ProjectiveScreen.
5. Cableado en page.tsx (routeo voz/proyectiva + branching).
6. Script de imágenes + descarga + commit de assets.

## Fuera de alcance

- Mejorar los respiros (cadencia/copys) — después.
- "Por qué" en proyectivas — descartado (mouse-only).
- Curaduría fina de imágenes de producción — el usuario reemplaza archivos.
- Fase 2 (limpieza + brief) — su propio plan.
