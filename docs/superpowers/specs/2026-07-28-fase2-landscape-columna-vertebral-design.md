# Fase 2 · Landscape — columna vertebral y memoria del estudio

Fecha: 2026-07-28
Estado: diseño aprobado, pendiente de plan de implementación

## El problema

Mellow & Banana **ya hace** el landscape con Claude. Crean un proyecto en claude.ai,
suben los PDFs de Dropbox, dan contexto y trabajan en varios chats. No les falta una
herramienta que investigue: les falta memoria.

Lo que reportan:

- Claude no recuerda entre chats del mismo proyecto.
- Si le mencionan un proyecto anterior del estudio, no lo conoce.
- El contexto se re-sube a mano cada vez.

Y en el flujo hay tres cortes:

1. Lo que el taller refina en Miro **no vuelve** a la plataforma. El landscape depende
   formalmente de eso: el cuadro de brand assets se arma sobre los 4 competidores
   definidos en el taller (ver `docs/fase2/fase-2-investigacion-landscape.md`,
   `panorama.brand_assets`, marcado como dependencia externa bloqueante).
2. El trabajo del landscape ocurre fuera de la plataforma y se evapora.
3. Lo aprendido en cada entrega queda como un PDF en una carpeta, sin volver a estar
   disponible.

## Qué construimos

**La continuidad, no el motor.** La plataforma es memoria, estado y decisión. La
inteligencia la pone Claude, en el plan de M&B, con el modelo que ellas elijan. No
gastamos tokens nuestros y no competimos con la interfaz que ya usan y les gusta.

Regla de diseño que ordena todo lo que venga después:

> Toda función nueva o **produce** contexto para la columna vertebral, o lo **consume**.
> Si no hace ninguna de las dos, no se construye.

## Arquitectura

### 1. La columna vertebral

`projects` ya existe en Neon y ya tiene colgando las entrevistas (`sessions`,
`answers`) y la propuesta de valor (`deliverables`). El landscape cuelga del mismo
proyecto — no es un módulo aparte.

Se agrega control de versiones por etapa, que es lo que hoy no existe en ningún lado:

```
landscape_stages
  project_id      → projects.id
  stage           'setup' | 'contexto' | 'tendencias' | 'panorama' | 'diagnostico' | 'entrega'
  status          'pendiente' | 'en_curso' | 'aprobada'
  UNIQUE (project_id, stage)

landscape_versions            -- append-only, nada se pisa
  id
  project_id, stage
  content         jsonb       -- la salida de la etapa
  author          'claude' | 'humano'
  author_label    text        -- quién, si se sabe
  created_at
  approved_at     timestamp | null
```

La versión aprobada es la que cuenta. Las anteriores quedan para volver atrás y para
ver cómo evolucionó una etapa.

La propuesta de valor pasa a admitir **versión post-taller**: el mismo mecanismo de
versiones sobre `deliverables`, editable desde el panel. Miro sigue siendo la mesa de
trabajo; las conclusiones se transcriben. La API de Miro se evalúa cuando duela.

### 2. El servidor MCP

Una ruta en la app ya desplegada. M&B la conecta en claude.ai como conector
personalizado (disponible en Pro, Max, Team y Enterprise — verificar al conectar).

Herramientas expuestas:

| Herramienta | Qué hace |
|---|---|
| `catalogo_archivo` | La lista completa de lo que existe en el archivo: informes y landscapes entregados, con tema, año y cliente. Corta, se lee entera, siempre primero. |
| `listar_proyectos` | Para que "el proyecto que hicimos para Techbag" signifique algo. |
| `contexto_proyecto` | Todo lo de un proyecto, entero: marca, entrevistas, propuesta de valor pre y post taller, estado del landscape. |
| `traer_documento` | El texto de un documento del catálogo, por página, para poder citar. |
| `guardar_etapa` | Claude escribe de vuelta el resultado de una etapa. Crea una versión nueva en estado borrador. |
| `estado_landscape` | Qué falta, qué está aprobado, qué está bloqueado. |

