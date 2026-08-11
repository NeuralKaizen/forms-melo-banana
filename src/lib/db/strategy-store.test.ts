import { describe, it, expect, beforeEach } from 'vitest'
import { makeTestDb, type TestDb } from './testdb'
import { findOrCreateProject, ErrorNoEncontrado } from './store'
import {
  saveStrategyVersion, listStrategyVersions, approveStrategyVersion,
  strategyState, summarizeStrategy, setStrategyStageStatus,
} from './strategy-store'

let db: TestDb
let projectId: string

beforeEach(async () => {
  db = await makeTestDb()
  projectId = (await findOrCreateProject(db, 'Marca Test')).id
})

describe('saveStrategyVersion', () => {
  it('guarda un borrador y mueve la etapa a en_curso', async () => {
    const v = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'x', racional: 'y' }, author: 'claude' })
    expect(v.approvedAt).toBeNull()
    const estado = await strategyState(db, projectId)
    expect(estado.find(e => e.stage === 'concepto')?.status).toBe('en_curso')
  })

  it('sobre una etapa aprobada no la degrada: queda como borradorNuevo', async () => {
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
    await expect(saveStrategyVersion(db, '00000000-0000-4000-8000-000000000000', 'concepto', { content: {}, author: 'claude' }))
      .rejects.toBeInstanceOf(ErrorNoEncontrado)
  })
})

describe('approveStrategyVersion', () => {
  it('con versionId de otra etapa no aprueba nada (scope en el WHERE)', async () => {
    const v = await saveStrategyVersion(db, projectId, 'concepto', { content: { concepto: 'a', racional: 'b' }, author: 'claude' })
    await expect(approveStrategyVersion(db, v.id, { projectId, stage: 'arquetipo' }))
      .rejects.toBeInstanceOf(ErrorNoEncontrado)
  })
})

describe('strategyState / summarizeStrategy', () => {
  it('devuelve las 14 etapas aunque no haya filas', async () => {
    expect(await strategyState(db, projectId)).toHaveLength(14)
  })

  it('no_aplica no cuenta ni en aprobadas ni en total', async () => {
    await setStrategyStageStatus(db, projectId, 'manifiesto', 'no_aplica')
    const resumen = summarizeStrategy(await strategyState(db, projectId))
    expect(resumen.total).toBe(13)
    expect(resumen.aprobadas).toBe(0)
  })
})

describe('listStrategyVersions', () => {
  it('viene de la más nueva a la más vieja', async () => {
    await saveStrategyVersion(db, projectId, 'rtbs', { content: { items: ['1'] }, author: 'claude' })
    const v2 = await saveStrategyVersion(db, projectId, 'rtbs', { content: { items: ['2'] }, author: 'claude' })
    const lista = await listStrategyVersions(db, projectId, 'rtbs')
    expect(lista).toHaveLength(2)
    expect(lista[0].id).toBe(v2.id)
  })
})
