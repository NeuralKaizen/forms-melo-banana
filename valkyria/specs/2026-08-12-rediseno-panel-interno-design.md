# Rediseño del panel interno · Diseño UI/UX

Fecha: 2026-08-12
Origen: sesión visual con el usuario sobre la rama `fase3-pipeline-estrategia`, ya con la
navegación por grupos implementada — "no me gusta cómo está quedando todo… los colores, el layout
y todo se me hace incómodo" y "todavía no es muy intuitivo ni fácil de navegar por el cluster de
información".

Reemplaza el lenguaje visual y la arquitectura de navegación definidos en
`2026-08-11-estrategia-ux-navegacion-design.md`. Ese spec sigue siendo la referencia de la lógica
de estados (qué está completo, qué espera a quién) — lo que cambia es cómo se presenta.

No toca la entrevista pública (`/interview/*`, `/gracias`): el rediseño es sólo del panel
autenticado.

## Los problemas confirmados

Del código actual, verificados con el usuario:

1. **Todo es la misma tarjeta.** `rounded-2xl` + `border-black/5` + `shadow-sm` + fondo blanco,
   repetido en el bloque "Esperando", en la tabla del listado, en las tres tarjetas de grupo y en
   los dos workspaces. Nada tiene peso propio, así que nada se lee primero.
2. **Sopa de grises.** `13.5px`/`11.5px`/`12.5px` con `#a59c89`, `#8a8170`, `#6b6155`, `#4a4438`.
   Entre un título de sección y un dato secundario hay 2px y medio tono: no hay escala tipográfica.
3. **El amarillo es decoración, nunca estructura.** Un punto de 6px, un chip `#fffdf0` casi
   invisible sobre crema, un `box-shadow` de 2px bajo un tab. La marca no se siente.
4. **Cinco sistemas de navegación apilados.** Lateral oscura con proyectos → tres tarjetas de grupo
   → tabs del grupo activo → aviso de dependencia → carril de etapas dentro del workspace. Ese
   apilamiento es el "cluster de información" que el usuario nombró.
5. **El workspace está disfrazado de formulario.** El panel no es un editor: el equipo escribe en
   Claude por MCP y el panel existe para leer, comparar y aprobar. Hoy la decisión vive en una barra
   negra flotante al pie y el ancho se reparte entre dos columnas laterales (176px de etapas + 248px
   de actividad), dejando el contenido —lo único que importa— en el medio y angosto.

## Vocabulario

Queda fijado con el usuario y **hay que renombrarlo en el código**, que hoy usa otros nombres:

| Concepto | Qué es | Nombre hoy en el código |
|---|---|---|
| **Fase** | Entrevistas · Propuesta de valor · Taller · Landscape · Estrategia | `Grupo` / `PantallaKey` |
| **Bloque** | Sólo en Estrategia: Diagnóstico y consumidor · Esencia de marca · Cierre | `GrupoEtapas` |
| **Etapa** | Los pasos de una fase: 6 en Landscape, 14 en Estrategia | `Stage` / `EtapaEstrategia` |
| **Campos** | El `content` jsonb de una etapa | `content` |

El rename es parte del alcance: `Grupo` → `Fase`, `GrupoKey` → `FaseKey`, `deriveGrupos` →
`deriveFases`, `grupoActual` → `faseActual`, `grupoDePantalla` → `faseDeEtapa`, `GRUPOS_ETAPAS` →
`BLOQUES`. `Stage`/`StageKey` del landscape se dejan como están (ya significan "etapa" y tocarlos
arrastra `stages.ts`, el store y el MCP sin ganancia).

## Lenguaje visual

Sustituye el actual (crema `#fffdf2` + amarillo tímido + tarjetas blancas con sombra).

| Token | Valor | Uso |
|---|---|---|
| `--banana` | `#FFD400` | Barra lateral completa, estados aprobados, botón de aprobar |
| `--ink` | `#15120C` | Texto, fondos invertidos, el borde fuerte de las secciones |
| Fondo | `#FFFFFF` | Todo el contenido. La crema desaparece del panel |
| `--line` | `#EDEAE1` | Hairlines: la única forma de separar bloques |
| Apoyo | `#2C281F` cuerpo · `#5C5648` secundario · `#A8A296` rótulos · `#B5AF9F` deshabilitado | Cuatro pasos distinguibles, no cinco casi iguales |
| Aprobado suave | `#FFF3B8` | Fondo de píldoras/etapas aprobadas |

Reglas:

- **Sin tarjetas y sin sombras** en el contenido. Se separa con hairlines y con un borde superior
  `1.5px solid var(--ink)` cuando una sección tiene que pesar. Las sombras quedan sólo para lo que
  flota de verdad (la barra amarilla abierta encima, los menús).
