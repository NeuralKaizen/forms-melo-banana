import { EJES, type StageKey } from '@/lib/landscape/stages'
import { ErrorDeHerramienta } from './errores'

/**
 * Cinco de las seis etapas guardan lo que venga: el panel las renderiza genéricamente
 * y una humana las lee. Tendencias es distinta — el gate no lee texto, recorre
 * `candidatas` y guarda la selección como una lista de ids. Con otra forma el panel
 * muestra el contenido pero el gate deja de funcionar, y el gate es la etapa.
 *
 * Validar acá pone el error donde sale gratis: Claude todavía tiene el turno y reintenta.
 */
export function validarContenidoEtapa(etapa: StageKey, contenido: unknown): void {
  if (typeof contenido !== 'object' || contenido === null || Array.isArray(contenido))
    throw new ErrorDeHerramienta('El contenido tiene que ser un objeto JSON.')

  if (etapa !== 'tendencias') return

  const { candidatas, seleccionadas } = contenido as Record<string, unknown>

  if (seleccionadas !== undefined)
    throw new ErrorDeHerramienta(
      'No escribas “seleccionadas”: elegir las 4 o 5 tendencias es una decisión del equipo ' +
      'y se hace desde el panel. Mandá solo la long list en “candidatas”.',
    )

  if (!Array.isArray(candidatas) || candidatas.length === 0)
    throw new ErrorDeHerramienta(
      'La etapa Tendencias necesita “candidatas”: una lista con la long list completa. ' +
      'Cada tendencia lleva id, eje, titulo, descripcion y fuentes.',
    )

  const vistos = new Set<string>()
  candidatas.forEach((c, i) => {
    if (typeof c !== 'object' || c === null)
      throw new ErrorDeHerramienta(`La candidata ${i + 1} tiene que ser un objeto.`)
    const t = c as Record<string, unknown>

    if (typeof t.id !== 'string' || !t.id.trim())
      throw new ErrorDeHerramienta(
        `A la candidata ${i + 1} le falta un “id” de texto. El id es lo que guarda la ` +
        'selección del equipo, así que tiene que ser estable y único.',
      )
    if (vistos.has(t.id))
      throw new ErrorDeHerramienta(`El id “${t.id}” está repetido: cada tendencia necesita el suyo.`)
    vistos.add(t.id)

    if (typeof t.eje !== 'string' || !EJES.includes(t.eje as (typeof EJES)[number]))
      throw new ErrorDeHerramienta(
        `La candidata “${t.id}” tiene un eje inválido. Los válidos son: ${EJES.join(', ')}.`,
      )
    for (const campo of ['titulo', 'descripcion'] as const)
      if (typeof t[campo] !== 'string' || !(t[campo] as string).trim())
        throw new ErrorDeHerramienta(`A la candidata “${t.id}” le falta “${campo}”.`)
  })
}
