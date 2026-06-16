# Normalización de transcripciones por IA

**Fecha:** 2026-06-16
**Estado:** Aprobado, listo para plan de implementación

## Problema

El input del cliente entra por voz (Web Speech API STT) o texto. Las
transcripciones de voz llegan sin puntuación, con mayúsculas erráticas y con
errores ocasionales de reconocimiento (homófonos, palabras mal separadas). Eso
hace que el equipo de Mellow & Banana lea respuestas difíciles de procesar
cuando arma el brief.

Queremos una capa de normalización que limpie el texto **sin alterar el
contenido real** — solo puntuación, mayúsculas y corrección de errores obvios de
transcripción.

## Alcance y decisiones

- **Audiencia:** el texto normalizado es **interno**. El cliente nunca lo ve;
  solo lo ve el equipo de Mellow & Banana en el panel `/admin` y en el PDF.
- **Cuándo:** perezoso (lazy). Se genera la primera vez que el equipo abre la
  sesión en `/admin`, el brief, o exporta el PDF. Nunca corre durante la
  entrevista → el flujo del cliente sigue 100% sin fricción.
- **Modelo:** `google/gemini-2.5-flash-lite` vía OpenRouter (endpoint
  OpenAI-compatible `/chat/completions`).
- **Almacenamiento:** nueva columna `normalized_text` en `answers`. `raw_text`
  queda **intacto** (auditable, aunque no se muestre).
- **Visualización:** el panel `/admin` y el PDF muestran **solo** el texto
  normalizado (con fallback a `raw_text` si todavía no se normalizó). El brief de
  IA también se alimenta del texto normalizado.

## No-objetivos (YAGNI)

- No normalizar en tiempo real por respuesta.
- No mostrar crudo y normalizado lado a lado en el panel.
- No editar manualmente el texto normalizado desde el panel.
- No reintentos sofisticados ni colas: si falla, se cae al texto crudo.

## Modelo de datos

`answers` gana una columna:

```ts
normalizedText: text('normalized_text')  // nullable
```

`raw_text` no se toca. Migración con `npm run db:push`.

## Unidades

### 1. Normalizador — `src/lib/normalize/normalizer.ts`

```ts
export async function normalizeText(
  text: string,
  opts?: { fetchImpl?: typeof fetch },
): Promise<string>
```

- Si `text` está vacío, es solo whitespace, o es el placeholder `—` → devuelve el
  texto tal cual, **sin** llamar al modelo.
- Si falta `OPENROUTER_API_KEY` → devuelve el texto original (best-effort).
- Llama a `https://openrouter.ai/api/v1/chat/completions` con:
  - `model: 'google/gemini-2.5-flash-lite'`
  - `temperature: 0`
  - header `Authorization: Bearer ${OPENROUTER_API_KEY}` + `X-Title: Melo & Banana`
  - system prompt estricto (ver abajo)
- Si la llamada falla (red, status no-2xx, body inesperado) → captura y devuelve
  el texto original. **Nunca lanza.**
- `fetchImpl` se inyecta para testear (default: `globalThis.fetch`).

**System prompt:**

> Recibís una transcripción de voz a texto en español. Tu única tarea es hacerla
> más legible: agregá puntuación y mayúsculas correctas, y corregí errores
> obvios de transcripción (homófonos, palabras mal separadas o pegadas). NO
> cambies el significado, NO agregues ni quites información, NO reformules ni
> resumas, NO traduzcas. Si el texto ya está bien, devolvelo igual. Devolvé
> SOLO el texto corregido, sin comillas ni comentarios.

### 2. Servicio — `src/lib/normalize/service.ts`

```ts
export async function ensureNormalized(db, sessionId): Promise<Answer[]>
```

- Carga las respuestas de la sesión.
- Para cada una con `rawText` no vacío y `normalizedText` null: llama a
  `normalizeText` y persiste con el helper de store `setNormalized`.
- Idempotente: saltea las que ya tienen `normalizedText`.
- Devuelve las respuestas con `normalizedText` poblado (para que el consumidor
  no tenga que recargar).

### 3. Store — `src/lib/db/store.ts`

Nuevo helper:

```ts
export async function setNormalized(db, answerId, text): Promise<void>
```

`getSessionWithAnswers` ya devuelve la fila completa, así que incluirá
`normalizedText` automáticamente al agregar la columna.

## Cableado

Todos los consumidores leen `normalizedText ?? rawText`:

- **Ruta PDF** (`api/sessions/[id]/pdf/route.ts`): `await ensureNormalized(db, id)`
  antes de `buildBriefView`; `buildBriefView` usa `normalizedText ?? rawText`.
- **Servicio de brief** (`lib/brief/service.ts`): `await ensureNormalized(db, id)`
  y pasa el texto normalizado a `buildBriefPrompt`.
- **Panel admin** (`app/admin/[sessionId]/page.tsx`): `await ensureNormalized(db,
  sessionId)`; renderiza `normalizedText ?? rawText`; el título de sección pasa
  de "Respuestas crudas" a "Respuestas".

## Resiliencia

La normalización es **best-effort y nunca bloquea**. Sin `OPENROUTER_API_KEY` o
ante cualquier error, PDF/brief/admin siguen funcionando sobre el texto crudo —
exactamente el comportamiento actual. Esto preserva que el PDF hoy no requiere
ninguna key.

## Costo

Perezoso → la primera apertura de una sesión en admin/brief/PDF dispara ~20
llamadas mínimas (una por respuesta) a precio Flash Lite (centavos por
entrevista). Las aperturas siguientes reusan `normalized_text` ya guardado, costo
cero.

## Tests (TDD)

- **normalizer** (`fetchImpl` falso):
  - construye el request correcto (modelo, temperatura, auth, prompt).
  - vacío / whitespace / `—` → devuelve igual sin llamar al fetch.
  - sin `OPENROUTER_API_KEY` → devuelve crudo sin llamar.
  - status no-2xx o body roto → devuelve crudo (no lanza).
- **service** (pglite testdb):
  - rellena `normalized_text` en respuestas pendientes.
  - idempotente: no re-normaliza las ya hechas.
  - saltea placeholders/vacíos.
- **buildBriefView** y **buildBriefPrompt**: prefieren `normalizedText` sobre
  `rawText` cuando está presente.
