import { describe, it, expect } from 'vitest'
import type { StageKey } from '@/lib/landscape/stages'
import { MIN_TENDENCIAS } from '@/lib/landscape/stages'
import { ErrorDeHerramienta } from './errores'
import { validarContenidoEtapa } from './validar'

const candidata = (id: string) =>
  ({ id, eje: 'Marca', titulo: `Título ${id}`, descripcion: `Algo sobre ${id}`, fuentes: [] })

/** Rellena hasta MIN_TENDENCIAS con candidatas válidas, para no confundir el chequeo
 * de cantidad con lo que cada test quiere probar sobre una candidata puntual. */
const relleno = (n = MIN_TENDENCIAS - 1) =>
  Array.from({ length: n }, (_, i) => candidata(`relleno${i}`))

const buena = { candidatas: [candidata('t1'), ...relleno()] }

describe('mcp · validar contenido', () => {
  it('las otras etapas aceptan cualquier objeto', () => {
    expect(() => validarContenidoEtapa('contexto', { lo_que_sea: 1 })).not.toThrow()
  })

  it('ninguna etapa acepta algo que no sea objeto', () => {
    expect(() => validarContenidoEtapa('contexto', 'texto')).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEtapa('contexto', 'texto')).toThrow(/tiene que ser un objeto JSON/)
    expect(() => validarContenidoEtapa('contexto', null)).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEtapa('contexto', null)).toThrow(/tiene que ser un objeto JSON/)
    expect(() => validarContenidoEtapa('contexto', [])).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEtapa('contexto', [])).toThrow(/tiene que ser un objeto JSON/)
  })

  it('las etapas no-tendencias aceptan cualquier objeto, sin importar cuál', () => {
    const otras: StageKey[] = ['setup', 'panorama', 'diagnostico', 'entrega']
    otras.forEach((etapa) => {
      expect(() => validarContenidoEtapa(etapa, { lo_que_sea: 1 })).not.toThrow()
    })
  })

  it('acepta una long list bien formada', () => {
    expect(() => validarContenidoEtapa('tendencias', buena)).not.toThrow()
  })

  it('acepta una candidata con fuentes: [] (el panel mapea sobre vacío sin problema)', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ id: 't1', eje: 'Marca', titulo: 'X', descripcion: 'Y', fuentes: [] }, ...relleno()],
    })).not.toThrow()
  })

  it('rechaza tendencias sin candidatas', () => {
    expect(() => validarContenidoEtapa('tendencias', {})).toThrow(/candidatas/)
    expect(() => validarContenidoEtapa('tendencias', { candidatas: [] })).toThrow(/candidatas/)
  })

  it(`rechaza menos de ${MIN_TENDENCIAS} candidatas: el gate nunca puede aprobar menos`, () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [candidata('t1'), candidata('t2'), candidata('t3')],
    })).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [candidata('t1'), candidata('t2'), candidata('t3')],
    })).toThrow(new RegExp(`al menos ${MIN_TENDENCIAS}`))
  })

  it('rechaza una candidata sin id', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ eje: 'Marca', titulo: 'X', descripcion: 'Y', fuentes: [] }, ...relleno()],
    })).toThrow(/id/)
  })

  it('rechaza una candidata sin titulo', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ id: 't1', eje: 'Marca', descripcion: 'Y', fuentes: [] }, ...relleno()],
    })).toThrow(/le falta “titulo”/)
  })

  it('rechaza una candidata sin descripcion', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ id: 't1', eje: 'Marca', titulo: 'X', fuentes: [] }, ...relleno()],
    })).toThrow(/le falta “descripcion”/)
  })

  it('rechaza una candidata que no sea un objeto', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: ['no soy un objeto', ...relleno()],
    })).toThrow(/candidata 1 tiene que ser un objeto/)
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [42, ...relleno()],
    })).toThrow(/candidata 1 tiene que ser un objeto/)
  })

  it('rechaza ids repetidos, porque la selección se guarda por id', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [
        { id: 't1', eje: 'Marca', titulo: 'X', descripcion: 'Y', fuentes: [] },
        { id: 't1', eje: 'Marca', titulo: 'Z', descripcion: 'W', fuentes: [] },
        ...relleno(MIN_TENDENCIAS - 2),
      ],
    })).toThrow(/repetid/)
  })

  it('rechaza un eje que no es de los tres', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ id: 't1', eje: 'Otro', titulo: 'X', descripcion: 'Y', fuentes: [] }, ...relleno()],
    })).toThrow(/eje/)
  })

  it('rechaza una candidata sin fuentes', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ id: 't1', eje: 'Marca', titulo: 'X', descripcion: 'Y' }, ...relleno()],
    })).toThrow(/“fuentes”/)
  })

  it('rechaza fuentes que no sea un array', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ id: 't1', eje: 'Marca', titulo: 'X', descripcion: 'Y', fuentes: 'no soy un array' }, ...relleno()],
    })).toThrow(/“fuentes”/)
  })

  it('rechaza una fuente sin doc', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ id: 't1', eje: 'Marca', titulo: 'X', descripcion: 'Y', fuentes: [{ pagina: 3 }] }, ...relleno()],
    })).toThrow(/“doc”/)
  })

  it('rechaza una fuente con pagina no numérica', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [
        { id: 't1', eje: 'Marca', titulo: 'X', descripcion: 'Y', fuentes: [{ doc: 'brief.pdf', pagina: 'tres' }] },
        ...relleno(),
      ],
    })).toThrow(/“pagina”/)
  })

  it('rechaza que Claude escriba la selección: esa decisión es del equipo', () => {
    expect(() => validarContenidoEtapa('tendencias', { ...buena, seleccionadas: ['t1'] }))
      .toThrow(/seleccionadas/)
  })
})
