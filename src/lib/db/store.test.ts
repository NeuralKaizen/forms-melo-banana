import { describe, it, expect } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { makeTestDb, makeFreshTestDb } from './testdb'
import {
  createSession, saveAnswer, getSessionWithAnswers, completeSession, setNormalized,
  normalizeCompanyName, findOrCreateProject, assignSessionToProject,
  listProjects, getProjectWithSessions, saveDeliverable, getDeliverable,
  renameProject, deleteProject,
  saveLandscapeVersion, setStageStatus, listLandscapeVersions,
  approveLandscapeVersion, getCurrentVersion, selectTendencias,
  landscapeState, listLandscapeActivity, summarizeLandscape, reafirmarAprobada, versionDeOrigen,
  ErrorDeValidacion, ErrorNoEncontrado,
} from './store'
import { esperanDecision } from '@/lib/pipeline/indice'
import { procedenciaDeVersion } from '@/lib/pipeline/procedencia'
import { haceCuanto } from '@/lib/landscape/stages'
import { answers, landscapeStages, landscapeVersions, oauthClients, oauthCodes, oauthTokens } from './schema'

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

  it('completar de nuevo no devuelve fila ni pisa completedAt', async () => {
    const db = await makeTestDb()
    const s = await createSession(db, {})
    const primera = await completeSession(db, s.id)
    expect(await completeSession(db, s.id)).toBeUndefined()
    const full = await getSessionWithAnswers(db, s.id)
    expect(full!.completedAt).toEqual(primera.completedAt)
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

  it('renombrar cambia el nombre mostrado y también la clave de agrupación', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Vieja Marca')
    const renombrado = await renameProject(db, p.id, '  Nueva Marca  ')
    expect(renombrado.name).toBe('Nueva Marca')
    // La próxima entrevista que tipee el nombre nuevo cae acá, no en un duplicado.
    expect((await findOrCreateProject(db, 'nueva marca')).id).toBe(p.id)
  })

  it('renombrar hacia el nombre de otro proyecto se rechaza como validación', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Ocupado')
    const p = await findOrCreateProject(db, 'Libre')
    await expect(renameProject(db, p.id, ' OCUPADO ')).rejects.toBeInstanceOf(ErrorDeValidacion)
    await expect(renameProject(db, p.id, '   ')).rejects.toBeInstanceOf(ErrorDeValidacion)
    await expect(renameProject(db, '00000000-0000-4000-8000-000000000000', 'X')).rejects.toBeInstanceOf(ErrorNoEncontrado)
  })

  it('borrar el proyecto se lleva entrevistas, respuestas y versiones, y libera el nombre', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Efímero')
    const s = await createSession(db, { name: 'Ana', company: 'Efímero' })
    await assignSessionToProject(db, s.id, p.id)
    await saveAnswer(db, s.id, { questionId: 'nombre', rawText: 'Ana' })
    await saveDeliverable(db, p.id, { x: 1 })
    await saveLandscapeVersion(db, p.id, 'setup', { content: { a: 1 }, author: 'claude' })

    const { sesionesBorradas } = await deleteProject(db, p.id)
    expect(sesionesBorradas).toBe(1)
    expect(await getProjectWithSessions(db, p.id)).toBeNull()
    expect(await getSessionWithAnswers(db, s.id)).toBeNull()
    // El nombre queda libre: crear de nuevo es un proyecto nuevo, sin historia.
    const otraVez = await findOrCreateProject(db, 'Efímero')
    expect(otraVez.id).not.toBe(p.id)
    expect(await listLandscapeVersions(db, otraVez.id)).toHaveLength(0)

    await expect(deleteProject(db, p.id)).rejects.toBeInstanceOf(ErrorNoEncontrado)
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
    const aprobada = await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })
    expect(aprobada.approvedAt).toBeTruthy()
    const [stage] = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, p.id))
    expect(stage.status).toBe('aprobada')
  })

  it('aprobar una versión que no existe explota', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await expect(
      approveLandscapeVersion(db, '00000000-0000-0000-0000-000000000000', { projectId: p.id, stage: 'contexto' }),
    ).rejects.toThrow(/no existe/i)
  })

  it('aprobar una versión que no existe es un ErrorNoEncontrado (el recurso no está, no un pedido mal formado)', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await expect(
      approveLandscapeVersion(db, '00000000-0000-0000-0000-000000000000', { projectId: p.id, stage: 'contexto' }),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado)
  })

  it('aprobar no confía en el versionId del pedido: la versión tiene que ser de ese proyecto y esa etapa', async () => {
    const db = await makeTestDb()
    const propia = await findOrCreateProject(db, 'Acme')
    const ajeno = await findOrCreateProject(db, 'Otra marca')
    const v = await saveLandscapeVersion(db, propia.id, 'contexto', { content: { v: 1 }, author: 'claude' })

    // Mismo proyecto, otra etapa: tampoco matchea.
    await expect(
      approveLandscapeVersion(db, v.id, { projectId: propia.id, stage: 'tendencias' }),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado)
    // Otro proyecto entero: el caso del bug real (POST a /landscape/A con un versionId de B).
    await expect(
      approveLandscapeVersion(db, v.id, { projectId: ajeno.id, stage: 'contexto' }),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado)

    // Ninguno de los dos intentos aprobó nada: la versión sigue siendo un borrador.
    const [sinAprobar] = await listLandscapeVersions(db, propia.id, 'contexto')
    expect(sinAprobar.approvedAt).toBeNull()
    const [stageAjeno] = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, ajeno.id))
    expect(stageAjeno).toBeUndefined()
  })

  it('getCurrentVersion prefiere la aprobada sobre un borrador posterior', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v1 = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v1.id, { projectId: p.id, stage: 'contexto' })
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

    // Instancia aparte y no la compartida: acá conviven dos bases en el mismo test y la de
    // arriba tiene que seguir con su long list intacta.
    const sinLongList = await makeFreshTestDb()
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
    await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })
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

  it('summarizeLandscape no cuenta no_aplica ni como pendiente ni como aprobada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })
    await setStageStatus(db, p.id, 'diagnostico', 'no_aplica')

    // Seis etapas en total; 'diagnostico' no aplica, así que sale de la cuenta en los
    // dos lados: quedan 5 aplicables, de las que solo 'contexto' está aprobada.
    const resumen = summarizeLandscape(await landscapeState(db, p.id))
    expect(resumen).toEqual({ aprobadas: 1, total: 5 })
  })

  it('la actividad sale de las versiones, sin tabla aparte', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', {
      content: { v: 1 }, author: 'claude',
    })
    await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })

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

