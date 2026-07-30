import { describe, it, expect } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { makeTestDb } from './testdb'
import {
  createSession, saveAnswer, getSessionWithAnswers, completeSession, setNormalized,
  normalizeCompanyName, findOrCreateProject, assignSessionToProject,
  listProjects, getProjectWithSessions, saveDeliverable, getDeliverable,
  saveLandscapeVersion, setStageStatus, listLandscapeVersions,
  approveLandscapeVersion, getCurrentVersion, selectTendencias,
  landscapeState, listLandscapeActivity, ErrorDeValidacion,
} from './store'
import { answers, landscapeStages, landscapeVersions } from './schema'

type AnswerRow = typeof answers.$inferSelect

describe('store', () => {
  it('creates a session and reads it back', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, { name: 'Ana', company: 'Acme', role: 'CMO', email: 'a@x.com' })
    expect(s.id).toBeTruthy()
    expect(s.status).toBe('in_progress')
  })

  it('saves answers and completeSession flips status', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'Ana' })
    await saveAnswer(db, s.id, { questionId: 'animal', rawText: 'ágil', imageChoice: 'dolphin' })
    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.answers).toHaveLength(2)
    expect(full!.answers.find((a: AnswerRow) => a.questionId === 'animal')!.imageChoice).toBe('dolphin')

    const done = await completeSession(db, s.id)
    expect(done.status).toBe('completed')
    expect(done.completedAt).toBeTruthy()
  })

  it('re-answering the same question updates in place (no duplicate)', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, {})
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'primera' })
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'corregida' })
    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.answers).toHaveLength(1)
    expect(full!.answers[0].rawText).toBe('corregida')
  })

  it('setNormalized guarda normalized_text sin tocar raw_text', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, {})
    const a = await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'hola me llamo ana' })
    await setNormalized(db, a.id, 'Hola, me llamo Ana.')
    const full = await getSessionWithAnswers(db, s.id)
    const row = full!.answers.find((r: AnswerRow) => r.id === a.id)!
    expect(row.normalizedText).toBe('Hola, me llamo Ana.')
    expect(row.rawText).toBe('hola me llamo ana')
  })
})

describe('projects & deliverables', () => {
  it('normalizeCompanyName colapsa mayúsculas y espacios', () => {
    expect(normalizeCompanyName('  Going   SAS ')).toBe('going sas')
    expect(normalizeCompanyName('Cacao Hunters')).toBe('cacao hunters')
  })

  it('findOrCreateProject crea una vez y reusa por nombre normalizado', async () => {
    const db = await makeTestDb()
    const a = await findOrCreateProject(db, 'Going')
    const b = await findOrCreateProject(db, '  going  ')
    expect(b.id).toBe(a.id)
    expect((await listProjects(db))).toHaveLength(1)
  })

  it('assignSessionToProject agrupa sesiones y getProjectWithSessions las lista', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const s1 = await createSession(db, { company: 'Acme', name: 'Ana' })
    const s2 = await createSession(db, { company: 'Acme', name: 'Beto' })
    await assignSessionToProject(db, s1.id, p.id)
    await assignSessionToProject(db, s2.id, p.id)
    const pw = await getProjectWithSessions(db, p.id)
    expect(pw!.sessions).toHaveLength(2)
    expect(pw!.name).toBe('Acme')
  })

  it('saveDeliverable/getDeliverable persisten y hacen upsert', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveDeliverable(db, p.id, { problema: { data: { problemaMundo: 'x' }, meta: { generatedAt: 'T0' } } })
    let d = await getDeliverable(db, p.id)
    expect((d!.content as any).problema.data.problemaMundo).toBe('x')
    await saveDeliverable(db, p.id, { problema: { data: { problemaMundo: 'y' }, meta: { generatedAt: 'T1' } } })
    d = await getDeliverable(db, p.id)
    expect((d!.content as any).problema.data.problemaMundo).toBe('y')
  })
})

