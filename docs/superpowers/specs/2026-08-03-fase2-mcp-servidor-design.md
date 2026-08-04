# Fase 2 · Servidor MCP — el conector de claude.ai

Fecha: 2026-08-03
Estado: diseño aprobado, pendiente de plan de implementación

## El problema

La columna vertebral ya está: las seis etapas del Landscape versionadas en Neon, el gate
humano de tendencias, la aprobación de etapas, y el panel leyendo y escribiendo estado
real (ver `2026-07-28-fase2-landscape-columna-vertebral-design.md`).

Falta lo que la hace útil. Hoy M&B trabaja el landscape en claude.ai y **el resultado se
sigue evaporando**: no hay forma de que lo que escriben en un chat aparezca en el panel.
La plataforma tiene memoria y nadie puede escribirle.

Este spec cubre el servidor MCP y las cuatro herramientas que operan sobre el proyecto.
Cierra el círculo con `guardar_etapa`.

## Alcance

El spec original agrupaba bajo “el MCP” tres subsistemas que no comparten nada salvo la
autenticación. Se separan, y este documento cubre solo el primero:

| | Qué es | Cuándo |
|---|---|---|
| **A · Herramientas del proyecto** | Servidor, autenticación y las cuatro herramientas sobre tablas que **ya existen** | **Este spec** |
| B · Archivo del estudio | `catalogo_archivo` y `traer_documento`: tabla de documentos, dónde viven los PDFs, extracción con `pdftotext`, carga inicial | Mejora futura |
| C · Propuesta de valor post-taller | Versiones sobre `deliverables` | Mejora futura |

A va primero porque es el único con consumidor nombrado hoy: M&B está haciendo el
landscape esta semana. B no tiene consumidor hasta que se decida cómo entran los PDFs al
sistema —incluida la pregunta que el spec original dejó abierta, quién escribe la ficha de
catálogo de cada documento—, y C no lo tiene hasta que haya un taller que transcribir.
A además desbloquea a los otros dos: la autenticación se construye una vez.

## Arquitectura

Una ruta más en la app ya desplegada: `src/app/api/mcp/route.ts`. **No corre modelos, no
llama a la API de Anthropic, no gasta tokens.** Traduce llamadas MCP a las funciones del
store que ya existen y ya tienen tests.

Transporte **Streamable HTTP** con `mcp-handler` sobre el SDK oficial de MCP. La razón
concreta: sirve nativamente la especificación 2026-07-28 y cae de vuelta a Streamable HTTP
de 2025 desde un solo handler. No sabemos con qué generación del protocolo va a llegar
claude.ai y esto saca el problema de encima.

Dependencias nuevas: `mcp-handler`, `@modelcontextprotocol/server`, `zod`. Zod además da
la validación de entradas de las herramientas sin escribirla a mano.

## Autenticación

La app pasa a ser su propio servidor de autorización. Es la parte más grande del trabajo
y no tiene atajo.

**Por qué OAuth y no un token fijo.** claude.ai admite un header fijo —un bearer token que
un admin pega al agregar el conector—, que serían diez líneas de nuestro lado. Pero está
en beta, en despliegue lento, y hay que pedirle acceso anticipado a Anthropic: si no lo
tienen habilitado, el campo no aparece en el diálogo. OAuth funciona hoy sin gestiones,
cada persona recibe su propio token revocable en vez de compartir un secreto —que importa
más cuanto más grande es el estudio—, y el paso de consentimiento reusa el login que la
app ya tiene. Sin autenticación queda descartado: expone datos de marcas de terceros a
internet. Token en la URL está prohibido por la especificación de MCP, y con razón: las
URLs quedan en logs, proxies e historial.

### Endpoints

| Ruta | Qué hace |
|---|---|
| `/.well-known/oauth-protected-resource` | Apunta al servidor de autorización. El campo `resource` tiene que coincidir **exacto** con la URL que se pegue en claude.ai, path incluido |
| `/.well-known/oauth-authorization-server` | Metadata RFC 8414, con `code_challenge_methods_supported: ["S256"]` |
| `/api/oauth/register` | Registro dinámico de cliente (RFC 7591). Cuerpo **JSON** |
| `/api/oauth/authorize` | Sin cookie `admin` válida redirige a `/admin/login`; con cookie, pantalla de consentimiento y emite el código |
| `/api/oauth/token` | Códigos y refresh. Cuerpo **form-urlencoded**, no JSON |

El detalle del content-type no es cosmético: es el error que rompe estos flujos en Next,
porque el parser por defecto es JSON y el endpoint devuelve 415.

### Reglas

- La ruta MCP sin credencial válida responde **401 con
  `WWW-Authenticate: Bearer resource_metadata="…"`**. Ese header es lo que le dice a Claude
  dónde descubrir todo lo demás; sin él la conexión falla con un “no se pudo alcanzar el
  servidor” que no explica nada. El 401 no filtra si un proyecto existe.
