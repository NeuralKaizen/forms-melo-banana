// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { buildEtapasEstrategia, ETAPA_LABEL, ETAPA_ORDER } from '@/lib/estrategia/stages'
import { EstrategiaWorkspace } from './EstrategiaWorkspace'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * Mismo caso que en landscape, espejado: Claude escribe sobre una etapa que el equipo
 * ya aprobó por `guardar_etapa`. Lo aprobado no se pisa y lo nuevo tampoco se esconde:
 * se ven las dos y el equipo elige.
 */
function props({ conBorrador }: { conBorrador: boolean }) {
  return {
    projectId: 'p1',
    etapas: buildEtapasEstrategia([{ stage: 'consumidor' as const, status: 'aprobada' as const }]),
    contenidoPorEtapa: {
      consumidor: {
        id: 'v1',
        content: { hallazgo: 'lo aprobado' },
        aprobada: true,
        procedencia: 'Escrito por Claude · hace 3 días · aprobada',
        cuando: 'hace 3 días',
        borradorNuevo: conBorrador
          ? { id: 'v2', content: { hallazgo: 'lo nuevo' }, cuando: 'hace 2 h', autor: 'Claude' }
          : null,
      },
    },
  }
}

describe('EstrategiaWorkspace · la etapa sale de la query, no de un estado interno', () => {
  // Reemplaza al test del carril de 14 etapas, que ahora vive en el índice del proyecto
  // (ver `indice.test.ts` y `ProjectIndex.test.tsx`): lo que le queda al workspace es
  // saber rendir cualquiera de las 14 con su label.
  it('rinde cualquiera de las 14 etapas con su label, según la prop', () => {
    for (const key of ETAPA_ORDER) {
      const { unmount } = render(<EstrategiaWorkspace {...props({ conBorrador: false })} etapaActiva={key} />)
      expect(screen.getByRole('heading', { name: ETAPA_LABEL[key] })).toBeTruthy()
      unmount()
    }
  })

  it('la etapa sin versión guardada lo dice, sin caja', () => {
    render(<EstrategiaWorkspace {...props({ conBorrador: false })} etapaActiva="territorio" />)
    expect(screen.getByText(/todavía no tiene una versión guardada/)).toBeTruthy()
  })

  it('rinde la etapa aprobada como documento, con su procedencia', () => {
    render(<EstrategiaWorkspace {...props({ conBorrador: false })} etapaActiva="consumidor" />)
    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.getByText(/Escrito por Claude/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Aprobar etapa' })).toBeNull()
  })
})

describe('EstrategiaWorkspace · borrador nuevo sobre etapa aprobada', () => {
  it('muestra las dos versiones a la vez y dice que lo aprobado sigue vigente', () => {
    render(<EstrategiaWorkspace {...props({ conBorrador: true })} etapaActiva="consumidor" />)
    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.getByText('lo nuevo')).toBeTruthy()
    expect(screen.getByText(/sigue vigente hasta que decidas/)).toBeTruthy()
  })

  it('el botón de aprobar manda el versionId de la versión nueva al endpoint de estrategia', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(<EstrategiaWorkspace {...props({ conBorrador: true })} etapaActiva="consumidor" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar la nueva' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p1/estrategia/consumidor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'aprobar', versionId: 'v2' }),
    })
  })

  it('“Mantener esta versión” ratifica la aprobada contra el endpoint de estrategia', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(<EstrategiaWorkspace {...props({ conBorrador: true })} etapaActiva="consumidor" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mantener esta versión' }))

    // A diferencia de “Ver sólo la aprobada”, esto decide: se escribe, y por eso el
    // conflicto no reaparece cuando se vuelve a la etapa.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p1/estrategia/consumidor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'reafirmar' }),
    })
  })

  it('“Ver sólo la aprobada” deja el documento aprobado y no toca el servidor', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<EstrategiaWorkspace {...props({ conBorrador: true })} etapaActiva="consumidor" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver sólo la aprobada' }))

    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.queryByText('lo nuevo')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mirar sólo la aprobada se vuelve: el borrador sigue a un clic', () => {
    render(<EstrategiaWorkspace {...props({ conBorrador: true })} etapaActiva="consumidor" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver sólo la aprobada' }))

    expect(screen.getByText(/Claude escribió una versión nueva hace 2 h/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver la versión nueva' }))

    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.getByText('lo nuevo')).toBeTruthy()
  })

  it('cambiar de etapa no deja pegada la vista de una sola versión', () => {
    const { rerender } = render(
      <EstrategiaWorkspace {...props({ conBorrador: true })} etapaActiva="consumidor" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ver sólo la aprobada' }))
    rerender(<EstrategiaWorkspace {...props({ conBorrador: true })} etapaActiva="rtbs" />)
    rerender(<EstrategiaWorkspace {...props({ conBorrador: true })} etapaActiva="consumidor" />)

    expect(screen.getByRole('button', { name: 'Ver sólo la aprobada' })).toBeTruthy()
  })
})

describe('EstrategiaWorkspace · anterior y siguiente', () => {
  it('una etapa del medio lleva a sus dos vecinas por la query', () => {
    render(<EstrategiaWorkspace {...props({ conBorrador: false })} etapaActiva="consumidor" />)

    expect(screen.getByRole('link', { name: /Diagnóstico/ }).getAttribute('href'))
      .toBe('/admin/projects/p1/estrategia?etapa=diagnostico')
    expect(screen.getByRole('link', { name: /RTBs/ }).getAttribute('href'))
      .toBe('/admin/projects/p1/estrategia?etapa=rtbs')
  })

  it('en diagnóstico (primera) no hay anterior; en cuadros (última) no hay siguiente', () => {
    const { unmount } = render(<EstrategiaWorkspace {...props({ conBorrador: false })} etapaActiva="diagnostico" />)
    expect(screen.queryByText(/‹/)).toBeNull()
    expect(screen.getByRole('link', { name: /Consumidor/ })).toBeTruthy()
    unmount()

    render(<EstrategiaWorkspace {...props({ conBorrador: false })} etapaActiva="cuadros" />)
    expect(screen.getByRole('link', { name: /Manifiesto/ })).toBeTruthy()
    expect(screen.queryByText(/›/)).toBeNull()
  })
})
