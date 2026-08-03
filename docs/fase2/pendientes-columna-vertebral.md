# Fase 2 · Columna vertebral — qué queda pendiente

Fecha: 2026-07-30 · actualizado 2026-07-31
Rama: `fase2-columna-vertebral` (19 commits sobre `main`), ya en `main` y en producción
Estado: desplegada y funcionando. El panel se recorrió en un navegador el 2026-07-31.

Lo construido es lo que el spec llama la columna vertebral: las seis etapas del
Landscape versionadas en Neon (append-only), el gate humano de tendencias, la
aprobación de etapas, y el panel leyendo y escribiendo estado real en vez de datos
de demostración. Ver `docs/superpowers/plans/2026-07-29-fase2-columna-vertebral.md`.

## 1. Despliegue: hecho, y lo que costó

Las tablas `landscape_stages` y `landscape_versions` **ya existen en Neon** (creadas el
2026-07-31). No hace falta correr nada antes de desplegar.

Se crearon con DDL explícito y no con `db:push`, por lo mismo que este documento
advertía: `drizzle-kit` pide una confirmación interactiva que ningún agente puede
contestar, y puede proponer un rename donde hay un alta. El SQL fue puramente aditivo
—dos `create table if not exists` y un índice— y se verificó después que las cinco
tablas de fase 1 conservaran sus filas (5 proyectos, 16 sesiones, 221 respuestas,
3 entregables).

**Lo que salió mal, para no repetirlo.** El deploy salió antes que las tablas. Como la
cabecera del proyecto consulta el estado del landscape en las ocho pantallas, el admin
entero respondió 500 durante ~10 minutos, no solo `/landscape`
(`NeonDbError 42P01: relation "landscape_stages" does not exist`). El riesgo estaba
escrito acá y el orden se invirtió igual, porque `db:push` depende de que alguien se
acuerde de correrlo a mano. Mientras siga siendo un paso manual va a volver a pasar: la
salida de fondo es tener migraciones versionadas en `drizzle/` aplicadas en el build.
Hoy ese directorio no existe.

Para ver el panel con contenido:

```
npm run db:projects              # lista los proyectos que hay
npm run seed:landscape -- "<nombre del proyecto>"
npm run dev
```

## 2. Decisiones abiertas, para vos

### La edad de las entrevistas viejas no sale en el PDF

Al reemplazar `edad_hombre`/`edad_mujer` por una sola pregunta `edad`, `buildBriefView`
(`src/lib/pdf/answers-view.ts`) dejó de encontrarlas: recorre `SCRIPT` y busca cada
respuesta por id, así que un id que ya no está en el guion nunca se visita. En la base
hay 8 respuestas `edad_hombre` y 4 `edad_mujer`, y ninguna de la pregunta nueva: hoy
**todas las entrevistas existentes salen sin edad**.

Dos caminos: mapear los ids viejos al leer (unas tres líneas, no toca los datos), o
migrar las respuestas al id `edad`. El primero conserva la trazabilidad de lo que
respondió cada persona; el segundo deja la base más limpia. Las líneas 45-46 de ese
archivo, que filtraban por género, quedaron muertas en cualquiera de los dos casos.

### Quién aprobó una etapa

La columna de actividad dice "Equipo aprobó Contexto del sector" porque la app tiene
una sola contraseña compartida y ninguna identidad de usuario: no hay con qué llenar
un `approved_by`. Si en algún momento el panel distingue personas, ahí conviene
agregar la columna y atribuir las aprobaciones.

## 3. Lo que el spec pide y esta rama no cubre

Es trabajo del plan del servidor MCP, no un olvido:

- **La propuesta de valor post-taller** sobre `deliverables`, con el mismo mecanismo
  de versiones.
- **El catálogo del archivo del estudio** y las seis herramientas MCP.

### Resuelto: borrador nuevo sobre una etapa ya aprobada (2026-07-31)

Era el bloqueante de `guardar_etapa` y ya está decidido e implementado.

**La regla: lo aprobado sigue mandando, y lo nuevo no queda escondido.** Una escritura
por MCP sobre una etapa cerrada no pisa la versión aprobada ni reabre la etapa sola
—sería deshacer una decisión humana desde un chat que nadie está mirando— pero tampoco
desaparece: queda esperando el gate humano en el panel.

Sale de las dos fronteras que fija el spec: *"Claude nunca aprueba"* y *"el panel es
donde se decide; Claude es donde se trabaja"*. Reabrir la etapa sola rompe la primera;
rechazar la escritura rompe la segunda. Esta es la única de las tres que respeta ambas.

Qué cambió:

- `StageState.borradorNuevo` — la versión más nueva sin aprobar, cuando la etapa ya
  tiene una aprobada debajo. `null` el resto del tiempo.
- El panel muestra un aviso con "Ver la nueva / Ver la aprobada", y el botón de aprobar
  sella la versión que estás viendo.
- `selectTendencias` toma la long list de la versión **más nueva**, no de la aprobada.
  La long list es el insumo del gate: si Claude la amplía, hay que poder elegir sobre la
  lista ampliada. Antes una tendencia que solo existía en la propuesta nueva se
  rechazaba por "intrusa" — el caso exacto que este documento marcaba como normal.

## 4. Deuda menor registrada

Ninguna bloquea nada:

- `selectTendencias` no es atómico —`neon-http` no tiene transacciones—: si falla la
  aprobación queda un borrador con la selección sin aprobar.
- La ruta de escritura no tiene tests propios: el repo no tiene andamiaje para tests
  HTTP. El más valioso sería aprobar con un `versionId` inexistente esperando 404.
- `landscapeState` se consulta una vez por pantalla del panel (N+1 asumido y
  documentado). A esta escala —decenas de versiones por proyecto— no se nota.
- La ruta de escritura va sin autenticación, como el resto del panel interno. Es deuda
  ya aceptada. El spec sí exige autenticación endurecida para el MCP, que va a exponer
  datos de marcas de terceros a internet.
