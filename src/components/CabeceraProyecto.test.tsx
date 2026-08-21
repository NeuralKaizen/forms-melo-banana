// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { CabeceraProyecto } from './CabeceraProyecto'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

function montar() {
  render(<CabeceraProyecto projectId="p1" nombre="Café Lunar" subtitulo="Estrategia · 6 de 14" />)
}

beforeEach(() => {
  push.mockClear()
  refresh.mockClear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CabeceraProyecto', () => {
  it('siempre ofrece la vuelta al panel general', () => {
    montar()
    const volver = screen.getByRole('link', { name: /Proyectos/ })
    expect(volver.getAttribute('href')).toBe('/admin')
  })

  it('renombrar manda el PATCH con el nombre nuevo y refresca', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
    montar()

    fireEvent.click(screen.getByRole('button', { name: /Renombrar/ }))
    const input = screen.getByLabelText('Nuevo nombre del proyecto')
    fireEvent.change(input, { target: { value: 'Café Lunar Bistró' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/projects/p1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Café Lunar Bistró' })
  })

  it('el error del servidor al renombrar se muestra, no se traga', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, json: async () => ({ error: 'Ya hay otro proyecto que se llama "Café Lunar Bistró"' }),
    })))
    montar()

    fireEvent.click(screen.getByRole('button', { name: /Renombrar/ }))
    const input = screen.getByLabelText('Nuevo nombre del proyecto')
    fireEvent.change(input, { target: { value: 'Café Lunar Bistró' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByText(/Ya hay otro proyecto/)).toBeTruthy()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('borrar queda deshabilitado hasta tipear el nombre exacto', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /Borrar el proyecto Café Lunar/ }))

    const confirmar = screen.getByRole('button', { name: 'Borrar el proyecto' })
    expect((confirmar as HTMLButtonElement).disabled).toBe(true)

    const input = screen.getByLabelText(/Escribí el nombre/)
    fireEvent.change(input, { target: { value: 'Cafe Lunar' } })
    expect((confirmar as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'Café Lunar' } })
    expect((confirmar as HTMLButtonElement).disabled).toBe(false)
  })

  it('confirmado, manda el DELETE y vuelve al panel general', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
    vi.stubGlobal('fetch', fetchMock)
    montar()

    fireEvent.click(screen.getByRole('button', { name: /Borrar el proyecto Café Lunar/ }))
    fireEvent.change(screen.getByLabelText(/Escribí el nombre/), { target: { value: 'Café Lunar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Borrar el proyecto' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/projects/p1')
    expect(init.method).toBe('DELETE')
  })
})
