# Decisiones — mellowbanana-platform

Entradas nuevas arriba. Formato: ver CONVENCION.md. Solo decisiones no triviales: si fue obvio o es fácilmente reversible, no va acá.

## 2026-08-21 — El proyecto abre con el trabajo, no con la estructura

**Qué:** la portada del proyecto (`/admin/projects/[id]`) es la mesa de trabajo: decisiones pendientes con link directo, actividad reciente, y el recorrido plegado en tres tarjetas de fase. Ya no redirige a la etapa actual.

**Por qué:** en este flujo Claude escribe por MCP y el equipo decide: la pregunta al entrar no es "¿cómo navego 23 etapas?" sino "¿qué me toca?". El feedback del estudio ("cluster de información, difícil de navegar") pedía menos menú, no otro dibujo del mismo menú. Todas las señales ya existían (`esperanDecision`, `attentionItems`, actividad por versiones): la mesa las asciende de widget a portada.

**Qué se descartó:** las otras dos alternativas presentadas — fases como pestañas (B, sigue disponible como evolución del chrome de etapas) y dos intentos de línea/mapa del recorrido, que o no eran navegables (puntos sin nombre) o convergían con B. También se descartó quitar ya el índice lateral de las pantallas de etapa: la mesa entra como puerta sin romper el hábito, y el chrome de etapas se decide después con el estudio.

## 2026-08-21 — La empresa tipeada nunca pisa un proyecto ya asignado; el link manda

**Qué:** una sesión con `projectId` (por link `/?p=` o movida a mano desde el panel) conserva ese proyecto para siempre: la auto-asignación por nombre de empresa corre solo sobre sesiones sin proyecto, y el cierre de entrevista es idempotente (solo la primera completada tiene efectos: asignar, avisar por correo).

**Por qué:** el proyecto salía de texto libre del entrevistado, y el cierre re-asignaba en cada disparo — cualquier re-entrada al link deshacía el movimiento manual del equipo. La fuente de verdad correcta es la intención del estudio (el link que mandó, o a dónde movió la entrevista), no la ortografía del entrevistado.

**Qué se descartó:** matching difuso de nombres de empresa contra proyectos existentes (mágico y con falsos positivos entre marcas parecidas), y un campo "proyecto" visible en el formulario del entrevistado (el entrevistado no tiene por qué conocer la taxonomía interna del estudio). También un flag "asignada a mano" en la fila: con la regla "solo asignar cuando no hay proyecto" alcanza y no hay migración.

## 2026-08-10 — CSRF del consentimiento OAuth: verificación de Origin, no token sincronizador

**Qué:** el POST de `/api/oauth/authorize` rechaza con 403 cualquier pedido cuyo header `Origin` falte o no coincida en host con la URL propia. Se comparan hosts y no origins completos porque detrás del proxy de Vercel el protocolo de `req.url` no es de fiar.

**Por qué:** la revisión de seguridad del push marcó que emitir el código de autorización dependía de una sola defensa (la cookie `admin` con `SameSite=Lax`). Lax explícito ya bloquea el POST cross-site en navegadores modernos —el hallazgo no era explotable hoy—, pero el endpoint expone datos de marcas de terceros y la BCP de OAuth pide que el consentimiento se defienda solo. Los navegadores mandan `Origin` siempre en los POST, y este endpoint solo lo consume el formulario de consentimiento propio: exigirlo no rompe ningún cliente legítimo.

**Qué se descartó:** el token CSRF sincronizador (hidden field + cookie firmada) — más estado y más código para el mismo efecto en este flujo, donde no hay subdominios ni contenido de terceros en el origen propio. El orden de chequeos quedó: sesión (401) antes que Origin (403), para no cambiar el contrato existente del endpoint.
