import { describe, it, expect } from 'vitest'
import { makeTestDb } from '@/lib/db/testdb'
import { findOrCreateProject, landscapeState, listLandscapeVersions, approveLandscapeVersion, saveLandscapeVersion } from '@/lib/db/store'
import { ErrorDeHerramienta } from './errores'
import { listarProyectos, contextoProyecto, estadoLandscape, guardarEtapa } from './tools'

describe('mcp · herramientas', () => {
  it('lista los proyectos con su avance', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    const lista = await listarProyectos(db)
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ nombre: 'Fruta Viva', landscape: { aprobadas: 0, total: 6 } })
  })

  it('el contexto trae la marca y el estado del landscape', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    const ctx = await contextoProyecto(db, 'Fruta Viva')
    expect(ctx.marca).toBe('Fruta Viva')
    expect(ctx.landscape).toHaveLength(6)
  })

  it('guardar_etapa crea un borrador, nunca algo aprobado', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    await guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'contexto', contenido: { datos: 'x' } })

    const versiones = await listLandscapeVersions(db, p.id, 'contexto')
    expect(versiones).toHaveLength(1)
    expect(versiones[0].approvedAt).toBeNull()
    expect(versiones[0].author).toBe('claude')
  })

  it('sobre una etapa aprobada, no la pisa ni la reabre', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { datos: 'viejo' }, author: 'humano' })
    await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })

    const r = await guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'contexto', contenido: { datos: 'nuevo' } })

    const estado = (await landscapeState(db, p.id)).find(e => e.stage === 'contexto')!
    expect(estado.status).toBe('aprobada')
    expect(estado.borradorNuevo).not.toBeNull()
    expect(r.esperandoAprobacion).toBe(true)
  })

  it('rechaza una etapa que no existe, y dice cuáles hay', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    await expect(guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'inventada', contenido: {} }))
      .rejects.toThrow(ErrorDeHerramienta)
  })

  it('rechaza una long list mal formada antes de tocar la base', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    await expect(guardarEtapa(db, {
      proyecto: 'Fruta Viva', etapa: 'tendencias', contenido: { candidatas: [{ titulo: 'sin id' }] },
    })).rejects.toThrow(ErrorDeHerramienta)
    expect(await listLandscapeVersions(db, p.id, 'tendencias')).toHaveLength(0)
  })

  it('estado_landscape marca las seis etapas', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    const estado = await estadoLandscape(db, 'Fruta Viva')
    expect(estado.etapas).toHaveLength(6)
    expect(estado.etapas[0]).toMatchObject({ etapa: 'setup', estado: 'pendiente' })
  })
})
