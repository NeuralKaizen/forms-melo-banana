import { describe, it, expect } from 'vitest'
import { makeTestDb } from '@/lib/db/testdb'
import {
  findOrCreateProject, landscapeState, listLandscapeVersions, approveLandscapeVersion,
  saveLandscapeVersion, createSession, assignSessionToProject,
} from '@/lib/db/store'
import { STAGE_ORDER } from '@/lib/landscape/stages'
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

  it('el contexto trae nombre, empresa y rol de la entrevista, pero nunca el email', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    const s = await createSession(db, {
      name: 'Ana', company: 'Fruta Viva', role: 'Marketing', email: 'ana@frutaviva.com',
    })
    await assignSessionToProject(db, s.id, p.id)

    const ctx = await contextoProyecto(db, 'Fruta Viva')
    expect(ctx.entrevistas).toHaveLength(1)
    expect(ctx.entrevistas[0]).toMatchObject({ nombre: 'Ana', empresa: 'Fruta Viva', rol: 'Marketing' })
    expect(ctx.entrevistas[0]).not.toHaveProperty('email')
    expect(JSON.stringify(ctx.entrevistas[0])).not.toContain('ana@frutaviva.com')
  })

  it('guardar_etapa crea un borrador, nunca algo aprobado', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    const r = await guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'contexto', contenido: { datos: 'x' } })

    const versiones = await listLandscapeVersions(db, p.id, 'contexto')
    expect(versiones).toHaveLength(1)
    expect(versiones[0].approvedAt).toBeNull()
    expect(versiones[0].author).toBe('claude')

    expect(r.mensaje).toContain('Guardé un borrador de Contexto del sector')
    expect(r.mensaje).toContain('la aprueba desde el panel')
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
    // Lo que manda para quien lea el proyecto sigue siendo lo aprobado, no lo que
    // Claude acaba de escribir: la regla que este proyecto no puede romper.
    expect(estado.actual?.content).toEqual({ datos: 'viejo' })
    expect(r.esperandoAprobacion).toBe(true)
    expect(r.mensaje).toContain('No pisé nada')
    expect(r.mensaje).toContain('sigue aprobada')
  })

  it('rechaza una etapa que no existe, y dice cuáles hay', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    await expect(guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'inventada', contenido: {} }))
      .rejects.toThrow(ErrorDeHerramienta)

    try {
      await guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'inventada', contenido: {} })
      expect.unreachable('guardarEtapa debería haber rechazado')
    } catch (e) {
      const error = e as ErrorDeHerramienta
      for (const etapa of STAGE_ORDER) expect(error.message).toContain(etapa)
    }
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

  it('estado_landscape no manda a aprobar una etapa que todavía no tiene nada escrito', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    const estado = await estadoLandscape(db, 'Fruta Viva')

    const setup = estado.etapas.find(e => e.etapa === 'setup')!
    expect(setup.versiones).toBe(0)
    expect(setup.bloqueo).not.toContain('apruebe')
    expect(setup.bloqueo).toContain('Todavía no hay ningún borrador')

    const tendencias = estado.etapas.find(e => e.etapa === 'tendencias')!
    expect(tendencias.versiones).toBe(0)
    expect(tendencias.bloqueo).not.toContain('elija 4 o 5')
    expect(tendencias.bloqueo).toContain('Todavía no hay una long list')
  })
})