- **Escala tipográfica real**: 30px título de etapa · 19px nombre de proyecto en listas · 14px
  cuerpo · 13px UI · 10px rótulos en versalitas con `tracking .14em`. Nada entre 13.5 y 12.5.
- **Fraunces** (`--font-serif`, ya cargada) para nombres de proyecto, títulos de etapa y el
  wordmark. **Geist** para todo lo demás. La serif es sistema, no adorno puntual.
- **El amarillo es superficie**, no acento: la barra lateral entera es `--banana`, con texto
  `--ink` encima. Los elementos activos sobre amarillo se invierten a fondo `--ink` / texto blanco.
- Se conserva `prefers-reduced-motion` y el criterio de movimiento discreto ya vigente en
  `globals.css`: transiciones de color y opacidad, nada que desplace contenido.

## Arquitectura de pantalla

Tres zonas, de izquierda a derecha: **barra amarilla → índice del proyecto → área de trabajo**.
La barra amarilla tiene tres estados y el índice sólo existe con un proyecto abierto.

### 1. Barra amarilla — estado ancho (230px), sin proyecto abierto

Es la pantalla `/admin`. La barra **no repite el listado que tiene al lado** (variante A elegida):

- Wordmark "Mellow & Banana" en Fraunces.
- Rótulo `Panel` y una sola sección real: **Proyectos** (con contador, activa, invertida a fondo
  `--ink`). El mockup mostraba también "Entrevistas" y "Archivo del estudio": **no se implementan**,
  porque esas rutas no existen — hoy el panel sólo tiene `/admin`, `/admin/projects/[id]/*`,
  `/admin/[sessionId]` y `/admin/login`. La lista de secciones queda preparada para crecer, pero no
  se ponen enlaces muertos.
- Rótulo `Nos toca` y la cola del equipo en un bloque `rgba(21,18,12,.07)`: el total en negrita
  ("2 decisiones") y hasta tres ítems, cada uno con nombre de proyecto y la acción debajo en
  chico. Sale de `attentionItems` filtrado por `bloqueo === 'equipo'`. **Es el contenido que
  justifica la barra**: con una sola sección de navegación, la cola es lo que la hace útil.
- Al pie, `Panel interno` en versalitas.

El centro es el listado de proyectos: filas separadas por hairlines (no tabla con `<thead>` gris),
nombre en Fraunces 19px, fase actual y detalle debajo, chip de estado (`Nos toca` amarillo /
`Esperando` gris), las tres marcas del recorrido y el "hace cuánto". Se conserva el bloque
"Esperando" como sección propia sólo si la cola tiene más de tres ítems; con tres o menos, la barra
ya la muestra y repetirla es el problema que estamos arreglando.

### 2. Barra amarilla — estado riel (58px), con proyecto abierto

Al entrar a un proyecto la barra se recoge:

- Logo M&B como cuadrado `--ink` de 34px con texto banana.
- Un avatar por proyecto: cuadrado de 34px, `rounded-[9px]`, iniciales en Fraunces. El activo se
  invierte a `--ink`. Un punto negro con anillo banana arriba a la derecha cuando ese proyecto
  tiene algo esperando al equipo.
- Al pie, el control `»` para abrir la barra.

**Consecuencia asumida de la variante A:** como el estado ancho no lista proyectos, el paso de
ancha a riel no es una contracción de las mismas filas — cambia lo que la barra muestra (secciones
y cola → avatares de proyecto). Para que el cambio no se lea como un salto arbitrario:

- el avatar con iniciales se usa **con el mismo diseño** en el riel y en la barra abierta encima
  (estado 3), que es donde los proyectos sí se listan con nombre;
- los ítems de la cola del estado ancho llevan ese mismo avatar delante del nombre del proyecto,
  así el cuadradito ya estaba en pantalla antes de entrar;
- la transición es de opacidad y ancho, sin desplazar el contenido de la derecha.

### 3. Barra amarilla — abierta encima (230px, flotante)

Al pasar el mouse por el riel o tocar `»`, la barra se expande **sobre** el contenido
(`position:absolute`, `box-shadow:14px 0 34px rgba(0,0,0,.22)`) con un velo
`rgba(21,18,12,.14)` sobre el resto. Muestra los proyectos con avatar, nombre y su fase actual;
el activo invertido. Nada del contenido se desplaza. Al salir el mouse se recoge.

Accesible por teclado: `»` es un `button` real con `aria-expanded`; `Escape` cierra; el foco entra
al primer proyecto. El hover es un atajo, no el único camino.

