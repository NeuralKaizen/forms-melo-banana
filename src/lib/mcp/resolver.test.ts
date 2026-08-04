import { describe, it, expect } from 'vitest'
import { makeTestDb } from '@/lib/db/testdb'
import { findOrCreateProject } from '@/lib/db/store'
import { ErrorDeHerramienta } from './errores'
import { resolverProyecto } from './resolver'

describe('mcp · resolver proyecto', () => {
  it('encuentra por nombre exacto', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    expect(await resolverProyecto(db, 'Fruta Viva')).toEqual({ id: p.id, name: 'Fruta Viva' })
  })

  it('encuentra sin importar mayúsculas ni espacios de más', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    expect((await resolverProyecto(db, '  fruta viva ')).id).toBe(p.id)
  })

  it('encuentra por id', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    expect((await resolverProyecto(db, p.id)).id).toBe(p.id)
  })

  it('cuando no existe, el error lista los que sí', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    await findOrCreateProject(db, 'Cafe Lunar')
    await expect(resolverProyecto(db, 'Inexistente')).rejects.toThrow(ErrorDeHerramienta)
    await expect(resolverProyecto(db, 'Inexistente')).rejects.toThrow(/Fruta Viva/)
    await expect(resolverProyecto(db, 'Inexistente')).rejects.toThrow(/Cafe Lunar/)
  })

  it('un uuid con forma válida que no existe también avisa', async () => {
    const db = await makeTestDb()
    await expect(resolverProyecto(db, '00000000-0000-4000-8000-000000000000'))
      .rejects.toThrow(ErrorDeHerramienta)
  })
})
