import { describe, it, expect } from 'vitest'
import { makeTestDb, type TestDb } from './testdb'
import { findOrCreateProject, ErrorNoEncontrado } from './store'
import {
  saveStrategyVersion, listStrategyVersions, approveStrategyVersion,
  strategyState, summarizeStrategy, setStrategyStageStatus, reafirmarAprobadaEstrategia,
} from './strategy-store'
import { esperanDecision } from '@/lib/pipeline/indice'

let db: TestDb
let projectId: string

/**
 * El montaje va al principio de cada test y no en un `beforeEach`. Es el mismo trabajo, pero
 * en el cuerpo del test corre con el presupuesto de `testTimeout` (30s) en vez del de
 * `hookTimeout` (10s). Era el único de los seis archivos de base que montaba dentro de un
 * hook, y por eso el único que se vencía cuando la máquina estaba cargada: el cold boot de
 * PGlite mide 2s con la máquina libre y se estira a 12-16s con varios forks levantando
 * Postgres-en-WASM a la vez.
 */
async function montarBase() {
  db = await makeTestDb()
  projectId = (await findOrCreateProject(db, 'Marca Test')).id
}

describe('saveStrategyVersion', () => {
  it('guarda un borrador y mueve la etapa a en_curso', async () => {
    await montarBase()
    const v = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'x', racional: 'y' }, author: 'claude' })
    expect(v.approvedAt).toBeNull()
    const estado = await strategyState(db, projectId)
    expect(estado.find(e => e.stage === 'concepto')?.status).toBe('en_curso')
  })

  it('sobre una etapa aprobada no la degrada: queda como borradorNuevo', async () => {
    await montarBase()
    const v1 = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'a', racional: 'b' }, author: 'claude' })
    await approveStrategyVersion(db, v1.id, { projectId, stage: 'concepto' })
    await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'c', racional: 'd' }, author: 'claude' })
    const etapa = (await strategyState(db, projectId)).find(e => e.stage === 'concepto')!
    expect(etapa.status).toBe('aprobada')
    expect(etapa.aprobada).toBe(true)
    expect(etapa.borradorNuevo).not.toBeNull()
    expect(etapa.actual?.id).toBe(v1.id) // la aprobada manda
  })

  it('proyecto inexistente tira ErrorNoEncontrado', async () => {
    await montarBase()
    await expect(saveStrategyVersion(db, '00000000-0000-4000-8000-000000000000', 'concepto', { content: {}, author: 'claude' }))
      .rejects.toBeInstanceOf(ErrorNoEncontrado)
  })
})

describe('approveStrategyVersion', () => {
  it('con versionId de otra etapa no aprueba nada (scope en el WHERE)', async () => {
    await montarBase()
    const v = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'a', racional: 'b' }, author: 'claude' })
    await expect(approveStrategyVersion(db, v.id, { projectId, stage: 'arquetipo' }))
      .rejects.toBeInstanceOf(ErrorNoEncontrado)
  })
})

describe('strategyState / summarizeStrategy', () => {
  it('devuelve las 14 etapas aunque no haya filas', async () => {
    await montarBase()
    expect(await strategyState(db, projectId)).toHaveLength(14)
  })

  it('no_aplica no cuenta ni en aprobadas ni en total', async () => {
    await montarBase()
    await setStrategyStageStatus(db, projectId, 'manifiesto', 'no_aplica')
    const resumen = summarizeStrategy(await strategyState(db, projectId))
    expect(resumen.total).toBe(13)
    expect(resumen.aprobadas).toBe(0)
  })
})

/** Espejo del caso de landscape: el equipo se queda con lo aprobado, y queda escrito. */
describe('reafirmarAprobadaEstrategia', () => {
  const aprobado = { concepto: 'a', racional: 'b' }

  async function conConflicto() {
    const v1 = await saveStrategyVersion(db, projectId, 'concepto', { content: aprobado, author: 'claude' })
    await approveStrategyVersion(db, v1.id, { projectId, stage: 'concepto' })
    const deClaude = await saveStrategyVersion(db, projectId, 'concepto', {
      content: { concepto: 'c', racional: 'd' }, author: 'claude',
    })
    return { v1, deClaude }
  }

  it('disuelve el conflicto sin borrar el borrador de Claude', async () => {
    await montarBase()
    const { deClaude } = await conConflicto()
    await reafirmarAprobadaEstrategia(db, projectId, 'concepto', 'Flor')

    const etapa = (await strategyState(db, projectId)).find(e => e.stage === 'concepto')!
    expect(etapa.borradorNuevo).toBeNull()
    expect(etapa.actual!.content).toEqual(aprobado)
    expect(etapa.actual!.approvedAt).toBeTruthy()
    expect(etapa.versiones).toBe(3)
    expect((await listStrategyVersions(db, projectId, 'concepto')).map(v => v.id)).toContain(deClaude.id)
  })

  it('la etapa reafirmada deja de esperar una decisión del equipo', async () => {
    await montarBase()
    await conConflicto()
    expect(esperanDecision('estrategia', await strategyState(db, projectId))).toContain('estrategia:concepto')

    await reafirmarAprobadaEstrategia(db, projectId, 'concepto')

    expect(esperanDecision('estrategia', await strategyState(db, projectId))).not.toContain('estrategia:concepto')
  })

  it('la procedencia sale de la versión copiada: el origen es la aprobada de antes', async () => {
    await montarBase()
    const { v1 } = await conConflicto()
    await reafirmarAprobadaEstrategia(db, projectId, 'concepto')
    const etapa = (await strategyState(db, projectId)).find(e => e.stage === 'concepto')!
    expect(etapa.origen!.id).toBe(v1.id)
  })

  it('sin conflicto no agrega ninguna fila', async () => {
    await montarBase()
    const v1 = await saveStrategyVersion(db, projectId, 'concepto', { content: aprobado, author: 'claude' })
    await approveStrategyVersion(db, v1.id, { projectId, stage: 'concepto' })

    expect(await reafirmarAprobadaEstrategia(db, projectId, 'concepto')).toBeNull()
    expect((await strategyState(db, projectId)).find(e => e.stage === 'concepto')!.versiones).toBe(1)
  })

  it('un proyecto que no existe tira ErrorNoEncontrado', async () => {
    await montarBase()
    await expect(reafirmarAprobadaEstrategia(db, '00000000-0000-4000-8000-000000000000', 'concepto'))
      .rejects.toBeInstanceOf(ErrorNoEncontrado)
  })
})

describe('listStrategyVersions', () => {
  it('viene de la más nueva a la más vieja', async () => {
    await montarBase()
    await saveStrategyVersion(db, projectId, 'rtbs', { content: { items: ['1'] }, author: 'claude' })
    // Dos guardados en el mismo milisegundo empatan en created_at, y el desempate por id
    // es un uuid aleatorio que no conserva orden de creación: el test flakeaba según la
    // carga de la máquina. La separación real entre versiones es siempre mayor a un tick.
    await new Promise(r => setTimeout(r, 2))
    const v2 = await saveStrategyVersion(db, projectId, 'rtbs', { content: { items: ['2'] }, author: 'claude' })
    const lista = await listStrategyVersions(db, projectId, 'rtbs')
    expect(lista).toHaveLength(2)
    expect(lista[0].id).toBe(v2.id)
  })
})
