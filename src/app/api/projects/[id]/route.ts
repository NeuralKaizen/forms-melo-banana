import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { renameProject, deleteProject, ErrorDeValidacion, ErrorNoEncontrado } from '@/lib/db/store'
import { isValidAdminToken } from '@/lib/admin/auth'
import { esUuidValido } from '@/lib/landscape/ids'

/**
 * Renombrar y borrar piden la cookie de admin aunque el resto de las rutas del panel no
 * la chequeen: borrar un proyecto es irreversible y el proxy solo protege las páginas
 * de `/admin`, no `/api`. Se parsea el header a mano para que la ruta se pueda testear
 * con un `Request` pelado.
 */
function esAdmin(req: Request): boolean {
  const cookie = req.headers.get('cookie') ?? ''
  const token = cookie.split(/;\s*/).find(c => c.startsWith('admin='))?.slice('admin='.length)
  return isValidAdminToken(token === undefined ? undefined : decodeURIComponent(token))
}

function conErrores(e: unknown): NextResponse {
  if (e instanceof ErrorDeValidacion) return NextResponse.json({ error: e.message }, { status: 400 })
  if (e instanceof ErrorNoEncontrado) return NextResponse.json({ error: e.message }, { status: 404 })
  throw e
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!esAdmin(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  if (!esUuidValido(id)) return NextResponse.json({ error: `Id de proyecto inválido: ${id}` }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  if (typeof body?.name !== 'string')
    return NextResponse.json({ error: 'falta name' }, { status: 400 })
  try {
    return NextResponse.json(await renameProject(db, id, body.name))
  } catch (e) {
    return conErrores(e)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!esAdmin(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  if (!esUuidValido(id)) return NextResponse.json({ error: `Id de proyecto inválido: ${id}` }, { status: 400 })
  try {
    const { sesionesBorradas } = await deleteProject(db, id)
    return NextResponse.json({ ok: true, sesionesBorradas })
  } catch (e) {
    return conErrores(e)
  }
}
