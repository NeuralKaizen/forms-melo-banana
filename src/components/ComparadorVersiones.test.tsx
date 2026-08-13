// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { ComparadorVersiones } from './ComparadorVersiones'

const props = {
  aprobada: { content: { territorio: 'El café de barrio' }, cuando: '12 ago' },
  nueva: { content: { territorio: 'El café como pausa deliberada' }, cuando: 'hace 2 h', autor: 'Claude' },
  onVerSoloAprobada: () => {},
  onAprobarNueva: () => {},
}

describe('ComparadorVersiones', () => {
  it('rinde las dos columnas rotuladas', () => {
    render(<ComparadorVersiones {...props} />)
    expect(screen.getByText(/Vigente · aprobada/)).toBeTruthy()
    expect(screen.getByText(/Nueva · Claude/)).toBeTruthy()
    expect(screen.getByText('El café de barrio')).toBeTruthy()
    expect(screen.getByText('El café como pausa deliberada')).toBeTruthy()
  })

  it('ofrece las dos salidas y las reporta: mirar una sola, o aprobar la nueva', () => {
    const onVerSoloAprobada = vi.fn()
    const onAprobarNueva = vi.fn()
    render(<ComparadorVersiones {...props} onVerSoloAprobada={onVerSoloAprobada} onAprobarNueva={onAprobarNueva} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver sólo la aprobada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar la nueva' }))
    expect(onVerSoloAprobada).toHaveBeenCalledOnce()
    expect(onAprobarNueva).toHaveBeenCalledOnce()
  })

  it('firma la versión nueva con quien la escribió, no siempre con Claude', () => {
    render(<ComparadorVersiones {...props} nueva={{ ...props.nueva, autor: 'Flor' }} />)
    expect(screen.getByText(/Nueva · Flor/)).toBeTruthy()
    expect(screen.getByText(/Flor escribió una versión nueva/)).toBeTruthy()
  })

  it('explica que lo aprobado sigue vigente', () => {
    render(<ComparadorVersiones {...props} />)
    expect(screen.getByText(/sigue vigente hasta que decidas/)).toBeTruthy()
  })
})
