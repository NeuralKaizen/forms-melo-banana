# Mellow & Banana — Entrevista Proyectiva Conversacional

**Fecha:** 2026-06-10
**Estado:** Diseño aprobado — listo para plan de implementación

---

## 1. Problema

Mellow & Banana usa hoy un Google Form de 6 páginas ("Entrevista Proyectiva") para levantar el brief de marca de cada cliente. El problema: los clientes responden bien las primeras páginas, pero **aflojan al final** y dejan respuestas pobres o para salir del paso (en las respuestas reales se ven campos con solo `"a"`). Un brief incompleto cuesta caro en retrabajo posterior.

## 2. Solución

Una **web app de entrevista guiada por voz**: un agente con **voz premium pre-grabada** (ElevenLabs) hace cada pregunta; el cliente responde hablando (o escribiendo); la pregunta siempre está en pantalla. La experiencia se siente como una conversación cálida y cuidada, muy por encima de un Google Form. Al terminar, se genera un **brief estructurado** por cliente que el equipo lee en un panel interno.

> **Nota de alcance:** se descartó el "follow-up inteligente" (repreguntar con IA ante respuestas flojas) y cualquier empujón anti-"a". El flujo es sin fricción: suena la pregunta → el cliente responde → siguiente. La mejora sobre Forms viene de la experiencia y la voz, no de un agente que insiste.

## 3. Objetivos y no-objetivos

**Objetivos**
- Reemplazar el Google Form actual cubriendo sus 6 secciones.
- Experiencia voice-first premium: el agente **habla** con voz humana (ElevenLabs pre-grabada); el cliente responde por voz o texto. Pregunta siempre en display.
- Sin fricción: el cliente responde y avanza; no hay repreguntas ni validaciones que traben.
- Brief auto-generado + respuestas crudas, visibles en un panel para el equipo.
- **Costo casi nulo:** sin LLM en vivo durante la entrevista; voz generada una sola vez (ver §12).

**No-objetivos**
- Follow-up / repregunta inteligente con IA. **Descartado.**
- Empujón anti-respuesta-corta. **Descartado.**
- LLM en tiempo real durante la charla (solo se usa Claude al final, para el brief).
- Login real para clientes (link público + identificación al inicio).
- Link único por cliente (upgrade futuro).
- App nativa / móvil empaquetada.

## 4. Decisiones tomadas

- **Producto real, deployable** (no prototipo descartable).
- **Voz del agente:** **ElevenLabs**, **pre-generada una sola vez** desde el guión y reproducida como audio en cada entrevista. Voz humana en español.
- **Respuesta del cliente:** voz (STT del navegador, gratis) **o** texto. Input de texto siempre disponible como fallback (clave en Safari/iOS, donde el STT del navegador es flojo).
- **Sin follow-up ni nudge:** flujo lineal sin fricción.
- **Salida:** brief estructurado por cliente + respuestas crudas, en un panel interno. Único uso de Claude (una llamada por entrevista, al finalizar).
- **Ejercicio proyectivo (ex página 6):** híbrido — pregunta en display + audio; aparece una **grilla curada seleccionable**; el cliente toca una y explica por voz/texto.
- **Acceso:** link público; se pide nombre/empresa/email al inicio.
- **Base de datos:** **Neon (Postgres serverless)** + **Drizzle** (ORM TypeScript). Free tier, escala a cero, se reactiva solo. Se eligió sobre Supabase (que pausa proyectos free tras 7 días de inactividad y trae auth/storage/realtime que no usamos).
- **Assets:** imágenes del ejercicio proyectivo y audios pre-generados van en **`/public`** (estáticos). Sin object storage.

## 5. Lengua visual (cerrada)

"Blanco Apple + tinte crema":
- Fondo blanco-banana cálido (`#fffdf2`), mucho aire, tipografía limpia (Inter), pregunta centrada.
- Color de marca vía un **subrayado banana grueso** (`#ffd400`) bajo la idea clave de cada pregunta.
- **Botón de micrófono = control explícito del usuario.** Quieto: círculo oscuro (`#1a1510`) con ícono de mic amarillo. Tu turno: se llena de amarillo con un anillo suave que late.
- **Pill de estado** arriba: "Banana está hablando" (reproduciendo audio) / "Te escucho…".
- **Movimiento mínimo y localizado** (solo el anillo del mic). Nada de fondos animados que mareen ni texturas pesadas.

Mockups de referencia en `.superpowers/brainstorm/` (no versionados): `merged.html` (pantalla principal, 2 estados), `proyectiva.html` (pregunta con grilla), `apple-banana.html` (variantes de color).

## 6. Arquitectura

Next.js (App Router, TypeScript) en Vercel. Tailwind para estilos. Neon + Drizzle para datos. Claude (Anthropic API) **solo** para generar el brief al final. Imágenes y audios estáticos en `/public`.

Componentes aislados, cada uno con un propósito claro:

