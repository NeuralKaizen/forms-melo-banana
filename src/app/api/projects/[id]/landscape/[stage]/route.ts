import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { saveLandscapeVersion, approveLandscapeVersion, selectTendencias, ErrorDeValidacion } from '@/lib/db/store'
import { STAGE_ORDER, type StageKey } from '@/lib/landscape/stages'
import { esUuidValido } from '@/lib/landscape/ids'

export async function POST(req: Request, { params }: { params: Promise<{ id: string; stage: string }> }) {
  const { id, stage } = await params
  if (!STAGE_ORDER.includes(stage as StageKey))
    return NextResponse.json({ error: `Etapa desconocida: ${stage}` }, { status: 400 })
  if (!esUuidValido(id))
    return NextResponse.json({ error: `Id de proyecto inválido: ${id}` }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'El body tiene que ser JSON' }, { status: 400 })
  }
  // `req.json()` acepta cualquier JSON válido, incluidos `null` y los primitivos: sin este
  // chequeo, leer `body.accion` más abajo explota con un TypeError cuando el body es `null`.
  if (typeof body !== 'object' || body === null)
    return NextResponse.json({ error: 'El body tiene que ser un objeto JSON' }, { status: 400 })

  try {
    switch (body.accion) {
      case 'guardar': {
        // undefined o null: no hay contenido que guardar. `null` tampoco es un contenido
        // válido para ninguna etapa del proceso (todas esperan un objeto con datos), así
        // que se rechaza igual que si faltara, en vez de dejar que Postgres lo reviente.
        if (body.content === undefined || body.content === null)
          return NextResponse.json({ error: 'Falta content' }, { status: 400 })
        // Desde el panel el autor siempre es humano. Claude escribe por MCP, no por acá.
        const version = await saveLandscapeVersion(db, id, stage as StageKey, {
          content: body.content,
          author: 'humano',
          authorLabel: typeof body.autor === 'string' ? body.autor : undefined,
        })
        return NextResponse.json(version)
      }
      case 'aprobar': {
        if (typeof body.versionId !== 'string')
          return NextResponse.json({ error: 'Falta versionId' }, { status: 400 })
        if (!esUuidValido(body.versionId))
          return NextResponse.json({ error: `versionId inválido: ${body.versionId}` }, { status: 400 })
        return NextResponse.json(await approveLandscapeVersion(db, body.versionId))
      }
      case 'seleccionar-tendencias': {
        if (stage !== 'tendencias')
          return NextResponse.json({ error: 'La selección de tendencias solo aplica a la etapa Tendencias' }, { status: 400 })
        if (!Array.isArray(body.seleccionadas))
          return NextResponse.json({ error: 'seleccionadas tiene que ser una lista de ids' }, { status: 400 })
        const version = await selectTendencias(
          db, id, body.seleccionadas as string[],
          typeof body.autor === 'string' ? body.autor : undefined,
        )
        return NextResponse.json(version)
      }
      default:
        return NextResponse.json({ error: `Acción desconocida: ${String(body.accion)}` }, { status: 400 })
    }
  } catch (e) {
    // ErrorDeValidacion son los rechazos del gate (versión inexistente, cantidad de
    // tendencias, ids repetidos o intrusos): son culpa del pedido, 400 con su mensaje.
    // Cualquier otra excepción (Postgres caído, un bug real) es un fallo del servidor:
    // 500 con un mensaje genérico, sin filtrar el texto interno del driver al cliente.
    // El error real queda en el log del servidor para poder investigarlo.
    if (e instanceof ErrorDeValidacion)
      return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('Error inesperado en la ruta de landscape:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