describe('landscape · esquema', () => {
  it('guarda una versión de etapa y la lee de vuelta', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const [v] = await db.insert(landscapeVersions).values({
      projectId: p.id,
      stage: 'tendencias',
      content: { candidatas: [] },
      author: 'claude',
    }).returning()
    expect(v.id).toBeTruthy()
    expect(v.approvedAt).toBeNull()
    expect(v.authorLabel).toBeNull()
  })

  it('una etapa es única por proyecto', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await db.insert(landscapeStages).values({ projectId: p.id, stage: 'contexto', status: 'en_curso' })
    await expect(
      db.insert(landscapeStages).values({ projectId: p.id, stage: 'contexto', status: 'aprobada' }),
    ).rejects.toThrow()
  })
})

describe('landscape · guardar versiones', () => {
  it('guardar la primera versión pone la etapa en curso', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', {
      content: { cifras: ['x'] }, author: 'claude',
    })
    expect(v.approvedAt).toBeNull()
    const [stage] = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, p.id))
    expect(stage.status).toBe('en_curso')
  })

  it('guardar no degrada una etapa ya aprobada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await setStageStatus(db, p.id, 'contexto', 'aprobada')
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'claude' })
    const [stage] = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, p.id))
    expect(stage.status).toBe('aprobada')
  })

  it('las versiones se acumulan, la más nueva primero', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await new Promise(r => setTimeout(r, 5))
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'humano', authorLabel: 'Isa' })
    await saveLandscapeVersion(db, p.id, 'tendencias', { content: { v: 9 }, author: 'claude' })

    const solo = await listLandscapeVersions(db, p.id, 'contexto')
    expect(solo).toHaveLength(2)
    expect((solo[0].content as { v: number }).v).toBe(2)
    expect(solo[0].authorLabel).toBe('Isa')
    expect(await listLandscapeVersions(db, p.id)).toHaveLength(3)
  })
})

describe('landscape · aprobar', () => {
  it('aprobar sella la versión y cierra la etapa', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    const aprobada = await approveLandscapeVersion(db, v.id)
    expect(aprobada.approvedAt).toBeTruthy()
    const [stage] = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, p.id))
    expect(stage.status).toBe('aprobada')
  })

  it('aprobar una versión que no existe explota', async () => {
    const db = await makeTestDb()
    await expect(
      approveLandscapeVersion(db, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(/no existe/i)
  })

  it('aprobar una versión que no existe es un ErrorDeValidacion (culpa del pedido)', async () => {
    const db = await makeTestDb()
    await expect(
      approveLandscapeVersion(db, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(ErrorDeValidacion)
  })

  it('getCurrentVersion prefiere la aprobada sobre un borrador posterior', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v1 = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v1.id)
    await new Promise(r => setTimeout(r, 5))
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'claude' })

    const actual = await getCurrentVersion(db, p.id, 'contexto')
    expect((actual!.content as { v: number }).v).toBe(1)
  })

  it('getCurrentVersion cae al borrador más nuevo si no hay ninguna aprobada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await new Promise(r => setTimeout(r, 5))
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'claude' })

    const actual = await getCurrentVersion(db, p.id, 'contexto')
    expect((actual!.content as { v: number }).v).toBe(2)
    expect(await getCurrentVersion(db, p.id, 'panorama')).toBeNull()
  })
})