/**
 * El caso normal de uso una vez que Claude escribe por MCP: la etapa ya está aprobada
 * y llega trabajo nuevo. Regla: lo aprobado sigue mandando —una escritura desde un chat
 * nunca pisa una decisión humana— pero el borrador nuevo no queda escondido.
 */
describe('landscape · borrador sobre etapa aprobada', () => {
  it('sin ninguna aprobada, el borrador más nuevo es el actual y no hay borrador pendiente', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    const v2 = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'claude' })

    const [etapa] = (await landscapeState(db, p.id)).filter(e => e.stage === 'contexto')
    expect(etapa.actual!.id).toBe(v2.id)
    expect(etapa.borradorNuevo).toBeNull()
  })

  it('con una aprobada y nada nuevo encima, no hay borrador pendiente', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })

    const [etapa] = (await landscapeState(db, p.id)).filter(e => e.stage === 'contexto')
    expect(etapa.actual!.id).toBe(v.id)
    expect(etapa.borradorNuevo).toBeNull()
  })

  it('un borrador posterior no desplaza a la aprobada ni reabre la etapa, pero queda visible', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const aprobada = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, aprobada.id, { projectId: p.id, stage: 'contexto' })
    const nueva = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'claude' })

    const [etapa] = (await landscapeState(db, p.id)).filter(e => e.stage === 'contexto')
    // Lo aprobado sigue mandando: ni el contenido ni el estado se mueven solos.
    expect(etapa.actual!.id).toBe(aprobada.id)
    expect(etapa.status).toBe('aprobada')
    expect(etapa.aprobada).toBe(true)
    // Y lo nuevo no se pierde de vista.
    expect(etapa.borradorNuevo!.id).toBe(nueva.id)
    expect(etapa.versiones).toBe(2)
  })

  it('aprobar el borrador nuevo lo vuelve el actual y deja de haber pendiente', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const vieja = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, vieja.id, { projectId: p.id, stage: 'contexto' })
    const nueva = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 2 }, author: 'claude' })
    await approveLandscapeVersion(db, nueva.id, { projectId: p.id, stage: 'contexto' })

    const [etapa] = (await landscapeState(db, p.id)).filter(e => e.stage === 'contexto')
    expect(etapa.actual!.id).toBe(nueva.id)
    expect(etapa.borradorNuevo).toBeNull()
  })

  it('un borrador de otra etapa no cuenta como pendiente de la etapa aprobada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })
    await saveLandscapeVersion(db, p.id, 'tendencias', { content: { candidatas: [] }, author: 'claude' })

    const porEtapa = Object.fromEntries((await landscapeState(db, p.id)).map(e => [e.stage, e]))
    expect(porEtapa.contexto.borradorNuevo).toBeNull()
  })
})