**No se persiste preferencia de ancho.** El estado se deriva de la ruta (`/admin` → ancha;
`/admin/projects/*` → riel) y la apertura encima es efímera. Si más adelante hace falta un pin,
se agrega; hoy sería estado sin consumidor.

### 4. Índice del proyecto (222px)

La única navegación del proyecto. Reemplaza a `ProjectHeader` (las tres tarjetas + tabs) **y** a
los carriles de etapas de los dos workspaces.

- Cabecera: nombre del proyecto en Fraunces 16px y debajo, en 11.5px `#A8A296`, la fase actual con
  su avance ("Estrategia · 6 de 14 etapas").
- Una lista plana con las **fases como títulos** (10px versalitas `tracking .15em`, con su contador
  a la derecha: `6/6`, `✓`, `6/14`) y las **etapas como renglones** de 13px.
- Cada renglón lleva un punto de 6px: banana aprobada · blanco con borde la que estás viendo ·
  `#E0DCD0` pendiente. La etapa activa es el renglón invertido (`--ink`, texto blanco).
- Punto banana al final del renglón (`margin-left:auto`) cuando esa etapa espera al equipo.
- **Fases sin etapas propias** (Entrevistas, Propuesta de valor, Taller) aparecen como un único
  renglón cada una, no como título vacío.
- **Colapso por volumen**: dentro de una fase se muestran las etapas hasta 6; si hay más, se
  muestran las aprobadas más recientes, la activa y las dos siguientes, con un renglón
  `＋ n etapas más` que expande. Con las 14 de Estrategia esto evita una columna que scrollea sola.
- En Estrategia los **bloques** se muestran como sub-rótulo dentro de la fase (Diagnóstico y
  consumidor · Esencia de marca · Cierre), en 8.5px, sólo cuando la fase está expandida.

No hay fila de fases ni fila de etapas en el área de trabajo. No hay breadcrumb navegable. El
índice es lo único que navega.

### 5. Área de trabajo

Ocupa todo el resto del ancho. Es una **sala de revisión**, no un formulario.

- Rótulo de ubicación en versalitas: `Estrategia · etapa 7 de 14`.
- Título de la etapa en Fraunces 30px.
- El contenido de la etapa como **documento editorial**: cada campo del `content` es una fila con
  el nombre del campo en el margen izquierdo (112px, 10px versalitas `#A8A296`) y el valor en una
  columna de lectura de `max-width:60ch`, 14px con `line-height:1.66`. Filas separadas por
  hairlines. `ContenidoEtapa` se reescribe con este layout: hoy anida objetos en cajas
  `bg-[#faf7ee]` que se apilan visualmente.
- Las fuentes (`Fuente[]`) van como píldoras hairline de 10.5px debajo del valor que las cita.
- **Pie fijo de decisión** (`border-top:1.5px solid var(--ink)`): a la izquierda la procedencia
  ("Escrito por Claude hace 2 h · sin aprobar"), a la derecha `Pedir otra versión` (hairline) y
  `Aprobar etapa` (banana, texto `--ink`). Reemplaza la barra negra flotante actual.
- **Anterior / siguiente** entre etapas: dos controles hairline al pie, con el nombre de la etapa
  vecina ("‹ Arquetipo", "Valores ›"), derivados del orden de la fase. Es el único elemento de
  navegación fuera del índice, y existe porque avanzar de a una es el gesto más frecuente.

### 6. Conflicto de versiones (aprobada vs. borrador nuevo de Claude)

Hoy es un aviso de 12.5px que se pierde. Es el momento más importante del panel y pasa a ser la
pantalla: cuando `borradorNuevo` existe, el área de trabajo se parte en **dos columnas** dentro de
un marco hairline — `Vigente · aprobada` (cabecera `#F8F6F0`) y `Nueva de Claude` (cabecera
banana), con lo agregado resaltado en `#FFF3B8` y lo quitado en `#A8A296` tachado. El pie ofrece
`Mantener la aprobada` y `Aprobar la nueva`. Sin conflicto, una sola columna: el documento del
punto 5.

La regla de negocio no cambia: lo aprobado sigue vigente hasta que el equipo decida.

### 7. Actividad y estado de Claude

La columna derecha de 248px desaparece. Su contenido se relocaliza:

- La **procedencia** de la etapa (quién la escribió y cuándo) ya está en el pie de decisión, que es
  donde importa.
- La **actividad** del proyecto pasa a una sección al final del documento de la etapa, como lista
  de renglones con hairlines: `Claude reescribió Territorios · hace 2 h`.
