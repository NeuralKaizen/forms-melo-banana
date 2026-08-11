import { describe, it, expect, beforeEach } from 'vitest'
import { makeTestDb, type TestDb } from '@/lib/db/testdb'
import {
  findOrCreateProject, landscapeState, listLandscapeVersions, approveLandscapeVersion,
  saveLandscapeVersion, createSession, assignSessionToProject,
} from '@/lib/db/store'
import { strategyState, approveStrategyVersion } from '@/lib/db/strategy-store'
import { STAGE_ORDER } from '@/lib/landscape/stages'
import { ErrorDeHerramienta } from './errores'
import { listarProyectos, contextoProyecto, estadoLandscape, estadoEstrategia, guardarEtapa } from './tools'

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

  it('estado_landscape no se contradice: hayBorradorEsperandoAprobacion coincide con el bloqueo', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')

    // Etapa vacía: nada esperando.
    const vacio = (await estadoLandscape(db, 'Fruta Viva')).etapas.find(e => e.etapa === 'contexto')!
    expect(vacio.hayBorradorEsperandoAprobacion).toBe(false)

    // Borrador guardado, todavía sin aprobar: sí está esperando el gate.
    await guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'contexto', contenido: { datos: 'x' } })
    const conBorrador = (await estadoLandscape(db, 'Fruta Viva')).etapas.find(e => e.etapa === 'contexto')!
    expect(conBorrador.hayBorradorEsperandoAprobacion).toBe(true)

    // Aprobada, y encima llega un borrador más nuevo: sigue esperando el gate.
    const versiones = await listLandscapeVersions(db, p.id, 'contexto')
    await approveLandscapeVersion(db, versiones[0].id, { projectId: p.id, stage: 'contexto' })
    await guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'contexto', contenido: { datos: 'y' } })
    const aprobadaConBorradorNuevo = (await estadoLandscape(db, 'Fruta Viva')).etapas.find(e => e.etapa === 'contexto')!
    expect(aprobadaConBorradorNuevo.hayBorradorEsperandoAprobacion).toBe(true)
  })
})

describe('guardarEtapa con fase estrategia', () => {
  let db: TestDb
  let projectId: string

  beforeEach(async () => {
    db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Marca Test')
    projectId = p.id
  })

  it('clave inválida lista las etapas de estrategia', async () => {
    await expect(guardarEtapa(db, { proyecto: 'Marca Test', etapa: 'setup', contenido: {}, fase: 'estrategia' }))
      // Equivalente a /diagnostico.*cuadros/s (dotAll): el target ES2017 del tsconfig
      // no admite el flag 's' en un literal de regex (TS1501).
      .rejects.toThrow(/diagnostico[\s\S]*cuadros/)
  })

  it('contenido inválido no deja rastro', async () => {
    await expect(guardarEtapa(db, { proyecto: 'Marca Test', etapa: 'concepto', contenido: { concepto: 'x' }, fase: 'estrategia' }))
      .rejects.toBeInstanceOf(ErrorDeHerramienta)
    const estado = await strategyState(db, projectId)
    expect(estado.find(e => e.stage === 'concepto')?.versiones).toBe(0)
  })

  it('camino feliz: borrador esperando aprobación', async () => {
    const r = await guardarEtapa(db, {
      proyecto: 'Marca Test', etapa: 'concepto',
      contenido: { concepto: 'c', racional: 'r' }, fase: 'estrategia',
    })
    expect(r.esperandoAprobacion).toBe(true)
    expect(r.etapa).toBe('concepto')
  })

  it('cuadros con esencia sin aprobar avisa sin bloquear', async () => {
    const r = await guardarEtapa(db, {
      proyecto: 'Marca Test', etapa: 'cuadros',
      contenido: { brandEssence: { proposito: 'p' }, consumidor: { jtbd: 'j' } }, fase: 'estrategia',
    })
    expect(r.mensaje).toMatch(/aviso, no un bloqueo/)
  })

  it('sin fase sigue siendo landscape puro (regresión)', async () => {
    await expect(guardarEtapa(db, { proyecto: 'Marca Test', etapa: 'concepto', contenido: {} }))
      .rejects.toThrow(/no es una etapa del landscape/)
  })
})

describe('estadoEstrategia', () => {
  let db: TestDb

  beforeEach(async () => {
    db = await makeTestDb()
    await findOrCreateProject(db, 'Marca Test')
  })

  it('con cero versiones el bloqueo dice que falta el borrador, no manda al panel', async () => {
    const r = await estadoEstrategia(db, 'Marca Test')
    expect(r.etapas).toHaveLength(14)
    expect(r.etapas[0].bloqueo).toMatch(/no hay ningún borrador/)
    expect(r.etapas[0].hayBorradorEsperandoAprobacion).toBe(false)
  })

  it('con un borrador guardado pide aprobación desde el panel', async () => {
    await guardarEtapa(db, {
      proyecto: 'Marca Test', etapa: 'concepto',
      contenido: { concepto: 'c', racional: 'r' }, fase: 'estrategia',
    })
    const etapa = (await estadoEstrategia(db, 'Marca Test')).etapas.find(e => e.etapa === 'concepto')!
    expect(etapa.hayBorradorEsperandoAprobacion).toBe(true)
    expect(etapa.bloqueo).toMatch(/apruebe/)
  })
})

describe('contextoProyecto con estrategia', () => {
  let db: TestDb
  let projectId: string

  beforeEach(async () => {
    db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Marca Test')
    projectId = p.id
  })

  it('incluye solo el contenido aprobado', async () => {
    const r1 = await guardarEtapa(db, {
      proyecto: 'Marca Test', etapa: 'concepto',
      contenido: { concepto: 'c', racional: 'r' }, fase: 'estrategia',
    })
    let ctx = await contextoProyecto(db, 'Marca Test')
    expect(ctx.estrategia.find((e: { etapa: string }) => e.etapa === 'concepto')?.contenidoAprobado).toBeNull()

    await approveStrategyVersion(db, r1.versionId, { projectId, stage: 'concepto' })
    ctx = await contextoProyecto(db, 'Marca Test')
    expect(ctx.estrategia.find((e: { etapa: string }) => e.etapa === 'concepto')?.contenidoAprobado)
      .toEqual({ concepto: 'c', racional: 'r' })
  })
})