describe('landscape · gate de tendencias', () => {
  const longList = {
    candidatas: [
      { id: 't1', eje: 'Marca', titulo: 'A', descripcion: '', fuentes: [] },
      { id: 't2', eje: 'Marca', titulo: 'B', descripcion: '', fuentes: [] },
      { id: 't3', eje: 'Estrategia', titulo: 'C', descripcion: '', fuentes: [] },
      { id: 't4', eje: 'Estrategia', titulo: 'D', descripcion: '', fuentes: [] },
      { id: 't5', eje: 'Comunicación', titulo: 'E', descripcion: '', fuentes: [] },
      { id: 't6', eje: 'Comunicación', titulo: 'F', descripcion: '', fuentes: [] },
    ],
  }

  async function conLongList() {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveLandscapeVersion(db, p.id, 'tendencias', { content: longList, author: 'claude' })
    return { db, p }
  }

  it('cuatro seleccionadas quedan aprobadas y conservan la long list', async () => {
    const { db, p } = await conLongList()
    const v = await selectTendencias(db, p.id, ['t1', 't3', 't4', 't5'], 'Isa')
    expect(v.approvedAt).toBeTruthy()
    expect(v.author).toBe('humano')
    expect(v.authorLabel).toBe('Isa')
    const content = v.content as { candidatas: unknown[]; seleccionadas: string[] }
    expect(content.seleccionadas).toEqual(['t1', 't3', 't4', 't5'])
    expect(content.candidatas).toHaveLength(6)

    const [stage] = await db.select().from(landscapeStages)
      .where(and(eq(landscapeStages.projectId, p.id), eq(landscapeStages.stage, 'tendencias')))
    expect(stage.status).toBe('aprobada')
  })

  it('tres es muy poco y seis es demasiado', async () => {
    const { db, p } = await conLongList()
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3'])).rejects.toThrow(/entre 4 y 5/i)
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3', 't4', 't5', 't6'])).rejects.toThrow(/entre 4 y 5/i)
  })

  it('no se puede repetir una tendencia en la selección', async () => {
    const { db, p } = await conLongList()
    await expect(selectTendencias(db, p.id, ['t1', 't1', 't2', 't3'])).rejects.toThrow(/repetid/i)
  })

  it('no se puede seleccionar algo que no está en la long list', async () => {
    const { db, p } = await conLongList()
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3', 'fantasma'])).rejects.toThrow(/fantasma/)
  })

  it('sin long list guardada no hay nada que seleccionar', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3', 't4'])).rejects.toThrow(/long list/i)
  })

  it('los cuatro rechazos del gate son ErrorDeValidacion (culpa del pedido)', async () => {
    const { db, p } = await conLongList()
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3'])).rejects.toBeInstanceOf(ErrorDeValidacion)
    await expect(selectTendencias(db, p.id, ['t1', 't1', 't2', 't3'])).rejects.toBeInstanceOf(ErrorDeValidacion)
    await expect(selectTendencias(db, p.id, ['t1', 't2', 't3', 'fantasma'])).rejects.toBeInstanceOf(ErrorDeValidacion)

    const sinLongList = await makeTestDb()
    const p2 = await findOrCreateProject(sinLongList, 'Otra')
    await expect(selectTendencias(sinLongList, p2.id, ['t1', 't2', 't3', 't4'])).rejects.toBeInstanceOf(ErrorDeValidacion)
  })
})

describe('landscape · lectura de estado', () => {
  it('siempre devuelve las seis etapas, en orden, aunque no haya nada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const estado = await landscapeState(db, p.id)
    expect(estado.map(e => e.stage)).toEqual(
      ['setup', 'contexto', 'tendencias', 'panorama', 'diagnostico', 'entrega'],
    )
    expect(estado.every(e => e.status === 'pendiente')).toBe(true)
    expect(estado.every(e => e.actual === null && e.versiones === 0)).toBe(true)
  })

  it('refleja versiones, aprobación y no_aplica', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v.id)
    await saveLandscapeVersion(db, p.id, 'tendencias', { content: { candidatas: [] }, author: 'claude' })
    await setStageStatus(db, p.id, 'diagnostico', 'no_aplica')

    const porEtapa = Object.fromEntries((await landscapeState(db, p.id)).map(e => [e.stage, e]))
    expect(porEtapa.contexto.status).toBe('aprobada')
    expect(porEtapa.contexto.aprobada).toBe(true)
    expect(porEtapa.contexto.versiones).toBe(1)
    expect(porEtapa.tendencias.status).toBe('en_curso')
    expect(porEtapa.tendencias.aprobada).toBe(false)
    expect(porEtapa.diagnostico.status).toBe('no_aplica')
    expect(porEtapa.entrega.status).toBe('pendiente')
  })

  it('la actividad sale de las versiones, sin tabla aparte', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', {
      content: { v: 1 }, author: 'claude',
    })
    await approveLandscapeVersion(db, v.id)

    const act = await listLandscapeActivity(db, p.id)
    expect(act).toHaveLength(2)
    expect(act[0].tipo).toBe('aprobado')
    expect(act[0].autor).toBe('humano')
    expect(act[1].tipo).toBe('guardado')
    expect(act[1].autor).toBe('claude')
    expect(act[1].stage).toBe('contexto')
  })

  it('la actividad respeta el límite', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    for (let i = 0; i < 5; i++) {
      await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: i }, author: 'claude' })
    }
    expect(await listLandscapeActivity(db, p.id, 3)).toHaveLength(3)
  })
})
