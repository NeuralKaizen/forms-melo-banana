import type { AnyDb } from '@/lib/db/store'
import {
  listProjectsWithCounts, getProjectWithSessions, getSessionWithAnswers, getDeliverable,
  landscapeState, summarizeLandscape, saveLandscapeVersion,
} from '@/lib/db/store'
import { STAGE_LABEL, STAGE_ORDER, type StageKey } from '@/lib/landscape/stages'
import { ErrorDeHerramienta } from './errores'
import { resolverProyecto } from './resolver'
import { validarContenidoEtapa } from './validar'

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
  const entrevistas = await Promise.all(
    ((proyecto?.sessions ?? []) as { id: string }[]).map(async s => {
      const conRespuestas = await getSessionWithAnswers(db, s.id)
      return {
        ...s,
        respuestas: (conRespuestas?.answers ?? []).map((a: Record<string, unknown>) => ({
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
      bloqueo: bloqueoDe(e.stage, e.status),
    })),
  }
}

function bloqueoDe(stage: StageKey, status: string): string | null {
  if (status === 'aprobada' || status === 'no_aplica') return null
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