/**
 * No adivina “esto es una ratificación”: contesta cuándo apareció por primera vez este
 * texto, que es una pregunta con respuesta exacta en la tabla. Va sin base porque es una
 * función pura, y corre por cada etapa de cada proyecto de la barra lateral.
 */
describe('versionDeOrigen', () => {
  const v = (id: string, content: unknown) => ({ id, content })

  it('devuelve la más vieja que escribió ese contenido, aunque haya otra en el medio', () => {
    const vieja = v('a', { t: 1 })
    const media = v('b', { t: 2 })
    const nueva = v('c', { t: 1 })
    expect(versionDeOrigen(nueva, [nueva, media, vieja])).toBe(vieja)
  })

  it('el orden de las claves no cuenta: vienen de una columna jsonb', () => {
    const vieja = v('a', { x: 1, y: 2 })
    const nueva = v('b', { y: 2, x: 1 })
    expect(versionDeOrigen(nueva, [nueva, vieja])).toBe(vieja)
  })

  it('un contenido que aparece por primera vez no tiene origen', () => {
    const vieja = v('a', { t: 1 })
    const nueva = v('b', { t: 2 })
    expect(versionDeOrigen(nueva, [nueva, vieja])).toBeNull()
  })

  it('con una sola versión, o con ninguna, no hay nada anterior que buscar', () => {
    const sola = v('a', { t: 1 })
    expect(versionDeOrigen(sola, [sola])).toBeNull()
    expect(versionDeOrigen(null, [])).toBeNull()
  })

  it('una versión que no está en la lista no se inventa un origen', () => {
    // La función se exporta: sin el corte, `indexOf` daría -1, el recorrido se llevaría la
    // lista entera y devolvería como origen algo que ni siquiera es anterior.
    const ajena = v('x', { t: 1 })
    expect(versionDeOrigen(ajena, [v('a', { t: 1 }), v('b', { t: 1 })])).toBeNull()
  })
})

/**
 * La otra salida del conflicto: el equipo mira el borrador y se queda con lo aprobado.
 * “Mantener” no borra nada —la tabla es append-only—: appendea una ratificación aprobada
 * con el contenido de la vigente, y el conflicto se disuelve por la regla de siempre.
 */
