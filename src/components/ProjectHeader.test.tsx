// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectHeader } from './ProjectHeader'
import { deriveFases } from '@/lib/pipeline/phases'
import { projectSignals } from '@/lib/pipeline/signals'

const fases = (over: Parameters<typeof projectSignals>[0] = { sessions: [], tieneEntregable: false }) =>
  deriveFases('p1', projectSignals(over))

describe('ProjectHeader', () => {
  it('renderiza las tres fases con su label y su detalle', () => {
    render(<ProjectHeader name="Fruta Viva" fases={fases()} active="entrevistas" />)
    expect(screen.getByText('Entrevistas / Propuesta de valor')).toBeTruthy()
    expect(screen.getByText('Landscape')).toBeTruthy()
    expect(screen.getByText('Estrategia')).toBeTruthy()
    expect(screen.getByText('Sin respondientes')).toBeTruthy()
  })

  it('marca la fase estrategia con aria-current cuando active="estrategia"', () => {
    render(<ProjectHeader name="Fruta Viva" fases={fases()} active="estrategia" />)
    const link = screen.getByRole('link', { name: /Estrategia/ })
    expect(link.getAttribute('aria-current')).toBe('step')
  })

  it('las tabs solo aparecen cuando active cae dentro de la fase 1', () => {
    const { unmount } = render(<ProjectHeader name="Fruta Viva" fases={fases()} active="taller" />)
    expect(screen.getByRole('tablist')).toBeTruthy()
    unmount()

    render(<ProjectHeader name="Fruta Viva" fases={fases()} active="landscape" />)
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('la dependencia de la fase activa se muestra, y la de una fase inactiva no', () => {
    // Con las señales por defecto (sin post-taller), la fase landscape trae una
    // dependencia. Activo en 'landscape', se ve; activo en 'entrevistas' (fase 1), no.
    const g = fases()
    expect(g[1].dependencia).toBeTruthy()

    const { unmount } = render(<ProjectHeader name="Fruta Viva" fases={g} active="landscape" />)
    expect(screen.getByText(g[1].dependencia!)).toBeTruthy()
    unmount()

    render(<ProjectHeader name="Fruta Viva" fases={g} active="entrevistas" />)
    expect(screen.queryByText(g[1].dependencia!)).toBeNull()
  })
})
