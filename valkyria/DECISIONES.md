# Decisiones — mellowbanana-platform

Entradas nuevas arriba. Formato: ver CONVENCION.md. Solo decisiones no triviales: si fue obvio o es fácilmente reversible, no va acá.

## 2026-08-10 — CSRF del consentimiento OAuth: verificación de Origin, no token sincronizador

**Qué:** el POST de `/api/oauth/authorize` rechaza con 403 cualquier pedido cuyo header `Origin` falte o no coincida en host con la URL propia. Se comparan hosts y no origins completos porque detrás del proxy de Vercel el protocolo de `req.url` no es de fiar.

**Por qué:** la revisión de seguridad del push marcó que emitir el código de autorización dependía de una sola defensa (la cookie `admin` con `SameSite=Lax`). Lax explícito ya bloquea el POST cross-site en navegadores modernos —el hallazgo no era explotable hoy—, pero el endpoint expone datos de marcas de terceros y la BCP de OAuth pide que el consentimiento se defienda solo. Los navegadores mandan `Origin` siempre en los POST, y este endpoint solo lo consume el formulario de consentimiento propio: exigirlo no rompe ningún cliente legítimo.

**Qué se descartó:** el token CSRF sincronizador (hidden field + cookie firmada) — más estado y más código para el mismo efecto en este flujo, donde no hay subdominios ni contenido de terceros en el origen propio. El orden de chequeos quedó: sesión (401) antes que Origin (403), para no cambiar el contrato existente del endpoint.
