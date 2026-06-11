# Diseño — Voz del usuario, proceso posterior y guion reducido

**Fecha:** 2026-06-11
**Estado:** aprobado (pendiente revisión final del usuario)

## Objetivo

Que la experiencia de la entrevista gire en torno a la voz del usuario: que pueda
hablar con naturalidad y quede bien capturado. La voz del **agente** (TTS) queda
fuera de la demo. El "proceso posterior" (limpieza de transcripción + brief con IA)
es fase 2. Además, reducir el guion de 19 a 15 preguntas fusionando preguntas cercanas.

## Decisiones cerradas

- **Modelo de interacción:** pantalla voice-first, una pregunta a la vez.
- **Micrófono toggle:** un toque abre, otro cierra (no push-to-talk).
- **Estilo del micro:** squircle. Reposo = crema con borde de tinta grueso
  (`inset 0 0 0 2.5px #2b2620` sobre `#fdf6e9`); escuchando = relleno banana (`#e9b949`).
- **Transcripción en vivo:** el texto parcial aparece mientras el usuario habla.
- **Al cortar:** *default avanza solo* a la siguiente pregunta; **atrás** y **regrabar**
  siempre disponibles como red de seguridad.
- **Sin voz del agente** en la demo (la pregunta se lee en pantalla).
- **STT para la demo:** Web Speech API (`webkitSpeechRecognition`). Anda en Chrome,
  Edge y Safari (incl. iPhone); Firefox degrada a teclado. El motor robusto
  (ElevenLabs Scribe / Whisper / streaming) se elige en producción —
  por eso se mantiene **detrás del seam `VoiceAdapter`** para swap sin tocar la UI.

---

## Fase 1 — Voz del usuario (foco)

### `VoiceAdapter` (`src/lib/voice/types.ts`)

Pasar de "una promesa que resuelve con la frase final" a un modelo **start/stop con
parciales**, manteniendo la capacidad de degradar:

```ts
export interface VoiceAdapter {
  /** Empieza a escuchar; llama onPartial con el texto acumulado en vivo. */
  start(onPartial: (text: string) => void): void
  /** Corta y devuelve el texto final acumulado. */
  stop(): Promise<string>
  /** STT disponible en este entorno; si no, la UI degrada a teclado. */
  isSTTSupported(): boolean
}
```

(Se elimina `play(audioUrl)` del uso actual ya que no hay voz del agente en la demo;
puede quedar opcional en la interfaz para no romper el adapter, pero la UI no lo invoca.)

### `BrowserVoice` (`src/lib/voice/browser-voice.ts`)

- `interimResults: true`, `continuous: true`, `lang: 'es-ES'`.
- **Acumular tramos finales:** Web Speech corta en silencios; mantener un buffer
  `finalText` con los resultados `isFinal` y concatenar el parcial vigente para
  `onPartial`. Así una respuesta larga con pausas no se pierde.
- `start(onPartial)` arranca el reconocimiento y emite `finalText + parcial`.
- `stop()` detiene y resuelve con `finalText` acumulado.
- Sigue implementando `VoiceAdapter` — `ElevenLabsScribeVoice`/streaming entran por acá luego.

### `InterviewScreen` (`src/components/InterviewScreen.tsx`)

- Micro **toggle**: 1er toque → `voice.start`, el parcial se muestra en la caja de
  texto (editable); 2do toque → `voice.stop()`, guarda la respuesta y **avanza solo**.
- Estado `listening` controla el estilo del squircle (borde tinta ↔ relleno banana).
- **Atrás** y **Regrabar** visibles: "regrabar" limpia el texto y vuelve a `start`;
  "atrás" navega a la pregunta anterior (ya existe `onBack`).
- Si `!isSTTSupported()` (Firefox), se oculta el micro y queda solo el teclado.
- El texto sigue siendo editable a mano en todo momento (corrige errores de STT).

### `MicButton` (`src/components/MicButton.tsx`)

- Restyle a squircle con dos estados (`active`): reposo borde-tinta sobre crema,
  activo relleno banana. Sin perder accesibilidad (área de toque ≥ 44px).

---

## Fase 2 — Proceso posterior (después; requiere `ANTHROPIC_API_KEY`)

### Limpiar transcripción con IA

- Al responder, se guarda `rawText` crudo al instante (no bloquea el auto-advance) —
  igual que hoy vía `saveAnswer`.