describe('landscape · mantener la aprobada', () => {
  const contenidoAprobado = { territorio: 'El café de barrio' }

  /** Una etapa aprobada, y encima un borrador de Claude que nadie decidió todavía. */
  async function conConflicto() {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const aprobada = await saveLandscapeVersion(db, p.id, 'contexto', {
      content: contenidoAprobado, author: 'claude',
    })
    await approveLandscapeVersion(db, aprobada.id, { projectId: p.id, stage: 'contexto' })
    const deClaude = await saveLandscapeVersion(db, p.id, 'contexto', {
      content: { territorio: 'El café como pausa deliberada' }, author: 'claude',
    })
    return { db, p, aprobada, deClaude }
  }

  it('reafirmar la aprobada disuelve el conflicto sin borrar el borrador de Claude', async () => {
    const { db, p, deClaude } = await conConflicto()
    await reafirmarAprobada(db, p.id, 'contexto')

    const etapa = (await landscapeState(db, p.id)).find(e => e.stage === 'contexto')!
    expect(etapa.borradorNuevo).toBeNull()
    expect(etapa.actual!.content).toEqual(contenidoAprobado)
    expect(etapa.actual!.approvedAt).toBeTruthy()
    expect(etapa.aprobada).toBe(true)
    // La aprobada, la de Claude y la ratificación: nada se borró.
    expect(etapa.versiones).toBe(3)
    const historial = await listLandscapeVersions(db, p.id, 'contexto')
    expect(historial.map(v => v.id)).toContain(deClaude.id)
  })

  it('reafirmar sin conflicto no agrega nada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
    await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })

    // Ratificar algo que nadie discutió sólo ensuciaría el historial con una fila por clic.
    expect(await reafirmarAprobada(db, p.id, 'contexto')).toBeNull()
    expect((await landscapeState(db, p.id)).find(e => e.stage === 'contexto')!.versiones).toBe(1)
  })

  it('sobre una etapa sin ninguna versión tampoco agrega nada', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    expect(await reafirmarAprobada(db, p.id, 'entrega')).toBeNull()
    expect((await landscapeState(db, p.id)).find(e => e.stage === 'entrega')!.versiones).toBe(0)
  })

  it('la etapa reafirmada deja de esperar una decisión del equipo', async () => {
    const { db, p } = await conConflicto()
    expect(esperanDecision('landscape', await landscapeState(db, p.id))).toContain('landscape:contexto')

    await reafirmarAprobada(db, p.id, 'contexto')

    expect(esperanDecision('landscape', await landscapeState(db, p.id))).not.toContain('landscape:contexto')
  })

  it('la procedencia se arma desde la versión copiada, no desde la ratificación', async () => {
    const { db, p, aprobada } = await conConflicto()
    await reafirmarAprobada(db, p.id, 'contexto', 'Flor')

    const etapa = (await landscapeState(db, p.id)).find(e => e.stage === 'contexto')!
    // El contenido lo escribió Claude, antes; la fila nueva la firmó Flor, recién. Sin
    // `origen`, el documento diría que lo escribió Flor hoy — y el `createdAt` nuevo haría
    // parecer reciente algo que Claude escribió hace días.
    expect(etapa.origen!.id).toBe(aprobada.id)
    expect(procedenciaDeVersion(etapa.actual!, new Date(), etapa.origen))
      .toBe(`Escrito por Claude · ${haceCuanto(etapa.origen!.createdAt, new Date())} · aprobada`)
    // La ratificación sola diría otra cosa: por eso la procedencia no se arma con ella.
    expect(procedenciaDeVersion(etapa.actual!, new Date())).toContain('Escrito por Flor')
  })

  it('la ratificación queda firmada por quien la decidió, y es humana', async () => {
    const { db, p } = await conConflicto()
    const ratificacion = await reafirmarAprobada(db, p.id, 'contexto', 'Flor')
    expect(ratificacion!.author).toBe('humano')
    expect(ratificacion!.authorLabel).toBe('Flor')
  })

  it('un proyecto que no existe tira ErrorNoEncontrado', async () => {
    const db = await makeTestDb()
    await expect(reafirmarAprobada(db, '00000000-0000-4000-8000-000000000000', 'contexto'))
      .rejects.toBeInstanceOf(ErrorNoEncontrado)
  })
})

