# Bitácora — mellowbanana-platform

Entradas nuevas arriba. Formato: ver CONVENCION.md.

## 2026-08-10 — MCP mergeado y en producción, con endurecimiento CSRF
- **Hecho:** `fase2-mcp-servidor` mergeado a `main` (fast-forward, 294 tests verdes) y desplegado: migraciones corren en el build (`vercel.json`), tablas OAuth creadas, metadata OAuth y 401 del MCP verificados en producción. La revisión de seguridad del push marcó CSRF en el consentimiento OAuth; no era explotable (cookie con `SameSite=Lax` explícito) pero se agregó la segunda capa: el POST exige `Origin` propio o devuelve 403 (TDD, 17 tests del archivo verdes). Central VALKYRIA: plan pusheado a `NeuralKaizen/mission-control`, el proyecto ya es visible en la plataforma.
- **Quedó:** el flake conocido de pglite bajo carga sigue apareciendo en corridas frías de la suite completa (verde al repetir). Vercel y el package.json ya dicen `mellowbanana-platform`, pero el proyecto Vercel sigue llamándose `forms-melo-banana` (el dominio no cambia).
- **Sigue:** restos del spec de fase 2 (PV post-taller versionada, catálogo del archivo) o directo al spec de fase 3 — a decidir en la próxima sesión.

## 2026-08-10 — Etapas reales definidas: rumbo a la Fase 3 (pipeline de estrategia)
- **Hecho:** plan maestro real en mission-control. Etapa 1 (entrevista + entregable pre-taller) cerrada; etapa 2 (landscape + columna vertebral) casi cerrada — falta mergear `fase2-mcp-servidor`, los restos del spec (PV post-taller versionada, catálogo del archivo) y la adopción real; etapa 3 = pipeline de estrategia sobre `docs/fase3/Procesos Estrategia y Naming.pdf` (bloques 0–5); etapa 4 (naming/copies) con alcance por confirmar.
- **Quedó:** ningún código tocado; el servidor MCP sigue sin mergear.
- **Sigue:** mergear el MCP a `main` y arrancar el spec de fase 3 (mapear los bloques del proceso a la regla produce/consume contexto).

## 2026-08-10 — Proyecto incorporado a la convención VALKYRIA
- **Hecho:** estructura `valkyria/` creada con `/mission init`. Rename completo: repo GitHub `forms-melo-banana` → `mellowbanana-platform`, directorio local `~/Lucianos/mellowbanana-platform`, remote `origin` y `name` de package.json actualizados.
- **Quedó:** plan maestro en etapa 0 (arranque).
- **Sigue:** definir las etapas reales del proyecto en su `plan.md`.
