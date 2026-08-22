// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { EditorSeccion } from './EditorEntregable'
import type { Deliverable } from '@/lib/deliverable/schema'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ok = <T,>(data: T) => ({ data, meta: { generatedAt: '2026-08-01T00:00:00.000Z', error: null } })

const DELIVERABLE: Deliverable = {
  problema: ok({
    problemaMundo: 'mundo', problemaMarca: 'marca',
    problemaConsumidor: [{ texto: 'dolor', origen: 'cliente' as const, cita: 'una cita' }],
    comoLoHacemos: [], porQueRelevante: [],
  }),
  competencia: ok({
    competidores: [{ texto: 'Starbucks', origen: 'cliente' as const, cita: null }],
    otrosReferentes: [],
    // Un entregable viejo con 2 ejes: el editor tiene que ofrecer las 4 variables igual.
    ejes: [
      { nombre: 'cercanía', extremoIzquierdo: 'frío', extremoDerecho: 'cálido', origen: 'equipo' as const },
      { nombre: 'precio', extremoIzquierdo: 'económico', extremoDerecho: 'premium', origen: 'equipo' as const },
    ],
    posicionActual: { texto: 'uno más', origen: 'equipo' as const, cita: null },
    posicionIdeal: { texto: 'con alma', origen: 'equipo' as const, cita: null },
  }),
}

function stubFetch() {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('location', { reload: vi.fn() })
  return fetchMock
}

describe('EditorSeccion', () => {
  it('editar un párrafo del problema manda el PATCH con el texto nuevo y las citas intactas', async () => {
    const fetchMock = stubFetch()
    render(<EditorSeccion numero={1} deliverable={DELIVERABLE} projectId="p1" onCerrar={() => {}} />)

    fireEvent.change(screen.getByLabelText('El problema en el mundo'), { target: { value: 'mundo corregido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/projects/p1/deliverable')
    const body = JSON.parse(init.body as string)
    expect(body.part).toBe('problema')
    expect(body.data.problemaMundo).toBe('mundo corregido')
    // La cita del ítem no se toca al editar: es literal de la entrevista.
    expect(body.data.problemaConsumidor[0].cita).toBe('una cita')
  })

  it('ofrece siempre las cuatro variables de comparación y guarda las cuatro', async () => {
    const fetchMock = stubFetch()
    render(<EditorSeccion numero={2} deliverable={DELIVERABLE} projectId="p1" onCerrar={() => {}} />)

    // Venían 2; el formulario completa hasta 4.
    expect(screen.getByLabelText('Nombre de la variable 3')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nombre de la variable 3'), { target: { value: 'credibilidad' } })
    fireEvent.change(screen.getByLabelText('Extremo izquierdo de la variable 3'), { target: { value: 'menor' } })
    fireEvent.change(screen.getByLabelText('Extremo derecho de la variable 3'), { target: { value: 'mayor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.part).toBe('competencia')
    expect(body.data.ejes).toHaveLength(4)
    expect(body.data.ejes[2].nombre).toBe('credibilidad')
    // Lo nuevo que agrega el equipo nace con su origen.
    expect(body.data.ejes[2].origen).toBe('equipo')
  })

  it('el error del servidor se muestra y no recarga', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'contenido inválido: "ejes" debe tener exactamente 4 elementos' }) })))
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    render(<EditorSeccion numero={1} deliverable={DELIVERABLE} projectId="p1" onCerrar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(/contenido inválido/)).toBeTruthy()
    expect(reload).not.toHaveBeenCalled()
  })

  it('una sección sin contenido generado lo dice en vez de romper', () => {
    stubFetch()
    render(<EditorSeccion numero={3} deliverable={DELIVERABLE} projectId="p1" onCerrar={() => {}} />)
    expect(screen.getByText(/todavía no se generó/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
  })
})