- Los tokens se guardan **hasheados**, nunca en claro. Access token de una hora.
- El refresh **rota** en cada uso y el nuevo vuelve en la misma respuesta que invalida el
  viejo. Lo exige la especificación para clientes públicos, que es lo que el registro
  dinámico convierte a Claude.
- El código de autorización es de un solo uso y verifica PKCE S256.
- Errores de refresh con códigos RFC 6749 (`invalid_grant`, no uno propio).

### Consentimiento

La app tiene una sola contraseña compartida y ninguna identidad de usuario. Esa pantalla
de login sirve tal cual como el paso de consentimiento: no hay que inventar identidad para
que el flujo cierre. Como consecuencia, las escrituras por MCP van con `author = 'claude'`
y `author_label` en `null` — el panel ya muestra “Claude” en ese caso. No se inventa un
autor que no existe.

### Tablas nuevas

`oauth_clients`, `oauth_codes`, `oauth_tokens`. Puramente aditivas: nada de lo existente
cambia.

### Datos operativos

- Callback a registrar: `https://claude.ai/api/mcp/auth_callback`
- Anthropic sale de `160.79.104.0/21` — importa si alguna vez hay un WAF adelante
- Claude espera **10 s** en descubrimiento, registro y token; **30 s** en refresh

## Las cuatro herramientas

| Herramienta | Entrada | Devuelve |
|---|---|---|
| `listar_proyectos` | — | Cada proyecto con su marca, cuántas entrevistas tiene, si tiene propuesta de valor, y cuántas etapas del landscape van aprobadas |
| `contexto_proyecto` | `proyecto` | Todo, entero: marca, entrevistas con sus respuestas, propuesta de valor, y el contenido de las etapas aprobadas |
| `estado_landscape` | `proyecto` | Por etapa: en qué está, cuántas versiones, si hay un borrador esperando el gate, y qué la bloquea |
| `guardar_etapa` | `proyecto`, `etapa`, `contenido` | La versión creada, el estado en que quedó la etapa, y qué pasa ahora |

`proyecto` acepta el nombre o el id, y resuelve por el mismo normalizador que ya usa la
app. Si no existe, el error **lista los que sí** — así Claude corrige solo en vez de
inventar.

`contexto_proyecto` entrega todo sin búsqueda ni ranking, como pide el spec original: a
esta escala son unas pocas decenas de respuestas por proyecto, entra entero y no hay
riesgo de que se le escape algo.

### `guardar_etapa`: las dos reglas que no se negocian

**Siempre escribe borrador.** No existe ninguna herramienta que apruebe. Aprobar es un
acto humano y vive en el panel. Sobre una etapa ya aprobada, la escritura no pisa lo
aprobado ni reabre la etapa: queda como `borradorNuevo` esperando el gate, que es el
comportamiento que el store ya implementa.

**Rechaza el campo `seleccionadas`.** Si Claude pudiera escribirlo, estaría eligiendo las
4-5 tendencias — exactamente la decisión que el gate le reserva al equipo.

La respuesta dice en texto qué quedó pendiente, para que Claude se lo pueda avisar a quien
esté en el chat: *“quedó como borrador, el equipo lo aprueba desde el panel”*.

### Validación de la etapa Tendencias

Cinco de las seis etapas guardan `content` sin forma impuesta: el panel las renderiza
genéricamente y una humana las lee. **Tendencias es distinta**: el gate no lee texto,
recorre `content.candidatas` y necesita un `id` estable por tendencia, porque la selección
humana se guarda como una lista de esos ids. Con otra forma el panel muestra el contenido
pero el gate deja de funcionar, y el gate es el corazón de la etapa.

Por eso `guardar_etapa` valida cuando la etapa es `tendencias`: `candidatas` no vacío, cada
una con `id` único y no vacío, `eje` entre los tres válidos, `titulo` y `descripcion`. El
mensaje de error dice qué se esperaba, no solo que falló.

El error llega en el único momento en que sale gratis: Claude todavía tiene el turno y
reintenta. Si en cambio el problema apareciera al abrir el panel, corregirlo costaría
volver a claude.ai y explicarle a un chat nuevo —que no recuerda nada— qué salió mal.

## Que Claude use la herramienta

Riesgo real y no técnico: **`guardar_etapa` no se dispara sola.** Los modelos actuales son
conservadores para recurrir a herramientas que no son obviamente necesarias. Si nadie dice
“guardá esto”, el trabajo se queda en el chat y volvemos al problema que esta fase existe
para resolver.

Dos palancas, y se usan las dos:

1. **Descripciones prescriptivas.** No “guarda una etapa” sino “llamá a esto cuando
   termines de redactar una etapa del landscape”. Decir *cuándo* llamar, no solo qué hace,
   da una mejora medible en la tasa de uso.