`guardar_etapa` es la que cierra el círculo. Sin ella siguen trabajando en Claude y el
resultado se sigue evaporando. Con ella, lo que hacen en su chat queda en el proyecto y
aparece en el panel sin que nosotros corramos un solo modelo.

Claude **nunca aprueba**. `guardar_etapa` siempre escribe borrador; aprobar es un acto
humano en el panel.

### 3. Memoria: que Claude no se pierda nada

El objetivo es uno solo: que Claude tenga el contexto completo al decidir, sin que se le
escape información. Son dos problemas distintos y se resuelven distinto.

**El contexto de un proyecto no se busca: se entrega entero.** Las entrevistas, la
propuesta de valor, la versión post-taller y lo que va del landscape son poco y caben
completos en una respuesta. Sin búsqueda, sin ranking, sin riesgo de omisión.

**El archivo del estudio se resuelve con un catálogo.** Los informes y landscapes
entregados sí son demasiados para entregarlos enteros, pero alcanza con una lista de
todo lo que existe — nombre, tema, año, cliente — que Claude lee completa, porque con
decenas de documentos la lista es corta. Ve todo, elige, y pide el documento.

La garantía sale de ahí: **el catálogo está completo por construcción**, se genera de lo
que hay guardado. Claude no puede ignorar un informe por no saber que existía. Dejar
algo afuera es una decisión visible, no un agujero invisible.

El texto de los documentos se extrae con `pdftotext` página por página, para poder citar.
Sin LLM, sin costo por corrida: interpretar es trabajo de Claude.

Fuera: embeddings, grafos y entidades enlazadas. Son optimizaciones para cuando el
catálogo sea grande, y no lo es ni de cerca.

### 4. Obsidian: descartado

No era un requisito — era una respuesta posible a "cómo navega la IA". Arrastrarlo
forzaba dos copias del mismo conocimiento (base y markdown) con la pregunta insoluble de
cuál manda. Y en Vercel el filesystem es de solo lectura, así que markdown como fuente no
soporta las escrituras en caliente de `guardar_etapa`.

Si vuelve, vuelve como exportación generada desde la base. Nunca como cimiento.

### 5. El panel

Sección Landscape por proyecto, con el layout aprobado en el brainstorming: etapas a la
izquierda, contenido de la etapa abierta al medio, historial de versiones. El panel es
donde se **decide**; Claude es donde se **trabaja**.

Los gates humanos viven acá porque no pueden vivir en el chat:

- Elegir 4 o 5 tendencias de la long list. Bloquea el avance de la etapa.
- Aprobar una versión.
- Cerrar una etapa.

## Seguridad

El MCP expone datos de **marcas de terceros** a internet. Es de otra categoría que la
deuda de seguridad ya aceptada en el panel interno (ver `melo-banana-pendientes-seguridad`).
Su autenticación va endurecida desde el día uno: sin credencial válida, `401`, y sin
filtrar existencia de proyectos. Esto es requisito del spec, no pendiente.

Los tres agujeros previos del panel quedan anotados y se revisan aparte, sin frenar
esta construcción.

## Fuera de alcance de v1

- Chat propio dentro de la plataforma (Claude es la interfaz).
- Destilación de PDFs con LLM propio.
- Generación del deck.
- Benchmarking automatizado con capturas y círculo cromático.
- Integración con la API de Miro.
- Escritura desde la app hacia Dropbox o Drive.

## Preguntas abiertas

- Formato del deck (Keynote, Figma, Google Slides) — solo importa cuando se automatice
  `setup.duplicar_template`.
- Quién escribe la ficha de catálogo de cada documento (tema, año, cliente) en la carga
  inicial: a mano, o pidiéndoselo a Claude una vez por documento.
- Volumen a partir del cual el catálogo deja de caber entero y hace falta buscar. No es
  un problema hoy; conviene medirlo antes de que lo sea.