- **Nueva columna** `cleaned_text text` (nullable) en la tabla `answers`
  (`src/lib/db/schema.ts`) + migración drizzle (`npm run db:push`).
- Al `completeSession`, una pasada con Anthropic pule cada respuesta (puntuación,
  muletillas, sin cambiar el sentido) y guarda `cleanedText`. Se hace en el flujo de
  completar (junto al brief), no por pregunta, para no agregar latencia entre preguntas.
- El usuario ve/edita el **crudo**; lo pulido es para admin + brief.

### Brief con IA

- `generateAndSaveBrief` / `generateBrief` (`src/lib/brief/*`) pasan a alimentarse de
  `cleanedText` (con fallback a `rawText` si falta). Estructura del brief
  (`resumen` / `secciones` / `alertas`) se mantiene.
- Admin (`src/app/admin/[sessionId]/page.tsx`) muestra el texto pulido, con el crudo disponible.

---

## Guion reducido: 19 → 15 preguntas

Preguntas que se hacen en el flujo de voz (identidad — nombre/empresa/cargo/email —
sigue fuera del flujo). Fusiones aprobadas:

1. **Motivo + urgencia** — `porque_ahora` + `si_nada` →
   *"¿Por qué es importante evolucionar la marca ahora, y qué pasaría si no se hace nada?"*
   (highlight: "evolucionar la marca ahora")
2. **Empresa + historia** — `descripcion` + `historia` (nuevo id `empresa_historia`) →
   *"Contanos brevemente qué es la compañía o proyecto y cuál es su historia."*
   (highlight: "compañía o proyecto")
3. **Percepción + relación del consumidor** — `piensan` + `relacion` + `uso`
   (nuevo id `percepcion`) →
   *"¿Qué piensan hoy los consumidores de la marca y cómo se relacionan con ella o la usan? (si aplica)"*
   (highlight: "piensan hoy")

La fusión de competencia (`competencia_hace` + `competidores`) **no** se aplica.

### Guion resultante (15)

- **Contexto del proyecto (7):** `empresa_historia`, `productos`, `porque_ahora`,
  `estrategia`, `competencia_hace`, `kpis`, `competidores`
- **Contexto del consumidor (4):** `problema`, `target`, `percepcion`, `cambio`
- **Contexto de diseño (3):** `objetivos`, `donde_vive`, `marketing_mix`
- **Ejercicio proyectivo (1):** `animal` (image-grid)

Cambios en `src/lib/script/questions.ts`: editar prompts/ids de los 3 grupos fusionados.
`flow.ts` no cambia (deriva todo de `SCRIPT`). El filtro de identidad en
`interview/[sessionId]/page.tsx` se mantiene.

---

## Respiros e cierre (anti-fatiga)

Pantallas interstitiales a pantalla completa para dar micro-descansos durante las 15
preguntas. Formato: emoji/wordmark + frase cálida (serif) + botón "Seguir →". **Sin**
subtexto tipo "pausa de 3 segundos". No cuentan en el "X de 15" ni en los dots de progreso.

- **Tras la pregunta 7:** *"Vamos por la mitad de camino. Recuerda tomarte el tiempo que necesites."*
- **Tras la pregunta 12:** *"Doce preguntas y contando. Ya casi lo tenemos."*
- **Tras la pregunta 15 (cierre):** mensaje cálido de cierre antes de `/gracias`, p. ej.
  *"¡Eso es todo! Gracias por compartir tu visión con nosotros."* (copy final ajustable).

Copy en español neutro (sin voseo). Implementación: un paso interstitial en el flujo de
`interview/[sessionId]/page.tsx` que se intercala después de los índices 7 y 12 (y el
cierre tras la 15), sin tocar el modelo de datos ni `SCRIPT`.

---

## Orden de implementación

1. Guion reducido (questions.ts) — aislado, sin riesgo.
2. Fase 1 — voz del usuario (types → BrowserVoice → MicButton → InterviewScreen).
3. Fase 2 — limpieza + brief (schema/migración → servicio de limpieza → brief → admin).

## Fuera de alcance

- Voz del agente (TTS) — descartado para la demo.
- STT robusto cross-browser (ElevenLabs Scribe / Whisper / streaming) — diseño futuro,
  entra por el seam `VoiceAdapter`.
- Rediseño del panel admin más allá de mostrar el texto pulido.
