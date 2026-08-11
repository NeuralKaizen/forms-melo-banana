# Fase 3 — Pipeline de estrategia · Diseño

Fecha: 2026-08-11
Fuente del proceso: `docs/fase3/Procesos Estrategia y Naming.pdf` (página "Proceso de Estrategia", bloques 0–5)
Arquitectura madre: `docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md` y `docs/superpowers/specs/2026-08-03-fase2-mcp-servidor-design.md`

## Qué es

El equipo de estrategia (Carlos, Lina, Isabel) corre el Proceso de Estrategia en claude.ai
con el contexto que entrega la plataforma (entrevistas, propuesta de valor, landscape
aprobado) y guarda el resultado de cada etapa como **borrador versionado** que se aprueba
en el panel. Mismo principio que la fase 2: la plataforma es memoria, estado y decisión —
no motor. Claude nunca aprueba.

## Alcance

**Entra:** los bloques de contenido del proceso — inmersión/diagnóstico (bloque 1),
consumidor (bloque 2), esencia de marca (bloque 3) y, del bloque 4, solo los dos cuadros
finales (brand essence + consumidor), que son el brief que la fase de Identidad consume.

**No entra:**
- Bloque 0 (carpeta Dropbox, archivo base) y la logística del bloque 4 (revisión interna,
  discurso, PPT, presentación, envíos, ajustes): no producen contexto que algo consuma
  dentro del sistema — viven en Dropbox como hoy.
- Bloque 5 (naming y copies): es la etapa 4 del plan maestro, alcance por confirmar.
- El catálogo del archivo del estudio (comparar con proyectos pre-plataforma): pendiente
  independiente de fase 2, se construye después sin tocar nada de este diseño. Para
  proyectos que ya pasaron por la plataforma, la comparación sale con
  `listar_proyectos` + `contexto_proyecto`.

## Las etapas (modelo híbrido)

Unidad de aprobación elegida: bloques cortos enteros, esencia pieza por pieza.

| Clave | Contenido | Del PDF |
|---|---|---|
| `diagnostico` | problema, insight, ventaja competitiva y diferenciales | bloque 1 |
| `consumidor` | metodología del consumidor + frases finales | bloque 2 |
| `rtbs` | reasons to believe, desde el consumidor | bloque 3 |
| `concepto` | concepto estratégico con su racional | bloque 3 |
| `beneficios` | funcionales y emocionales | bloque 3 |
| `arquetipo` | arquetipo con justificación | bloque 3 |
| `personalidad` | rasgos de personalidad | bloque 3 |
| `valores` | valores validados contra el proyecto | bloque 3 |
| `territorio` | territorio / posicionamiento frente a la categoría | bloque 3 |
| `brand_ideal` | Brand Ideal / propósito (Purpose Wheel de IDEO) | bloque 3 |
| `ingredients` | brand ingredients | bloque 3 |
| `tagline` | tagline o Core Creative Idea | bloque 3 |
| `manifiesto` | manifiesto de marca (cierre narrativo) | bloque 3 |
| `cuadros` | los dos cuadros: brand essence + consumidor | bloque 4 |

**Sin orden forzado.** El PDF: "el orden de abajo es de referencia — en la práctica varía
según el proyecto". La plataforma muestra estado, no encadena etapas. Único criterio
blando: `cuadros` se redacta desde contenido aprobado; si al guardarlo hay etapas de
esencia sin aprobar, la herramienta lo dice en el mensaje de respuesta (aviso, no bloqueo).

Estados por etapa: `pendiente / en_curso / aprobada / no_aplica` — los mismos del
landscape, con la misma semántica (una `no_aplica` no suma en ningún lado).

## Modelo de datos

Dos tablas nuevas, espejo exacto del patrón del landscape (enfoque B — se descartó
reutilizar las tablas del landscape con claves prefijadas, porque `diagnostico` y
`entrega` colisionan y las tablas mentirían su nombre; y se descartó generalizar a una
tabla multi-fase migrando producción, por generalidad especulativa con dos fases reales):

- `strategy_stages` — una fila por (proyecto, etapa): el estado y nada más.
  PK `(project_id, stage)`.
- `strategy_versions` — append-only: `id`, `project_id`, `stage`, `content` (jsonb),
  `author`, fechas y aprobación con las mismas columnas que `landscape_versions`.
  Nada se pisa; las versiones quedan para volver atrás.

Migración puramente aditiva (`CREATE TABLE IF NOT EXISTS` versionada en `drizzle/`,
corre sola en el build de producción — el mecanismo ya existe).

Regla del borrador nuevo sobre etapa aprobada: **idéntica a fase 2.** Una escritura MCP
sobre una etapa cerrada no pisa la versión aprobada ni reabre la etapa; queda como
`borradorNuevo` esperando el gate humano, visible en el panel.

## Validación de contenido

