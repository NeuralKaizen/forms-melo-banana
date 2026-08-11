// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectHeader } from './ProjectHeader'
import { deriveGrupos } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'

const grupos = (over: Parameters<typeof projectSignals>[0] = { sessions: [], tieneEntregable: false }) =>
  deriveGrupos('p1', projectSignals(over))

describe('ProjectHeader', () => {
  it('renderiza los tres grupos con su label y su detalle', () => {
    render(<ProjectHeader name="Fruta Viva" grupos={grupos()} active="entrevistas" />)
    expect(screen.getByText('Entrevistas / Propuesta de valor')).toBeTruthy()
    expect(screen.getByText('Landscape')).toBeTruthy()
    expect(screen.getByText('Estrategia')).toBeTruthy()
    expect(screen.getByText('Sin respondientes')).toBeTruthy()
  })

  it('marca el grupo estrategia con aria-current cuando active="estrategia"', () => {
    render(<ProjectHeader name="Fruta Viva" grupos={grupos()} active="estrategia" />)
    const link = screen.getByRole('link', { name: /Estrategia/ })
    expect(link.getAttribute('aria-current')).toBe('step')
  })

  it('las tabs solo aparecen cuando active cae dentro del grupo 1', () => {
    const { unmount } = render(<ProjectHeader name="Fruta Viva" grupos={grupos()} active="taller" />)
    expect(screen.getByRole('tablist')).toBeTruthy()
    unmount()

    render(<ProjectHeader name="Fruta Viva" grupos={grupos()} active="landscape" />)
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('la dependencia del grupo activo se muestra, y la de un grupo inactivo no', () => {
    // Con las señales por defecto (sin post-taller), el grupo landscape trae una
    // dependencia. Activo en 'landscape', se ve; activo en 'entrevistas' (grupo 1), no.
    const g = grupos()
    expect(g[1].dependencia).toBeTruthy()

    const { unmount } = render(<ProjectHeader name="Fruta Viva" grupos={g} active="landscape" />)
    expect(screen.getByText(g[1].dependencia!)).toBeTruthy()
    unmount()

    render(<ProjectHeader name="Fruta Viva" grupos={g} active="entrevistas" />)
    expect(screen.queryByText(g[1].dependencia!)).toBeNull()
  })
})
