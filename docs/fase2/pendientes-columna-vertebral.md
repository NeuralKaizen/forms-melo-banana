# Fase 2 · Columna vertebral — qué queda pendiente

Fecha: 2026-07-30
Rama: `fase2-columna-vertebral` (19 commits sobre `main`)
Estado: implementada, revisada y en verde. **No verificada en un navegador todavía.**

Lo construido es lo que el spec llama la columna vertebral: las seis etapas del
Landscape versionadas en Neon (append-only), el gate humano de tendencias, la
aprobación de etapas, y el panel leyendo y escribiendo estado real en vez de datos
de demostración. Ver `docs/superpowers/plans/2026-07-29-fase2-columna-vertebral.md`.

## 1. Antes de desplegar: correr `db:push` (bloqueante)

Las tablas `landscape_stages` y `landscape_versions` **todavía no existen en Neon**.

```
npm run db:push
```

Hay que correrlo desde una terminal interactiva —`drizzle-kit` pide confirmación y
ningún agente puede contestarla—. Cuando pregunte por las dos tablas, elegir
**create table**: son nuevas, no son renames. Si propusiera tocar `projects`,
`sessions`, `answers` o `deliverables`, cancelar: se verificó columna por columna
que este cambio es puramente aditivo y no altera ninguna tabla con datos.

**El orden importa.** La cabecera del proyecto ahora consulta el estado real del
landscape en las ocho pantallas del panel, así que si este código llega a producción
sin las tablas creadas, el admin entero responde 500 — no solo `/landscape`.
Primero `db:push`, después el deploy.

Después de eso, para ver el panel con contenido:

```
npm run db:projects              # lista los proyectos que hay
npm run seed:landscape -- "<nombre del proyecto>"
npm run dev
```

Queda pendiente la verificación visual del paso 4 de la Tarea 9 del plan: que las
etapas se vean con su estado, que la selección de 4 tendencias habilite el botón,
y que aprobar mueva la etapa y sume una línea a la actividad.

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

- **Un borrador nuevo sobre una etapa ya aprobada queda invisible.** `getCurrentVersion`
  prefiere la aprobada, así que si Claude guarda una long list ampliada sobre
  `tendencias` ya aprobada, el panel sigue mostrando la vieja y la nueva queda
  huérfana. Hay que decidir la regla —¿reabre la etapa?, ¿se muestra junto a la
  aprobada?— antes de que `guardar_etapa` exista, porque es el caso normal de uso.
- **La propuesta de valor post-taller** sobre `deliverables`, con el mismo mecanismo
  de versiones.
- **El catálogo del archivo del estudio** y las seis herramientas MCP.

## 4. Deuda menor registrada

Ninguna bloquea nada:

- `listLandscapeVersions` ordena por `created_at` sin desempate por `id`: dos versiones
  con el mismo timestamp tendrían orden indefinido.
- `selectTendencias` no es atómico —`neon-http` no tiene transacciones—: si falla la
  aprobación queda un borrador con la selección sin aprobar.
- La ruta de escritura no tiene tests propios: el repo no tiene andamiaje para tests
  HTTP. El más valioso sería aprobar con un `versionId` inexistente esperando 404.
- `landscapeState` se consulta una vez por pantalla del panel (N+1 asumido y
  documentado). A esta escala —decenas de versiones por proyecto— no se nota.
- La ruta de escritura va sin autenticación, como el resto del panel interno. Es deuda
  ya aceptada. El spec sí exige autenticación endurecida para el MCP, que va a exponer
  datos de marcas de terceros a internet.