Mismo patrón que `validarContenidoEtapa` del landscape: cada etapa tiene su forma mínima
y se valida **antes** de resolver el proyecto y de tocar la base — una escritura mal
formada no deja rastro. Validación liviana a propósito: campos requeridos no vacíos, sin
sobre-esquematizar. Claude escribe borradores; el control de calidad real es humano.

Formas mínimas (todo texto no vacío salvo indicación):

- `diagnostico`: `{ problema, insight, ventaja, diferenciales: string[] ≥1 }`
- `consumidor`: `{ metodologia, frases: string[] ≥1 }`
- `rtbs`: `{ items: string[] ≥1 }`
- `concepto`: `{ concepto, racional }`
- `beneficios`: `{ funcionales: string[] ≥1, emocionales: string[] ≥1 }`
- `arquetipo`: `{ arquetipo, justificacion }`
- `personalidad`: `{ rasgos: string[] ≥1 }`
- `valores`: `{ items: [{ valor, validacion }] ≥1 }`
- `territorio`: `{ texto }`
- `brand_ideal`: `{ texto }`
- `ingredients`: `{ items: string[] ≥1 }`
- `tagline`: `{ texto }`
- `manifiesto`: `{ texto }`
- `cuadros`: `{ brandEssence: objeto no vacío, consumidor: objeto no vacío }` — los dos
  cuadros se guardan como estructura libre de pares campo→texto: el layout del cuadro es
  del archivo de Estrategia de M&B, la plataforma guarda el contenido.

## Herramientas MCP

Simetría con lo existente; el conector conectado en claude.ai no se rompe:

- `guardar_etapa` gana el parámetro opcional **`fase`**: `'landscape'` (default) o
  `'estrategia'`. Valida la clave contra el set de la fase correspondiente y el
  contenido contra su forma. Siempre borrador, siempre autor `claude`.
- **`estado_estrategia`** — espejo de `estado_landscape`: resumen, etapas con estado,
  versiones, `hayBorradorEsperandoAprobacion` y `bloqueo` explicado en castellano
  (incluida la rama de cero versiones: "todavía no hay borrador escrito", no "vaya a
  aprobar al panel").
- `contexto_proyecto` suma la sección **`estrategia`**: por etapa, título, estado y
  `contenidoAprobado` (solo lo aprobado, igual que hace con el landscape). Sin email ni
  datos personales, como ya se cuida.
- Las instrucciones del proyecto de claude.ai son una sola y viven en
  `docs/fase2/instrucciones-claude-ai.md`: se actualizan ahí (no se crea un segundo
  documento) con el mapa de los bloques del PDF → etapas → herramientas, incluyendo el
  camino "si el núcleo no queda claro" (bloque 1), que se trabaja en el chat con los
  documentos que el equipo cargue.

## Panel

`/admin/projects/[id]/estrategia`, espejo de las pantallas del landscape:

- Lista de las 14 etapas con estado y hint (`cuadros`: "se llena desde lo aprobado").
- Visor de versiones por etapa; el botón de aprobar sella **la versión que estás viendo**.
- Aviso de borrador nuevo sobre etapa aprobada con "Ver la nueva / Ver la aprobada".
- La cabecera del proyecto suma el estado de estrategia junto al del landscape.
- Se reutilizan los componentes del landscape donde den sin forzar; donde el reuso pida
  genericidad artificial, se duplica con nombre propio.

## Errores

- `ErrorDeHerramienta` con mensajes que le dicen a Claude qué hacer (mismo contrato).
- Clave de etapa inválida → lista de las claves válidas de la fase pedida.
- La ruta de aprobación del panel devuelve 404 ante `versionId` inexistente.

## Testing

Mismo andamiaje que fase 2 (pglite, sin red):

- Store: crear versión, estado por etapa, borrador nuevo sobre aprobada, `no_aplica`.
- Validación: una forma válida y una inválida por etapa; el aviso de `cuadros` con
  esencia sin aprobar.
- Herramientas: `guardar_etapa` con `fase: 'estrategia'` (clave inválida, contenido
  inválido, camino feliz, borrador sobre aprobada), `estado_estrategia` (cero versiones,
  borrador esperando, aprobada), `contexto_proyecto` con estrategia aprobada y sin nada.
- Regresión: `guardar_etapa` sin `fase` sigue siendo landscape puro; los tests OAuth y
  de landscape existentes no se tocan.
- Ruta de aprobación: `versionId` inexistente → 404 (deuda de fase 2 que se salda acá).

## Criterio de cierre de la fase

El equipo corre el Proceso de Estrategia de un proyecto real en claude.ai contra la
plataforma: contexto entregado por MCP, las 14 etapas escritas como borradores,
aprobadas en el panel, y los dos cuadros aprobados quedando como brief disponible en
`contexto_proyecto` para la futura fase de Identidad.
