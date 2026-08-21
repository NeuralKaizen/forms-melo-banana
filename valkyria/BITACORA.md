# Bitácora — mellowbanana-platform

Entradas nuevas arriba. Formato: ver CONVENCION.md.

## 2026-08-21 — Feedback del estudio: entrevistas en el proyecto correcto, movimiento que persiste, aviso por correo

- **Hecho:** los tres puntos del feedback del estudio sobre entrevistas, en `main` (485 tests).
  - **El movimiento ya no se deshace (el bug real).** `/api/sessions/[id]/complete` re-corría la
    auto-asignación por empresa en *cada* disparo: si el entrevistado volvía al link y terminaba
    de nuevo, la entrevista volvía sola al proyecto del que el equipo la había movido. Ahora la
    empresa tipeada asigna **solo cuando la sesión no tiene proyecto**, y `completeSession` es
    idempotente (`WHERE status != 'completed'` + `returning`): repetir el cierre no pisa
    `completedAt`, no re-asigna y no re-avisa. De paso, `assignSessionToProject` deja de fallar
    en silencio (404 si no existen la sesión o el proyecto, con test de que el PATCH lo traduce)
    y el `location.reload()` del panel solo corre si el servidor confirmó la escritura.
  - **Link de entrevista por proyecto.** La causa de "cae en el proyecto equivocado" era que el
    proyecto salía del texto libre que tipea el entrevistado como empresa ("Acme" ≠ "Acme S.A.S."
    → proyecto duplicado). Ahora cada proyecto tiene botón **"Copiar link de entrevista"**
    (`/?p=<projectId>`) en su pantalla de entrevistas: la sesión que arranca desde ahí nace ya
    asignada y la empresa tipeada deja de decidir. Un link roto o de proyecto borrado degrada a
    sesión sin proyecto (la entrevista nunca se bloquea) y el flujo viejo sin `?p=` sigue igual.
  - **Aviso por correo al completarse una entrevista.** `src/lib/email/notify.ts`: POST directo a
    la API de Resend (integración del marketplace de Vercel, sin SDK), disparado solo en la
    *primera* completada. `NOTIFY_EMAIL_TO` (acepta varios, separados por coma),
    `NOTIFY_EMAIL_FROM` opcional, link al panel armado con `MCP_PUBLIC_URL`. El correo es efecto,
    no condición: sin config o con Resend caído, la entrevista se completa igual y queda el log.

- **Quedó:**
  - **Provisionar Resend**: `vercel integration add resend` quedó esperando el paso de navegador
    (aceptar términos en el dashboard de Vercel, proyecto `forms-melo-banana`); después de eso,
    setear `NOTIFY_EMAIL_TO` (y `NOTIFY_EMAIL_FROM` si hay dominio verificado). Sin eso el aviso
    simplemente no sale.
  - Las entrevistas viejas mal agrupadas no se re-agrupan solas: se mueven a mano desde el panel
    (que ahora sí persiste).
  - El checkbox en mission-control no se marcó desde esta máquina (`~/VALKYRIA/mission-control`
    no existe acá).
  - **Un flake hermano sigue vivo:** `strategy-store.test.ts › viene de la más nueva a la más
    vieja` falla cuando dos versiones caen en el mismo milisegundo — el desempate por id es un
    uuid aleatorio, que no conserva orden de creación (`listLandscapeVersions` tiene exactamente
    el mismo agujero). Se arregló el caso gemelo de `listLandscapeActivity` (desempate semántico:
    en el empate, la aprobación va arriba del guardado), pero ordenar versiones por creación de
    verdad pide un serial en la tabla, o sea migración: quedó afuera a propósito.

## 2026-08-12/13 — Rediseño completo del panel interno (11 tareas, rama sin mergear)

- **Hecho:** rediseño de punta a punta del panel autenticado, sobre `fase3-pipeline-estrategia`
  (40 commits, 56 archivos, 474 tests). Salió del feedback del usuario: *"los colores, el layout y
  todo se me hace incómodo"* y *"no es intuitivo ni fácil de navegar por el cluster de
  información"*. Spec en `specs/2026-08-12-rediseno-panel-interno-design.md`, plan de 11 tareas en
  `plans/2026-08-12-rediseno-panel-interno.md`, ejecutado con subagentes (implementador + revisor
  por tarea, ronda de arreglos, re-revisión acotada).
  - **Lenguaje visual:** el amarillo de la marca deja de ser adorno y pasa a ser superficie (la
    barra lateral entera). Fuera las tarjetas y las sombras: hairlines `1px solid var(--line)` y
    `1.5px solid var(--ink)` donde una sección pesa. Escala tipográfica real y tokens
    (`--banana --ink --line --aprobado --superficie --error --cuerpo --secundario --rotulo
    --apagado`) en vez de cuatro grises casi iguales.
  - **Navegación:** de **cinco barras apiladas a una**. La barra amarilla tiene tres estados
    (ancha en el listado, riel de iniciales adentro de un proyecto, abierta encima al pasar el
    mouse) y al lado vive el índice: fases como títulos, etapas como renglones, colapso cuando
    una fase pasa de seis. `ProjectHeader` eliminado.
  - **El panel es una sala de revisión, no un editor.** La etapa se rinde como documento editorial
    (rótulo al margen, columna de lectura de 60ch) con la decisión fija al pie. El conflicto
    "aprobada vs lo que Claude escribió después" pasó de un aviso de 12px a ser la pantalla, con
    dos columnas y las dos decisiones.
  - **Vocabulario alineado** con el que usa el equipo: `Grupo`→`Fase`, `GRUPOS_ETAPAS`→`BLOQUES`,
    etapa = paso de una fase.
  - **Decisión del usuario:** "Mantener versión" **persiste**. Reafirmar appendea una versión con
    el contenido aprobado firmada por el equipo; por la regla que el store ya tenía
    (`borradorNuevo = aprobadaMasNueva && masNueva && !masNueva.approvedAt`) el conflicto se
    disuelve solo, **sin migración** y sin borrar lo que Claude escribió.
  - **Suite arreglada:** `makeTestDb()` levantaba una instancia PGlite entera por `beforeEach`.
    Ahora es una por archivo con `TRUNCATE ... RESTART IDENTITY CASCADE` (tablas leídas de
    `pg_tables`, así una tabla nueva queda cubierta sola) más `maxWorkers: 2`. De 170-270s con
    1-15 fallos por corrida, a **~40s y 474/474 estable**.

