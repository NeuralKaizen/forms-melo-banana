import type { AnyDb } from '@/lib/db/store'
import { listProjects, normalizeCompanyName } from '@/lib/db/store'
import { esUuidValido } from '@/lib/landscape/ids'
import { ErrorDeHerramienta } from './errores'

/**
 * Claude va a escribir el nombre de la marca como lo dijo la persona en el chat, no un
 * uuid. Si no acierta, el error lista los proyectos que existen: así corrige en el mismo
 * turno en vez de inventar un id.
 */
export async function resolverProyecto(db: AnyDb, ref: string): Promise<{ id: string; name: string }> {
  const buscado = (ref ?? '').trim()
  const proyectos = await listProjects(db)

  // `listProjects` devuelve solo { id, name }, así que la comparación normaliza el
  // nombre de cada proyecto en vez de leer `normalized_name` de la fila.
  const encontrado = esUuidValido(buscado)
    ? proyectos.find((p: { id: string }) => p.id === buscado)
    : proyectos.find((p: { name: string }) =>
        normalizeCompanyName(p.name) === normalizeCompanyName(buscado))

  if (encontrado) return { id: encontrado.id, name: encontrado.name }

  const lista = proyectos.map((p: { name: string }) => p.name).join(', ')
  throw new ErrorDeHerramienta(
    proyectos.length
      ? `No existe el proyecto “${buscado}”. Los que hay son: ${lista}.`
      : `No existe el proyecto “${buscado}”, y todavía no hay ninguno cargado.`,
  )
}
