import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testdb'
import {
  createSession, saveAnswer, getSessionWithAnswers, completeSession, setNormalized,
  normalizeCompanyName, findOrCreateProject, assignSessionToProject,
  listProjects, getProjectWithSessions, saveDeliverable, getDeliverable,
} from './store'
import { answers } from './schema'

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
