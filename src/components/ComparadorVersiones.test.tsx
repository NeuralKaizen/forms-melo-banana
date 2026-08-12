// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { ComparadorVersiones } from './ComparadorVersiones'

const props = {
  aprobada: { content: { territorio: 'El café de barrio' }, cuando: '12 ago' },
  nueva: { content: { territorio: 'El café como pausa deliberada' }, cuando: 'hace 2 h' },
  onMantener: () => {},
  onAprobarNueva: () => {},
}

describe('ComparadorVersiones', () => {
  it('rinde las dos columnas rotuladas', () => {
    render(<ComparadorVersiones {...props} />)
    expect(screen.getByText(/Vigente · aprobada/)).toBeTruthy()
    expect(screen.getByText(/Nueva de Claude/)).toBeTruthy()
    expect(screen.getByText('El café de barrio')).toBeTruthy()
    expect(screen.getByText('El café como pausa deliberada')).toBeTruthy()
  })

  it('ofrece las dos decisiones y las reporta', () => {
    const onMantener = vi.fn()
    const onAprobarNueva = vi.fn()
    render(<ComparadorVersiones {...props} onMantener={onMantener} onAprobarNueva={onAprobarNueva} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mantener la aprobada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar la nueva' }))
    expect(onMantener).toHaveBeenCalledOnce()
    expect(onAprobarNueva).toHaveBeenCalledOnce()
  })

  it('explica que lo aprobado sigue vigente', () => {
    render(<ComparadorVersiones {...props} />)
    expect(screen.getByText(/sigue vigente hasta que decidas/)).toBeTruthy()
  })
})
