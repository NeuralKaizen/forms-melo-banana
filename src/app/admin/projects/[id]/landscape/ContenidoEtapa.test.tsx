// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContenidoEtapa } from './ContenidoEtapa'

/**
 * `content` es jsonb libre que escribe un agente en producción — no hay un esquema
 * cerrado que garantice qué formas llegan. Estos casos son los límites que un agente
 * puede guardar sin querer: campos vacíos, ceros, y estructuras anidadas raras.
 */
describe('ContenidoEtapa', () => {
  it('un objeto vacío al tope se ve como "Sin datos", no como una sección en blanco', () => {
    const { container } = render(<ContenidoEtapa content={{}} />)
    expect(screen.getByText('Sin datos')).toBeTruthy()
    // No debería haber quedado ninguna sección (h3) sin contenido.
    expect(container.querySelectorAll('h3')).toHaveLength(0)
  })

  it('un campo con array vacío se ve como "Sin datos", no como una lista sin nada adentro', () => {
    render(<ContenidoEtapa content={{ candidatas: [] }} />)
    expect(screen.getByText('Candidatas')).toBeTruthy()
    expect(screen.getByText('Sin datos')).toBeTruthy()
  })

  it('0 y false se muestran tal cual, no como "Sin datos"', () => {
    render(<ContenidoEtapa content={{ crecimiento: 0, disponible: false }} />)
    expect(screen.getByText('0')).toBeTruthy()
    expect(screen.getByText('false')).toBeTruthy()
    expect(screen.queryByText('Sin datos')).toBeNull()
  })

  it('un campo string se muestra tal cual', () => {
    render(<ContenidoEtapa content={{ resumen: 'La categoría creció 7,4 % en 2025' }} />)
    expect(screen.getByText('La categoría creció 7,4 % en 2025')).toBeTruthy()
  })

  it('un array de objetos se muestra como fichas de campos, una por elemento', () => {
    const { container } = render(
      <ContenidoEtapa content={{
        competidores: [
          { nombre: 'Bali Bowls', pais: 'CO' },
          { nombre: 'Otra Marca', pais: 'MX' },
        ],
      }} />,
    )
    // Cada objeto del array se renderiza como una ficha (Campos), con sus propios campos.
    expect(container.querySelectorAll('.bg-\\[\\#faf7ee\\]')).toHaveLength(2)
    expect(screen.getByText('Bali Bowls')).toBeTruthy()
    expect(screen.getByText('Otra Marca')).toBeTruthy()
    expect(screen.getAllByText('Nombre')).toHaveLength(2)
    expect(screen.getAllByText('Pais')).toHaveLength(2)
  })

  it('un array de arrays se anida como listas, no como ficha de campos "0"/"1"', () => {
    const { container } = render(<ContenidoEtapa content={{ matriz: [[1, 2], [3, 4]] }} />)

    // Los cuatro valores están, como texto de lista anidada.
    for (const n of ['1', '2', '3', '4']) expect(screen.getByText(n)).toBeTruthy()

    // Nada se renderizó como ficha de campos (eso pasaría si Object.entries tratara
    // el array anidado como objeto, con claves "0" y "1").
    expect(container.querySelectorAll('.bg-\\[\\#faf7ee\\]')).toHaveLength(0)
    expect(screen.queryByText('0')).toBeNull()

    // La lista exterior más las dos interiores: al menos tres <ul>.
    expect(container.querySelectorAll('ul').length).toBeGreaterThanOrEqual(3)
  })
})
