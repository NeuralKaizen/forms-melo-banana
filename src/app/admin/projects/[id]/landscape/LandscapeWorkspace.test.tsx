// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { buildStages, MIN_TENDENCIAS, MAX_TENDENCIAS, type TendenciaCandidata } from '@/lib/landscape/stages'
import { LandscapeWorkspace } from './LandscapeWorkspace'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * El caso que llega con `guardar_etapa`: Claude escribe sobre una etapa que el equipo
 * ya aprobó. Lo aprobado no se pisa —una escritura desde un chat no deshace una
 * decisión— y lo nuevo tampoco se esconde: se ven las dos y el equipo elige.
 */
function props({ conBorrador }: { conBorrador: boolean }) {
  return {
    projectId: 'p1',
    stages: buildStages([{ stage: 'contexto' as const, status: 'aprobada' as const }]),
    tendencias: [] as TendenciaCandidata[],
    seleccionAprobada: [] as string[],
    tendenciasAprobadas: false,
    contenidoPorEtapa: {
      contexto: {
        id: 'v1',
        content: { hallazgo: 'lo aprobado' },
        aprobada: true,
        procedencia: 'Escrito por Claude · hace 3 días · aprobada',
        cuando: 'hace 3 días',
        borradorNuevo: conBorrador
          ? { id: 'v2', content: { hallazgo: 'lo nuevo' }, cuando: 'hace 2 h' }
          : null,
      },
    },
    actividad: [],
  }
}

describe('LandscapeWorkspace · la etapa sale de la query, no de un estado interno', () => {
  it('la etapa que se muestra sale de la prop, no de un estado interno', () => {
    render(<LandscapeWorkspace {...props({ conBorrador: false })} etapaActiva="panorama" />)
    expect(screen.getByRole('heading', { name: 'Panorama de categoría' })).toBeTruthy()
  })

  it('rinde la etapa aprobada como documento, con su procedencia', () => {
    render(<LandscapeWorkspace {...props({ conBorrador: false })} etapaActiva="contexto" />)
    expect(screen.getByRole('heading', { name: 'Contexto del sector' })).toBeTruthy()
    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.getByText(/Escrito por Claude/)).toBeTruthy()
    // Ya está aprobada: no hay nada que decidir.
    expect(screen.queryByRole('button', { name: 'Aprobar etapa' })).toBeNull()
  })

  it('el pie lleva a la etapa anterior y a la siguiente por la query', () => {
    render(<LandscapeWorkspace {...props({ conBorrador: false })} etapaActiva="contexto" />)
    expect(screen.getByRole('link', { name: /Setup/ }).getAttribute('href'))
      .toBe('/admin/projects/p1/landscape?etapa=setup')
    expect(screen.getByRole('link', { name: /Tendencias/ }).getAttribute('href'))
      .toBe('/admin/projects/p1/landscape?etapa=tendencias')
  })
})

describe('LandscapeWorkspace · borrador nuevo sobre etapa aprobada', () => {
  it('sin borrador nuevo no aparece el comparador', () => {
    render(<LandscapeWorkspace {...props({ conBorrador: false })} etapaActiva="contexto" />)
    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mantener la aprobada' })).toBeNull()
  })

  it('con borrador nuevo rinde el comparador en vez del documento simple', () => {
    render(<LandscapeWorkspace {...props({ conBorrador: true })} etapaActiva="contexto" />)
    expect(screen.getByRole('button', { name: 'Mantener la aprobada' })).toBeTruthy()
  })

  it('muestra las dos versiones a la vez y dice que lo aprobado sigue vigente', () => {
    render(<LandscapeWorkspace {...props({ conBorrador: true })} etapaActiva="contexto" />)
    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.getByText('lo nuevo')).toBeTruthy()
    expect(screen.getByText(/sigue vigente hasta que decidas/)).toBeTruthy()
  })

  it('“Aprobar la nueva” manda el versionId del borrador al endpoint del landscape', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(<LandscapeWorkspace {...props({ conBorrador: true })} etapaActiva="contexto" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar la nueva' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p1/landscape/contexto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'aprobar', versionId: 'v2' }),
    })
  })

  it('“Mantener la aprobada” deja el documento aprobado y no toca el servidor', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<LandscapeWorkspace {...props({ conBorrador: true })} etapaActiva="contexto" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mantener la aprobada' }))

    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.queryByText('lo nuevo')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cambiar de etapa no deja pegada la decisión de mantener', () => {
    const { rerender } = render(
      <LandscapeWorkspace {...props({ conBorrador: true })} etapaActiva="contexto" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mantener la aprobada' }))
    rerender(<LandscapeWorkspace {...props({ conBorrador: true })} etapaActiva="setup" />)
    rerender(<LandscapeWorkspace {...props({ conBorrador: true })} etapaActiva="contexto" />)

    expect(screen.getByRole('button', { name: 'Mantener la aprobada' })).toBeTruthy()
    expect(screen.getByText('lo nuevo')).toBeTruthy()
  })
})

/**
 * El gate de tendencias: la etapa donde guardar y aprobar son un solo acto, porque la
 * selección *es* la decisión. La presentación cambió (filas hairline y pie de decisión
 * en vez de tarjetas y barra flotante); la regla —entre 4 y 5, y las elige el equipo—
 * no se movió.
 */
function candidata(id: string): TendenciaCandidata {
  return {
    id,
    eje: 'Marca',
    titulo: `Tendencia ${id}`,
    descripcion: 'Descripción de la candidata.',
    fuentes: [{ doc: 'Archivo del estudio', pagina: 3 }],
  }
}

function panelDeTendencias(cuantas: number) {
  return render(
    <LandscapeWorkspace
      {...props({ conBorrador: false })}
      etapaActiva="tendencias"
      tendencias={Array.from({ length: cuantas }, (_, i) => candidata(`t${i + 1}`))}
    />,
  )
}

describe('LandscapeWorkspace · gate de tendencias', () => {
  it('no deja aprobar con menos del mínimo', () => {
    panelDeTendencias(6)
    const aprobar = screen.getByRole('button', { name: 'Aprobar y desarrollar' })
    expect(aprobar.hasAttribute('disabled')).toBe(true)

    for (let i = 1; i < MIN_TENDENCIAS; i++) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Tendencia t${i}`) }))
    }
    expect(screen.getByRole('button', { name: 'Aprobar y desarrollar' }).hasAttribute('disabled')).toBe(true)
  })

  it('con el mínimo elegido habilita el gate y manda la selección al endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    panelDeTendencias(6)
    for (let i = 1; i <= MIN_TENDENCIAS; i++) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Tendencia t${i}`) }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y desarrollar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p1/landscape/tendencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'seleccionar-tendencias',
        seleccionadas: Array.from({ length: MIN_TENDENCIAS }, (_, i) => `t${i + 1}`),
      }),
    })
  })

  it('no deja pasar del máximo', () => {
    panelDeTendencias(8)
    for (let i = 1; i <= MAX_TENDENCIAS + 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Tendencia t${i}`) }))
    }
    const elegidas = screen.getAllByRole('button', { pressed: true })
    expect(elegidas).toHaveLength(MAX_TENDENCIAS)
    expect(screen.getByText('Llegaste al máximo.')).toBeTruthy()
  })
})