describe('landscape · long list ampliada sobre tendencias ya aprobadas', () => {
  const seis = [
    { id: 't1', eje: 'Marca', titulo: 'A', descripcion: '', fuentes: [] },
    { id: 't2', eje: 'Marca', titulo: 'B', descripcion: '', fuentes: [] },
    { id: 't3', eje: 'Estrategia', titulo: 'C', descripcion: '', fuentes: [] },
    { id: 't4', eje: 'Estrategia', titulo: 'D', descripcion: '', fuentes: [] },
    { id: 't5', eje: 'Comunicación', titulo: 'E', descripcion: '', fuentes: [] },
    { id: 't6', eje: 'Comunicación', titulo: 'F', descripcion: '', fuentes: [] },
  ]
  const t7 = { id: 't7', eje: 'Marca' as const, titulo: 'G', descripcion: '', fuentes: [] }

  /** Aprobado con las seis, y después Claude propone una séptima. */
  async function conLongListAmpliada() {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    await saveLandscapeVersion(db, p.id, 'tendencias', { content: { candidatas: seis }, author: 'claude' })
    await selectTendencias(db, p.id, ['t1', 't3', 't4', 't5'])
    // Mismo milisegundo = empate en created_at, y el desempate por uuid no conserva orden
    // de creación: "la más nueva" dejaba de ser la ampliada según la carga de la máquina.
    // En la vida real Claude nunca amplía en el mismo tick en que el equipo aprueba.
    await new Promise(r => setTimeout(r, 2))
    await saveLandscapeVersion(db, p.id, 'tendencias', {
      content: { candidatas: [...seis, t7] }, author: 'claude',
    })
    return { db, p }
  }

  it('se puede elegir una tendencia que solo existe en la long list nueva', async () => {
    const { db, p } = await conLongListAmpliada()
    // Sin esto, el gate valida contra la long list aprobada y rechaza t7 por "intrusa",
    // que es el caso que el spec marca como normal: Claude amplía, el equipo re-elige.
    const v = await selectTendencias(db, p.id, ['t1', 't3', 't4', 't7'])
    expect(v.approvedAt).toBeTruthy()
    const content = v.content as { candidatas: unknown[]; seleccionadas: string[] }
    expect(content.seleccionadas).toEqual(['t1', 't3', 't4', 't7'])
    expect(content.candidatas).toHaveLength(7)
  })

  it('elegir sobre la long list nueva deja de haber borrador pendiente', async () => {
    const { db, p } = await conLongListAmpliada()
    const antes = (await landscapeState(db, p.id)).find(e => e.stage === 'tendencias')!
    expect(antes.borradorNuevo).not.toBeNull()

    await selectTendencias(db, p.id, ['t1', 't3', 't4', 't7'])

    const despues = (await landscapeState(db, p.id)).find(e => e.stage === 'tendencias')!
    expect(despues.borradorNuevo).toBeNull()
    expect(despues.aprobada).toBe(true)
  })
})

describe('landscape · orden de versiones', () => {
  it('dos versiones con el mismo timestamp salen siempre en el mismo orden', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    // Mismo instante exacto: sin desempate, el orden lo decide Postgres y puede variar
    // entre corridas. Con Claude escribiendo por MCP el empate deja de ser hipotético.
    const mismoInstante = new Date('2026-07-31T12:00:00.000Z')
    await db.insert(landscapeVersions).values([
      { projectId: p.id, stage: 'contexto', content: { v: 1 }, author: 'claude', createdAt: mismoInstante },
      { projectId: p.id, stage: 'contexto', content: { v: 2 }, author: 'claude', createdAt: mismoInstante },
    ])

    const primera = (await listLandscapeVersions(db, p.id, 'contexto')).map(v => v.id)
    const segunda = (await listLandscapeVersions(db, p.id, 'contexto')).map(v => v.id)
    expect(primera).toEqual(segunda)
    expect(primera).toEqual([...primera].sort().reverse())
  })
})