- El bloque "Conectado a Claude" se va del workspace. Es información de una sola vez, no algo que
  haya que ver en cada etapa; va al listado de `/admin` una vez, o se elimina.

### 8. Móvil

Por debajo de `md`, la barra amarilla y el índice se pliegan a una cabecera `--ink` con el
wordmark y un botón que abre el índice como panel desde la izquierda. El área de trabajo va a
ancho completo con padding reducido y los campos pasan de dos columnas (rótulo al margen) a una
(rótulo arriba del valor). Se conserva el criterio actual: en móvil se navega, no se aprueba.

## Qué se toca

| Archivo | Qué pasa |
|---|---|
| `src/components/AdminShell.tsx` | Reescrito: los tres estados de la barra amarilla + slot para el índice |
| `src/components/ProjectHeader.tsx` + test | **Se elimina.** Su trabajo lo hace el índice |
| `src/components/ProjectIndex.tsx` | **Nuevo**: índice de fases y etapas, con colapso por volumen |
| `src/components/EtapaDocumento.tsx` | **Nuevo**: documento editorial de una etapa + pie de decisión |
| `src/components/ComparadorVersiones.tsx` | **Nuevo**: las dos columnas del punto 6 |
| `.../landscape/ContenidoEtapa.tsx` + test | Reescrito con el layout de rótulo al margen |
| `.../landscape/LandscapeWorkspace.tsx` + test | Pierde las dos columnas laterales; usa los nuevos componentes. El gate de tendencias se conserva con el pie de decisión nuevo |
| `.../estrategia/EstrategiaWorkspace.tsx` + test | Igual, y los bloques pasan al índice |
| `src/app/admin/page.tsx` | Listado con hairlines; la cola sale a la barra |
| `src/app/globals.css` | Tokens nuevos; se retira `--cream` del panel (la entrevista lo sigue usando) |
| `src/lib/pipeline/phases.ts` + tests | Rename a fase/etapa; agrega el árbol que consume el índice |
| `src/lib/estrategia/stages.ts` | `GRUPOS_ETAPAS` → `BLOQUES` |
| `src/lib/pipeline/attention.ts` | Sin cambios de lógica; se reusa para la cola de la barra |

Fuera de alcance: la entrevista pública, el PDF (`lib/pdf`, `lib/deck`), el servidor MCP y el
esquema de base. Ninguna migración.

## Cómo se verifica

- **Tests de componente (Vitest + Testing Library)**, en el estilo de los existentes:
  - el índice lista las fases con su contador y marca la etapa activa con `aria-current`;
  - con más de 6 etapas en una fase, el índice colapsa y `＋ n etapas más` las revela;
  - la barra amarilla está ancha sin `activeProjectId` y en riel con uno;
  - el botón `»` expone `aria-expanded` y alterna;
  - el pie de decisión muestra `Aprobar etapa` sólo cuando la versión vista no está aprobada;
  - con `borradorNuevo`, se rinden las dos columnas y los dos botones de decisión;
  - `ContenidoEtapa` rinde un objeto anidado como filas rótulo/valor y "Sin datos" en los vacíos.
- **Canario de tipografía**: se conserva el test existente que verifica por bytes las comillas
  tipográficas, porque este rediseño toca mucho texto de UI.
- **Regresión de estados**: los tests de `phases.ts` se mantienen verdes tras el rename (mismo
  comportamiento, nombres nuevos).
- **Revisión en el dev server** por el usuario, proyecto Cafe Lunar sembrado, en los cuatro
  momentos: listado, landscape, estrategia con 14 etapas, y una etapa con borrador nuevo.

## Decisiones y descartes

- **Se descartó** el documento único con scroll por proyecto (todo el proyecto en una página):
  rehace el ruteo entero del panel sin resolver mejor la navegación.
- **Se descartó** la doble fila fases/etapas dentro del área de trabajo: era sumar una sexta
  navegación al cluster. La navegación fina vive en el índice y en anterior/siguiente.
- **Se descartó** el tablero de bloques para el contenido de la etapa: el `content` es jsonb libre
  y decidir qué bloque va grande exigiría una regla por etapa que hoy no existe.
- **Se descartó** la línea única de 23 marcas: obliga a apuntar a objetivos de 9px para saber qué
  hay detrás.
- **Se descartó** persistir si la barra queda ancha o recogida: estado sin consumidor real.
- **Pendiente heredado, no resuelto acá:** `tienePostTaller` sigue hardcodeada en `false`, así que
  la fase Taller nunca se completa. El índice lo mostrará con la misma honestidad que hoy la
  cabecera; arreglarlo es otro trabajo.
