import { describe, it, expect } from 'vitest'
import { ErrorDeHerramienta } from './errores'
import { validarContenidoEtapa } from './validar'

const buena = {
  candidatas: [
    { id: 't1', eje: 'Marca', titulo: 'Longevidad', descripcion: 'Algo', fuentes: [] },
  ],
}

describe('mcp · validar contenido', () => {
  it('las otras etapas aceptan cualquier objeto', () => {
    expect(() => validarContenidoEtapa('contexto', { lo_que_sea: 1 })).not.toThrow()
  })

  it('ninguna etapa acepta algo que no sea objeto', () => {
    expect(() => validarContenidoEtapa('contexto', 'texto')).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEtapa('contexto', null)).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEtapa('contexto', [])).toThrow(ErrorDeHerramienta)
  })

  it('acepta una long list bien formada', () => {
    expect(() => validarContenidoEtapa('tendencias', buena)).not.toThrow()
  })

  it('rechaza tendencias sin candidatas', () => {
    expect(() => validarContenidoEtapa('tendencias', {})).toThrow(/candidatas/)
    expect(() => validarContenidoEtapa('tendencias', { candidatas: [] })).toThrow(/candidatas/)
  })

  it('rechaza una candidata sin id', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ eje: 'Marca', titulo: 'X', descripcion: 'Y' }],
    })).toThrow(/id/)
  })

  it('rechaza ids repetidos, porque la selección se guarda por id', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [
        { id: 't1', eje: 'Marca', titulo: 'X', descripcion: 'Y', fuentes: [] },
        { id: 't1', eje: 'Marca', titulo: 'Z', descripcion: 'W', fuentes: [] },
      ],
    })).toThrow(/repetid/)
  })

  it('rechaza un eje que no es de los tres', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ id: 't1', eje: 'Otro', titulo: 'X', descripcion: 'Y', fuentes: [] }],
    })).toThrow(/eje/)
  })

  it('rechaza que Claude escriba la selección: esa decisión es del equipo', () => {
    expect(() => validarContenidoEtapa('tendencias', { ...buena, seleccionadas: ['t1'] }))
      .toThrow(/seleccionadas/)
  })
})