2. **Instrucciones para el proyecto de claude.ai.** Un bloque corto que M&B pega en las
   instrucciones de su proyecto. Es entregable de este spec, no nota al pie.

Se verifica antes de entregar: Claude Code puede conectarse como cliente MCP, así que el
flujo se vive igual que lo van a vivir ellas y la descripción se ajusta hasta que salga
natural.

## Migraciones versionadas

Este spec agrega tres tablas, y es la misma situación que el 2026-07-31 dejó el admin
entero en 500 durante diez minutos: el deploy salió antes que las tablas, porque `db:push`
es un paso manual que alguien tiene que acordarse de correr. Hoy `drizzle/` no existe.

Se crea `drizzle/` con migraciones versionadas aplicadas en el build.

**El detalle que hay que hacer bien:** las siete tablas actuales ya existen con datos
reales (5 proyectos, 16 sesiones, 221 respuestas, 3 entregables). `drizzle-kit generate` va
a producir una primera migración que las crea todas, y correrla contra producción falla con
“ya existe”. Esa primera migración se marca como **ya aplicada** en producción en vez de
ejecutarse, y corre de verdad solo contra bases vacías. **No se borran ni recrean las
tablas existentes para emparejar**: se irían los datos.

## Cómo se verifica

El repo no tiene andamiaje para tests HTTP —deuda anotada desde julio—. En vez de
agregarlo, la lógica no vive en las rutas:

- `src/lib/mcp/tools.ts` — las cuatro herramientas como funciones que reciben `db`. Se
  testean con PGlite igual que `store.test.ts`.
- `src/lib/oauth/` — PKCE, códigos de un solo uso, rotación de refresh, hasheo.
- Las rutas quedan como cáscaras finas: parsean, delegan, serializan.

Los tests que más valen: que un código no se pueda usar dos veces, que un `code_verifier`
incorrecto se rechace, que un refresh usado no siga sirviendo, que `guardar_etapa` sobre
una etapa aprobada no la pise ni la reabra, y que la validación de Tendencias rechace cada
forma mala por separado.

Sobre eso, dos clientes reales contra localhost: **MCP Inspector** y **Claude Code**, que
hace el baile completo de OAuth y ejercita cada herramienta.

Lo último —el conector agregado en claude.ai y el clic en Connect— requiere una cuenta y
una persona. Es el único paso que no se puede automatizar.

### Lo que hay que resolver antes de ese paso

- **Rama de Neon para desarrollo.** Hoy `.env` apunta a producción: cada corrida de un
  script toca los 5 proyectos reales. Con migraciones eso pasa de incómodo a peligroso.
- **Qué base usa Preview en Vercel.** `DATABASE_URL` está seteada para Production y
  Preview. Si el build corre migraciones, cada deploy de preview se las aplica a
  producción.
- **La URL pública.** Verificado el 2026-08-03: `forms-melo-banana.vercel.app` responde
  **200 público**, pero las URLs por deployment responden **302 al muro de Vercel
  Authentication**, que es lo que se comerían los pedidos de Anthropic. O se desactiva la
  protección para preview, o se prueba contra producción — viable porque todo lo que este
  spec agrega es aditivo.
### La URL: decidido el 2026-08-03

**`https://forms-melo-banana.vercel.app/api/mcp`.** El estudio no tiene hoy un dominio
propio del que colgar un subdominio, y la cuenta de Vercel no tiene ninguno registrado.
La URL de Vercel responde 200 público y es estable mientras el proyecto no se renombre.

La URL **no se escribe en el código**: sale de la variable `MCP_PUBLIC_URL`, que alimenta
el campo `resource` del documento de metadata. Mudar de dominio más adelante es una
variable y un redeploy, no cirugía.

Lo que la variable no evita: los tokens que claude.ai guarda quedan atados al `resource`
viejo, así que un cambio de URL obliga a cada persona del estudio a reconectar desde
Settings → Connectors. Se asume a sabiendas; a esta escala la fricción es aceptable.

Si más adelante aparece un dominio propio, además de ser más presentable queda **exento
del muro de Vercel Authentication**, porque la protección está configurada como “todo
excepto dominios personalizados”.

## Fuera de alcance

- El archivo del estudio y sus dos herramientas (B)
- La propuesta de valor post-taller (C)
- Chat propio dentro de la plataforma — Claude es la interfaz
- Cualquier llamada a un modelo desde la plataforma
- Identidad de usuario: sigue habiendo una sola contraseña compartida

## Deuda que este spec no toca

Sigue vigente de `melo-banana-pendientes-seguridad` y del documento de pendientes: las
rutas del panel van sin autenticación, y las entrevistas viejas no muestran la edad en el
PDF porque `buildBriefView` busca por ids que ya no están en el guion. Ninguna de las dos
bloquea esto.
