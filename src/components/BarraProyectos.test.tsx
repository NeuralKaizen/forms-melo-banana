// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { BarraProyectos, PanelIndiceMovil, type ProyectoBarra } from './BarraProyectos'

const proyectos: ProyectoBarra[] = [
  { id: 'a', name: 'Café Lunar', iniciales: 'CL', faseActual: 'Estrategia · 6 de 14', espera: false },
  { id: 'b', name: 'Vestir Bien', iniciales: 'VB', faseActual: 'Propuesta de valor', espera: true },
]

describe('BarraProyectos', () => {
  it('arranca recogida: muestra iniciales, no nombres', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    expect(screen.getByText('CL')).toBeTruthy()
    expect(screen.queryByText('Café Lunar')).toBeNull()
  })

  it('el control de abrir declara aria-expanded=false y lo alterna', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    const boton = screen.getByRole('button', { name: /Ver los nombres/ })
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(boton)
    expect(boton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Café Lunar')).toBeTruthy()
  })

  it('Escape la vuelve a recoger', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    fireEvent.click(screen.getByRole('button', { name: /Ver los nombres/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Café Lunar')).toBeNull()
  })

  it('marca el proyecto activo con aria-current', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    const activo = screen.getByRole('link', { name: /CL/ })
    expect(activo.getAttribute('aria-current')).toBe('page')
  })

  it('el proyecto que espera al equipo lo dice de forma accesible', () => {
    render(<BarraProyectos proyectos={proyectos} activeProjectId="a" />)
    expect(screen.getByRole('link', { name: /VB/ }).textContent).toContain('Tiene algo esperando')
  })
})

describe('PanelIndiceMovil', () => {
  it('arranca cerrado y abre el índice al tocarlo', () => {
    render(<PanelIndiceMovil><p>Índice del proyecto</p></PanelIndiceMovil>)
    const boton = screen.getByRole('button', { name: /Abrir el índice/ })
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Índice del proyecto')).toBeNull()
    fireEvent.click(boton)
    expect(screen.getByText('Índice del proyecto')).toBeTruthy()
  })

  it('Escape lo cierra', () => {
    render(<PanelIndiceMovil><p>Índice del proyecto</p></PanelIndiceMovil>)
    fireEvent.click(screen.getByRole('button', { name: /Abrir el índice/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Índice del proyecto')).toBeNull()
  })
})
