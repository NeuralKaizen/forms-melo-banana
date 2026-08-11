import { z } from 'zod'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { db } from '@/lib/db/client'
import { verificarAccessToken } from '@/lib/oauth/store'
import { ErrorDeHerramienta } from '@/lib/mcp/errores'
import { listarProyectos, contextoProyecto, estadoLandscape, estadoEstrategia, guardarEtapa } from '@/lib/mcp/tools'

/**
 * Devuelve el error como resultado de herramienta y no como excepción: así Claude lo
 * lee y reintenta en el mismo turno, que es todo el punto de validar acá.
 */
async function responder(fn: () => Promise<unknown>) {
  try {
    return { content: [{ type: 'text' as const, text: JSON.stringify(await fn(), null, 2) }] }
  } catch (e) {
    if (e instanceof ErrorDeHerramienta)
      return { content: [{ type: 'text' as const, text: e.message }], isError: true }
    throw e
  }
}

const handler = createMcpHandler(
  server => {
    server.registerTool('listar_proyectos', {
      title: 'Listar proyectos',
      description:
        'Devuelve todos los proyectos del estudio con su marca, cuántas entrevistas tienen y ' +
        'cuánto avanzó su landscape. Llamá a esto primero cuando la persona mencione una marca ' +
        'o un proyecto y no sepas cuál es, en vez de suponer el nombre.',
      inputSchema: z.object({}),
    }, async () => responder(() => listarProyectos(db)))

    server.registerTool('contexto_proyecto', {
      title: 'Contexto de un proyecto',
      description:
        'Trae todo el contexto de un proyecto, entero: la marca, las entrevistas con sus ' +
        'respuestas, la propuesta de valor, el estado del landscape y el de la estrategia, con ' +
        'el contenido de las etapas aprobadas de ambos. Llamá a esto al empezar a trabajar en ' +
        'un proyecto, antes de escribir nada, para no repetir lo que ya se decidió.',
      inputSchema: z.object({
        proyecto: z.string().describe('Nombre de la marca o id del proyecto'),
      }),
    }, async ({ proyecto }) => responder(() => contextoProyecto(db, proyecto)))

    server.registerTool('estado_landscape', {
      title: 'Estado del landscape',
      description:
        'Qué etapa está en curso, cuál está aprobada, si hay un borrador esperando aprobación y ' +
        'qué bloquea el avance. Llamá a esto cuando pregunten en qué va el landscape o qué falta.',
      inputSchema: z.object({
        proyecto: z.string().describe('Nombre de la marca o id del proyecto'),
      }),
    }, async ({ proyecto }) => responder(() => estadoLandscape(db, proyecto)))

    server.registerTool('estado_estrategia', {
      title: 'Estado de la estrategia',
      description:
        'Qué etapa del Proceso de Estrategia está en curso, cuál está aprobada, si hay un borrador ' +
        'esperando aprobación y qué bloquea el avance. Llamá a esto cuando pregunten en qué va la ' +
        'estrategia o qué falta.',
      inputSchema: z.object({
        proyecto: z.string().describe('Nombre de la marca o id del proyecto'),
      }),
    }, async ({ proyecto }) => responder(() => estadoEstrategia(db, proyecto)))

    server.registerTool('guardar_etapa', {
      title: 'Guardar una etapa del proceso',
      description:
        'Guarda el resultado de una etapa en la plataforma. **Llamá a esto cada vez que termines ' +
        'de redactar una etapa**, sin esperar a que te lo pidan: si no la guardás, el trabajo se ' +
        'queda solo en este chat y no llega al panel del estudio. Siempre entra como borrador — ' +
        'vos nunca aprobás, el equipo aprueba desde el panel. Para la etapa "tendencias" mandá ' +
        'la long list completa en "candidatas", cada una con id, eje (Marca, Estrategia o ' +
        'Comunicación), titulo, descripcion y fuentes; no mandes "seleccionadas", que elegir las ' +
        '4 o 5 principales es decisión del equipo. Para las etapas de estrategia mandá fase: ' +
        '"estrategia"; las claves son las 14 del Proceso de Estrategia (diagnostico, consumidor, ' +
        'rtbs, concepto, beneficios, arquetipo, personalidad, valores, territorio, brand_ideal, ' +
        'ingredients, tagline, manifiesto, cuadros). Cada etapa de estrategia tiene su forma mínima: ' +
        'diagnostico es problema, insight, ventaja y diferenciales (lista); consumidor es metodologia ' +
        'y frases (lista); rtbs e ingredients son items (lista); concepto es concepto y racional; ' +
        'beneficios es funcionales y emocionales (listas); arquetipo es arquetipo y justificacion; ' +
        'personalidad es rasgos (lista); valores es items, lista de { valor, validacion }; territorio, ' +
        'brand_ideal, tagline y manifiesto son solo texto; cuadros es brandEssence y consumidor, cada ' +
        'uno un objeto de pares campo→texto. Los cuadros se llenan desde contenido aprobado.',
      inputSchema: z.object({
        proyecto: z.string().describe('Nombre de la marca o id del proyecto'),
        fase: z.enum(['landscape', 'estrategia']).default('landscape')
          .describe('A qué proceso pertenece la etapa'),
        etapa: z.string().describe('Clave de la etapa dentro de la fase'),
        contenido: z.record(z.string(), z.unknown()).describe('El resultado de la etapa, como objeto JSON'),
      }),
    }, async ({ proyecto, etapa, contenido, fase }) =>
      responder(() => guardarEtapa(db, { proyecto, etapa, contenido, fase })))
  },
  { serverInfo: { name: 'melo-banana', version: '1.0.0' } },
)

/**
 * Sin token válido la respuesta es 401 con `WWW-Authenticate` apuntando al documento
 * de recurso protegido — es lo único que le dice a Claude dónde descubrir el resto.
 * `withMcpAuth` arma ese header; nosotros solo decimos si el token sirve.
 */
async function verificar(_req: Request, bearer?: string) {
  if (!bearer) return undefined
  const info = await verificarAccessToken(db, bearer)
  if (!info) return undefined
  return { token: bearer, clientId: info.clientId, scopes: info.scope.split(' ') }
}

const protegido = withMcpAuth(handler, verificar, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { protegido as GET, protegido as POST }
