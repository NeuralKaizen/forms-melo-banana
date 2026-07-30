import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { saveLandscapeVersion, approveLandscapeVersion, selectTendencias } from '@/lib/db/store'
import { STAGE_ORDER, type StageKey } from '@/lib/landscape/stages'

export async function POST(req: Request, { params }: { params: Promise<{ id: string; stage: string }> }) {
  const { id, stage } = await params
  if (!STAGE_ORDER.includes(stage as StageKey))
    return NextResponse.json({ error: `Etapa desconocida: ${stage}` }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'El body tiene que ser JSON' }, { status: 400 })
  }

  try {
    switch (body.accion) {
      case 'guardar': {
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
    // Los errores del gate (4 o 5 tendencias, ids que no existen) son culpa del pedido.
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}