1. **Guión (`script`, config en código)** — las preguntas de las 6 secciones; cada una con `id`, `section`, `prompt`, `type` (`open` | `image-grid`), opciones de imagen si aplica, y la ruta a su audio pre-generado.
2. **Generador de audio (`tts-build`, build-time)** — script que recorre el guión, llama a ElevenLabs **una vez**, y guarda los `.mp3` en `/public/audio`. No corre en runtime; se ejecuta al cambiar el guión.
3. **Reproductor + captura de voz (`voice`, cliente)** — reproduce el audio de la pregunta actual y captura la respuesta del cliente: STT del navegador (Web Speech API) con fallback a texto. Interfaz simple `play(audioUrl)` / `listen(): Promise<text>`.
4. **UI de entrevista (`interview-ui`, cliente)** — pantalla de pregunta con sus dos estados de mic, grilla proyectiva, captura de identidad inicial, barra de progreso. Implementa la lengua visual de §5. Flujo lineal: identidad → secciones → fin.
5. **Persistencia (`store`, server + Drizzle/Neon)** — sesiones, respuestas, brief.
6. **Generador de brief (`brief-generator`, server)** — al completar, una llamada a Claude resume todas las respuestas en un brief estructurado por sección.
7. **Panel interno (`admin`, server + cliente)** — lista de entrevistas completadas; ver brief + crudo. Auth simple (password compartido por env var).

### Interfaces clave
- `voice.play(audioUrl): Promise<void>`, `voice.listen(): Promise<string>`, `voice.isSTTSupported(): boolean`
- `store.saveAnswer(sessionId, questionId, { rawText, imageChoice? })`
- `store.getSession(id)` / `store.completeSession(id)`
- `brief-generator.generate(sessionId) -> Brief`

## 7. Guión de preguntas (config en código)

Refleja el form actual, en secciones:
1. **Identidad** — nombre, empresa, cargo, email.
2. **Contexto del proyecto** (~10) — descripción, historia, productos/servicios, por qué evolucionar la marca ahora, qué pasa si no se hace nada, estrategia detrás del brief, competencia, KPIs, competidores.
3. **Contexto del consumidor** (~6) — problema clave, target, qué piensan de la marca, relación/uso actual, cambio buscado.
4. **Contexto de diseño** (~3) — objetivos del diseño, dónde vivirá, cómo encaja en el marketing mix.
5. **Ejercicio proyectivo** (imágenes) — si la marca fuera animal/color/género/edad/planta/lugar/ciudad: elegir de grilla curada + explicar por qué.

## 8. Modelo de datos (Neon / Postgres, vía Drizzle)

- **`sessions`** — `id`, `name`, `company`, `role`, `email`, `status` (`in_progress`|`completed`), `created_at`, `completed_at`.
- **`answers`** — `id`, `session_id`, `question_id`, `raw_text`, `image_choice` (nullable), `created_at`.
- **`briefs`** — `session_id`, `content` (jsonb), `created_at`.
- Las **preguntas NO van en DB** (config en código, versionable).

## 9. Flujo de la entrevista

1. El cliente entra por link público → da nombre/empresa/email (voz o texto). Se crea la `session`.
2. Por cada pregunta: la UI la muestra y **reproduce su audio** pre-grabado → el cliente responde por voz (STT) o texto → se guarda la `answer` → siguiente. Sin repreguntas.
3. Para preguntas de imagen: se muestra la grilla, el cliente toca una y explica.
4. Al terminar, se marca la sesión `completed` y se dispara `brief-generator.generate`.
5. El equipo entra al panel, ve el brief y las respuestas crudas.

## 10. Manejo de errores

- **Navegador sin STT (ej. Safari) / sin permiso de micrófono** → el cliente usa el input de texto (siempre visible). No rompe.
- **Falla al cargar/reproducir audio** → la pregunta ya está en pantalla en texto; se continúa sin audio.
- **Falla de Claude al generar el brief** → la entrevista igual quedó guardada (respuestas crudas intactas); el brief se puede regenerar desde el panel con un botón "Regenerar".
- **Cierre/recarga a mitad** → la sesión se persiste tras cada respuesta y es **retomable** desde la última pregunta.

## 11. Testing

- **Unit:** parsing/validación del guión; `store` (guardar/leer/completar sesión con DB de test); `brief-generator` con respuestas fixture → estructura esperada.
- **`voice`** con una implementación fake para tests de UI (sin depender del navegador real).
- **E2E** del camino feliz en modo texto (sin audio ni STT), recorriendo las secciones hasta el brief.

## 12. Costo

- **Voz (ElevenLabs):** **una sola vez**, ~$0–5 para generar los ~30 audios (entra en el tier más barato un mes; después se cancela). $0 en cada entrevista.
- **STT (respuesta del cliente):** navegador → **$0**.
- **Hosting:** Vercel free + Neon free (escala a cero, se reactiva solo) → **$0** a este volumen.
- **Claude:** solo el brief, ~**$0.05 por entrevista**.
- Estimado ~30 entrevistas/mes → **~$1.50/mes + ~$5 una vez.** Prácticamente gratis.

## 13. Orden de construcción (fases)

- **Fase 1 — Entrevista en texto:** guión + UI + persistencia (Neon/Drizzle) + identidad + grilla proyectiva. El producto ya funciona end-to-end y se puede validar.
- **Fase 2 — Voz:** `tts-build` (generar audios con ElevenLabs) + reproducción + STT del navegador para las respuestas, con fallback a texto.
- **Fase 3 — Brief + panel interno:** generador de brief (Claude) y vista del equipo con auth simple.

## 14. Upgrades futuros (fuera de alcance)

- Link único por cliente.
- Export del brief a Google Sheets para el equipo.
- STT premium (Whisper) si el del navegador queda corto.
- Login real / retomar entre dispositivos.
