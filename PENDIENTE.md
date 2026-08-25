# Pendiente — feedback de entrevistas (2026-08-21)

Estado de los tres puntos del feedback del estudio y qué falta para cerrarlos.
Detalle completo de lo hecho: `valkyria/BITACORA.md` (entrada 2026-08-21).

## Lo que ya está (commiteado en `main`, 485/485 tests)

- **Mover una entrevista de proyecto persiste.** El cierre de entrevista es idempotente:
  re-completar ya no re-asigna por empresa ni pisa el movimiento manual. El "mover a…" del
  panel avisa si falla (antes recargaba mostrando la lista vieja como si hubiera funcionado).
- **Link de entrevista por proyecto.** Botón **"Copiar link de entrevista"** en la pantalla
  de entrevistas de cada proyecto (`/?p=<projectId>`): la sesión que arranca desde ese link
  nace ya asignada al proyecto, sin depender de cómo tipeen la empresa. El flujo viejo sin
  `?p=` sigue funcionando (asigna por empresa, solo si la sesión no tiene proyecto).
- **Aviso por correo, del lado del código.** `src/lib/email/notify.ts` manda el correo vía
  Resend en la *primera* completada (nombre, empresa, proyecto, link al panel). Sin
  configuración, no-op: la entrevista se completa igual.
- El repo quedó linkeado al proyecto de Vercel **`forms-melo-banana`** (`.vercel/`, local).

## Lo que falta

### 1. Activar Resend (siguiente sesión)

1. Aceptar términos en el navegador (cuenta Vercel `neuralkaizen`):
   <https://vercel.com/neuralkaizens-projects/~/integrations/accept-terms/resend?source=cli>
2. `npx vercel integration add resend` — inyecta `RESEND_API_KEY` en el proyecto sola.
3. En Vercel (Settings → Environment Variables) agregar:
   - `NOTIFY_EMAIL_TO` — a quién avisar; acepta varios separados por coma.
   - `NOTIFY_EMAIL_FROM` — opcional; requiere dominio verificado en Resend. Sin él, el
     default `onboarding@resend.dev` **solo entrega al dueño de la cuenta de Resend** —
     para que le llegue al estudio hay que verificar un dominio y setear esta variable.
4. Verificar `MCP_PUBLIC_URL` en Vercel (arma el link "Leerla" del correo).
5. Probar punta a punta: completar una entrevista de prueba y ver que llegue.

### 2. Deploy y cierre de convención

- `git push` (los 5 commits están solo locales) y verificar el deploy en Vercel.
- Marcar el checkbox en mission-control (`track(mellowbanana-platform): ✓ …`) — no se pudo
  desde esta máquina: `~/VALKYRIA/mission-control` no existe acá.

### 3. Limpieza de datos (a mano, cuando quieran)

- Las entrevistas viejas que cayeron en proyectos duplicados ("Acme" vs "Acme S.A.S.") no se
  re-agrupan solas: moverlas desde el panel (ahora sí persiste) y borrar los proyectos
  vacíos con `npm run db:rm-project`.
- Avisarle al estudio que de ahora en más manden el link copiado desde el proyecto, no la
  URL pelada.

### 4. Navegación: revisar las opciones de diseño con Mellow & Banana

Pendiente a propósito (2026-08-25): las tres opciones de layout están guardadas en
**`valkyria/propuestas/2026-08-22-navegacion-proyectos/`** (página autocontenida que se
abre con doble clic + README con el estado real y el follow-up). La C —mesa de trabajo—
ya está en producción como portada; A sigue en las pantallas de etapa; B no se aplicó.
Queda: **revisarlo con Mellow** usando esa carpeta, decidir el chrome de las etapas
(A / A aligerada / B) y recién ahí implementar. Sin cambios nuevos hasta esa decisión.

### 5. Exportación a PowerPoint del entregable

El entregable ya se edita adentro de la plataforma (botón "Editar" por sección en
Propuesta de valor) — ese contenido editado es el insumo. Falta: **el usuario pasa la
plantilla de PowerPoint** del estudio, y con ella se construye la exportación. A propósito
no se adelantó nada del pipeline de PPT sin la plantilla real.

### 6. Deuda técnica anotada (no urgente)

- Flake pre-existente: `strategy-store.test.ts › viene de la más nueva a la más vieja`
  falla si dos versiones caen en el mismo milisegundo (el desempate por uuid no conserva
  orden de creación; `listLandscapeVersions` tiene el mismo agujero). Arreglarlo de verdad
  pide un serial en la tabla → migración. Ver bitácora 2026-08-21.
