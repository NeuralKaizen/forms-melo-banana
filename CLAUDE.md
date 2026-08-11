# mellowbanana-platform

Plataforma para el estudio Mellow & Banana: entrevista proyectiva por voz (reemplaza el Google Form de brief de marca) + columna vertebral de contexto (`projects`) que Claude consume vía servidor MCP. Stack: Next.js 16 + React 19 + Tailwind v4 + Drizzle/Neon + mcp-handler. Correr: `npm run dev`. Testear: `npm test` (Vitest + pglite). Schema a Neon: `npm run db:push`.

## Bloque VALKYRIA — convención de trabajo

Este repo sigue la convención VALKYRIA (`~/VALKYRIA/mission-control/docs/convencion/CONVENCION.md`):

- **El estado del proyecto vive en** `~/VALKYRIA/mission-control/mellowbanana-platform/plan.md` — el avance se marca ahí, nunca en este repo.
- **Lo técnico vive en `valkyria/`**: bitácora de sesiones (`BITACORA.md`), decisiones (`DECISIONES.md`), specs y planes por feature (`specs/`, `plans/`). `INDEX.md` es el mapa: prohibido crear documentos de trabajo fuera de la taxonomía sin registrarlos ahí.
- **Ubicación de specs y planes** (sobreescribe el default de las skills superpowers): specs en `valkyria/specs/`, planes en `valkyria/plans/`.
- **Cierre de sesión obligatorio**: checkbox marcado en el plan de mission-control (commit `track(mellowbanana-platform): ✓ …`) + entrada nueva al inicio de `valkyria/BITACORA.md` (commit acá). Lo que no se commiteó, no pasó.
