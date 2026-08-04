import type { AnyDb } from '@/lib/db/store'
import {
  listProjectsWithCounts, getProjectWithSessions, getSessionWithAnswers, getDeliverable,
  landscapeState, summarizeLandscape, saveLandscapeVersion,
} from '@/lib/db/store'
import { sessions, answers } from '@/lib/db/schema'
import { STAGE_LABEL, STAGE_ORDER, type StageKey } from '@/lib/landscape/stages'
import { ErrorDeHerramienta } from './errores'
import { resolverProyecto } from './resolver'
import { validarContenidoEtapa } from './validar'

// `AnyDb` hace que todo lo que sale del store llegue tipado `any`: estas dos anotan el
// parámetro de cada `.map` con el tipo real de la fila, así un nombre de campo mal escrito
// (`a.normalizedTxt`) sigue marcando error de tipos en vez de devolver `undefined` en silencio.
type SessionRow = typeof sessions.$inferSelect
type AnswerRow = typeof answers.$inferSelect

export async function listarProyectos(db: AnyDb) {
  const proyectos = await listProjectsWithCounts(db)
  return Promise.all(proyectos.map(async p => ({
    id: p.id,
    nombre: p.name,
    entrevistas: p.sessionsTotal,
    entrevistasCompletas: p.sessionsCompleted,
    tienePropuestaDeValor: p.tieneEntregable,
    landscape: summarizeLandscape(await landscapeState(db, p.id)),
  })))
}

/**
 * Todo el contexto de un proyecto, entero y sin búsqueda. A esta escala son unas pocas
 * decenas de respuestas: entra completo y no hay riesgo de que se le escape algo por
 * un ranking que decidió mal.
 */
export async function contextoProyecto(db: AnyDb, ref: string) {
  const { id, name } = await resolverProyecto(db, ref)
  const proyecto = await getProjectWithSessions(db, id)
  const entregable = await getDeliverable(db, id)
  const estado = await landscapeState(db, id)

  // `getProjectWithSessions` trae las sesiones sin sus respuestas: sin este paso las
  // entrevistas llegarían vacías, que es justamente el material que Claude necesita.
  //
  // Se seleccionan los campos a mano, no se esparce la fila (`...s`): la fila trae
  // `email`, un dato personal del entrevistado que no aporta nada al análisis y no
  // tiene por qué salir de la base hacia el chat.
  const entrevistas = await Promise.all(
    (proyecto?.sessions ?? []).map(async (s: SessionRow) => {
      const conRespuestas = await getSessionWithAnswers(db, s.id)
      return {
        nombre: s.name,
        empresa: s.company,
        rol: s.role,
        respuestas: (conRespuestas?.answers ?? []).map((a: AnswerRow) => ({
          pregunta: a.questionId,
          // La normalizada es la que se leyó y limpió; la cruda es el respaldo.
          texto: a.normalizedText ?? a.rawText,
          imagen: a.imageChoice ?? null,
        })),
      }
    }),
  )

  return {
    marca: name,
    entrevistas,
    propuestaDeValor: entregable?.content ?? null,
    landscape: estado.map(e => ({
      etapa: e.stage,
      titulo: STAGE_LABEL[e.stage],
      estado: e.status,
      // Solo lo aprobado: un borrador sin aprobar todavía no es la versión que manda.
      contenidoAprobado: e.aprobada ? e.actual?.content ?? null : null,
    })),
  }
}

export async function estadoLandscape(db: AnyDb, ref: string) {
  const { id, name } = await resolverProyecto(db, ref)
  const estado = await landscapeState(db, id)
  return {
    marca: name,
    resumen: summarizeLandscape(estado),
    etapas: estado.map(e => ({
      etapa: e.stage,
      titulo: STAGE_LABEL[e.stage],
      estado: e.status,
      versiones: e.versiones,
      hayBorradorEsperandoAprobacion: e.borradorNuevo !== null,
      bloqueo: bloqueoDe(e.stage, e.status, e.versiones),
    })),
  }
}

function bloqueoDe(stage: StageKey, status: string, versiones: number): string | null {
  if (status === 'aprobada' || status === 'no_aplica') return null

  // Con cero versiones no hay nada que aprobar ni que elegir todavía: el bloqueo real
  // es que la etapa no arrancó. Sin esta rama, un proyecto recién creado —seis etapas
  // en 'pendiente', cero versiones cada una— devolvía “apruebe una versión desde el
  // panel” para las seis, y Claude se lo repetía a la persona en el chat mandándola a
  // aprobar algo que todavía no existe.
  if (versiones === 0)
    return stage === 'tendencias'
      ? 'Todavía no hay una long list de tendencias escrita.'
      : `Todavía no hay ningún borrador de ${STAGE_LABEL[stage]} escrito.`

  if (stage === 'tendencias')
    return 'Necesita que el equipo elija 4 o 5 tendencias de la long list, desde el panel.'
  return 'Necesita que el equipo apruebe una versión desde el panel.'
}

export async function guardarEtapa(db: AnyDb, d: {
  proyecto: string; etapa: string; contenido: unknown
}) {
  if (!STAGE_ORDER.includes(d.etapa as StageKey))
    throw new ErrorDeHerramienta(
      `“${d.etapa}” no es una etapa del landscape. Las etapas son: ${STAGE_ORDER.join(', ')}.`,
    )
  const etapa = d.etapa as StageKey

  // Validar antes de resolver el proyecto y antes de tocar la base: una escritura mal
  // formada no deja rastro.
  validarContenidoEtapa(etapa, d.contenido)

  const { id, name } = await resolverProyecto(db, d.proyecto)
  const antes = (await landscapeState(db, id)).find(e => e.stage === etapa)
  const yaEstabaAprobada = antes?.aprobada ?? false

  // Siempre borrador, siempre autor 'claude'. No hay herramienta que apruebe: aprobar
  // es un acto humano y vive en el panel. `authorLabel` va vacío porque la app tiene
  // una sola contraseña compartida y ninguna identidad de usuario que atribuir.
  const version = await saveLandscapeVersion(db, id, etapa, {
    content: d.contenido,
    author: 'claude',
  })

  return {
    versionId: version.id,
    marca: name,
    etapa,
    esperandoAprobacion: true,
    mensaje: yaEstabaAprobada
      ? `Guardé un borrador nuevo de ${STAGE_LABEL[etapa]}. La etapa sigue aprobada con la ` +
        'versión anterior: el borrador queda visible en el panel para que el equipo decida ' +
        'si lo aprueba. No pisé nada.'
      : `Guardé un borrador de ${STAGE_LABEL[etapa]}. Queda pendiente de aprobación: el ` +
        'equipo la aprueba desde el panel.',
  }
}