describe('landscape · proyecto inexistente', () => {
  const idInexistente = '00000000-0000-0000-0000-000000000000'

  it('guardar contra un proyecto que no existe es un ErrorNoEncontrado, no una falla de Postgres sin traducir', async () => {
    const db = await makeTestDb()
    await expect(
      saveLandscapeVersion(db, idInexistente, 'contexto', { content: { v: 1 }, author: 'humano' }),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado)
    await expect(
      saveLandscapeVersion(db, idInexistente, 'contexto', { content: { v: 1 }, author: 'humano' }),
    ).rejects.toThrow(/no existe el proyecto/i)
  })

  it('guardar contra un proyecto que sí existe no dispara el chequeo (caso feliz intacto)', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Acme')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'humano' })
    expect(v.id).toBeTruthy()
  })

  it('seleccionar tendencias contra un proyecto que no existe es un ErrorNoEncontrado, no el mensaje de "sin long list"', async () => {
    const db = await makeTestDb()
    await expect(
      selectTendencias(db, idInexistente, ['t1', 't2', 't3', 't4']),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado)
    await expect(
      selectTendencias(db, idInexistente, ['t1', 't2', 't3', 't4']),
    ).rejects.toThrow(/no existe el proyecto/i)
  })
})

describe('landscape · zona horaria', () => {
  // Regresión: con columnas `timestamp` sin zona, el driver arma el `Date` de vuelta con
  // la zona del *proceso que lee*, no la que escribió. Con TZ=America/Bogota (UTC-5) una
  // fila recién creada se leía corrida ~5 h ("hace 300 min" en vez de "recién"). Corre en
  // cualquier TZ del corredor de tests porque fuerza la del proceso a Bogotá y la restaura
  // al final — con el esquema viejo (`timestamp`) este test falla; con `timestamptz` no.
  it('createdAt, approvedAt y updatedAt se leen correctas con el proceso en América/Bogotá', async () => {
    const tzOriginal = process.env.TZ
    process.env.TZ = 'America/Bogota'
    try {
      const db = await makeTestDb()
      const p = await findOrCreateProject(db, 'Acme')
      const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { v: 1 }, author: 'claude' })
      const aprobada = await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })
      const [stage] = await db.select().from(landscapeStages).where(eq(landscapeStages.projectId, p.id))

      const ahora = Date.now()
      const margenMs = 60_000 // generoso: acá lo que importa es "~0", no "~300 min"
      expect(Math.abs(ahora - new Date(v.createdAt).getTime())).toBeLessThan(margenMs)
      expect(Math.abs(ahora - new Date(aprobada.approvedAt!).getTime())).toBeLessThan(margenMs)
      expect(Math.abs(ahora - new Date(stage.updatedAt).getTime())).toBeLessThan(margenMs)
    } finally {
      if (tzOriginal === undefined) delete process.env.TZ
      else process.env.TZ = tzOriginal
    }
  })
})

describe('oauth · esquema', () => {
  it('guarda un cliente y lo lee de vuelta', async () => {
    const db = await makeTestDb()
    const [c] = await db.insert(oauthClients).values({
      id: 'cli_1',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
    }).returning()
    expect(c.secretHash).toBeNull()
    expect(c.redirectUris).toEqual(['https://claude.ai/api/mcp/auth_callback'])
  })

  it('el access hash es único', async () => {
    const db = await makeTestDb()
    const fila = {
      accessHash: 'h1', clientId: 'cli_1', scope: 'landscape',
      accessExpiresAt: new Date(Date.now() + 3600_000),
    }
    await db.insert(oauthTokens).values(fila)
    await expect(db.insert(oauthTokens).values(fila)).rejects.toThrow()
  })
})
