import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeTestDb } from './testdb'
import {
  createSession, saveAnswer, getSessionWithAnswers, completeSession, setNormalized,
  normalizeCompanyName, findOrCreateProject, assignSessionToProject,
  listProjects, getProjectWithSessions, saveDeliverable, getDeliverable,
  saveLandscapeVersion, setStageStatus, listLandscapeVersions,
  approveLandscapeVersion, getCurrentVersion,
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