- **Quedó (deuda con nombre y dirección):**
  - `src/lib/deck/DeckDocument.tsx` conserva el `--ink` viejo (`#1a1510`) y un gris viejo: el PDF
    que descarga el estudio usa colores distintos a los del panel. El plan excluyó `lib/deck`
    explícitamente; son dos líneas.
  - `DeliverableDocument` y `DeliverablePanel` perdieron `shadow-sm` pero conservan
    `rounded-2xl` + borde + fondo blanco: siguen leyendo como tarjeta.
  - La ratificación se lee en la actividad como "guardó" + "aprobó", indistinguible de una
    escritura común. Pagable sin migrar con `author === 'humano'` + `versionDeOrigen(v) !== null`,
    que discrimina fuerte porque el MCP fuerza `author: 'claude'`.
  - `tienePostTaller` sigue hardcodeada en `false` (heredado): la fase Taller nunca se completa.
  - `estabilizar` quedó exportada en `store.ts` sin consumidor externo.

- **Lecciones que valen para la próxima ejecución:**
  - **Un test que protege el diseño viejo no es cobertura que haya que preservar.** Dar a la vez
    "no rompas los tests existentes" y "sacá la caja `bg-[#faf7ee]`" fue una instrucción
    contradictoria; el test afirmaba sobre la clase CSS que la tarea venía a retirar. Reescribirlo
    para medir semántica lo dejó **más fuerte**, no más débil.
  - **Verificaciones que mienten.** Aparecieron tres: `-t "tipograf"` nunca matcheaba el test real
    (el título lleva tilde) y devolvía 474 skipped con cara de PASS; el canario visual usaba lista
    blanca y no miraba `PhaseNote.tsx`, que tenía restos; y `poolOptions` en vitest 4 no se aplica.
    Moraleja: pedir siempre que se **pruebe que el test falla** cuando el defecto está presente.
  - **Tres corridas limpias no son prueba de un flake dependiente de carga.** Di por bueno un
    arreglo que sólo había movido el fallo del hook al cuerpo del test. Un implementador se negó
    a aceptar mi premisa y lo demostró corriendo aislados los archivos rojos.
  - **Partir las tareas grandes en varios commits salva trabajo:** dos sesiones se cortaron a
    mitad y lo commiteado sobrevivió.

- **Sigue:** revisión final de rama (en curso) → verificación manual del usuario en el navegador
  (checklist al final del plan: el clic sobre el botón `»` de la barra, que la entrevista pública
  no haya cambiado de aspecto, el layout de tres zonas, y móvil) → merge a `main`.

## 2026-08-11 — Fase 3 implementada + rediseño de la navegación (rama sin mergear)
- **Hecho:** pipeline de estrategia completo en `fase3-pipeline-estrategia` (14 etapas versionadas, MCP, panel, instrucciones — 10 tareas con revisión por subagentes + revisión final de rama). Tras el feedback de UX: cabecera por 3 grupos ("Entrevistas / Propuesta de valor" con tabs · Landscape · Estrategia), fase Entrega eliminada (era un cascarón), carril de estrategia agrupado desplegable con siguiente/anterior, y `pantallaActual` para que el punto de entrada al proyecto siga el avance fino. Migración 0003 ya aplicada a Neon; demo sembrada en Cafe Lunar.
- **Quedó:** rama sin mergear a la espera del visto bueno del usuario en el dev server (puerto 3001; el 3000 lo tomó otro proyecto). Minors aparcados con fallo en las revisiones (tablist sobre links, N+1 aceptado, `tienePostTaller` sigue hardcodeada false, breadcrumb con 14 fijo vs no_aplica).
- **Sigue:** recorrido del usuario → merge a main (deploy corre la migración, ya idempotente) → marcar checkboxes de etapa 3 en mission-control → adopción real del equipo.

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
