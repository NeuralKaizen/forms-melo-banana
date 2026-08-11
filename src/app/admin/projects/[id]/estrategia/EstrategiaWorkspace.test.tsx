// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { buildEtapasEstrategia } from '@/lib/estrategia/stages'
import { EstrategiaWorkspace } from './EstrategiaWorkspace'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))

/**
 * Mismo caso que en landscape, espejado: Claude escribe sobre una etapa que el equipo
 * ya aprobó por `guardar_etapa`. Lo aprobado sigue a la vista por defecto y lo nuevo
 * tiene que estar a un clic.
 */
function armarPanel({ conBorrador }: { conBorrador: boolean }) {
  const etapas = buildEtapasEstrategia([{ stage: 'consumidor', status: 'aprobada' }])
  return render(
    <EstrategiaWorkspace
      projectId="p1"
      etapas={etapas}
      resumen={{ aprobadas: 1, total: 14 }}
      contenidoPorEtapa={{
        consumidor: {
          id: 'v1',
          content: { hallazgo: 'lo aprobado' },
          aprobada: true,
          borradorNuevo: conBorrador ? { id: 'v2', content: { hallazgo: 'lo nuevo' } } : null,
        },
      }}
    />,
  )
}

function irAConsumidor() {
  fireEvent.click(screen.getByText('Consumidor'))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EstrategiaWorkspace', () => {
  it('renderiza las 14 etapas con sus labels', () => {
    armarPanel({ conBorrador: false })
    // Con scope al nav: "Diagnóstico" es la etapa por defecto, así que también aparece
    // en el encabezado del contenido — acá interesa solo la lista de etapas.
    const nav = within(screen.getByRole('navigation', { name: 'Etapas de la estrategia' }))
    // El carril arranca agrupado y solo el grupo activo (diagnóstico) expandido —
    // hay que abrir los otros dos para ver las 14 etapas.
    fireEvent.click(nav.getByText('Esencia de marca'))
    fireEvent.click(nav.getByText('Cierre'))
    expect(nav.getByText('Diagnóstico')).toBeTruthy()
    expect(nav.getByText('Consumidor')).toBeTruthy()
    expect(nav.getByText('RTBs')).toBeTruthy()
    expect(nav.getByText('Concepto estratégico')).toBeTruthy()
    expect(nav.getByText('Beneficios')).toBeTruthy()
    expect(nav.getByText('Arquetipo')).toBeTruthy()
    expect(nav.getByText('Personalidad')).toBeTruthy()
    expect(nav.getByText('Valores')).toBeTruthy()
    expect(nav.getByText('Territorio')).toBeTruthy()
    expect(nav.getByText('Brand Ideal')).toBeTruthy()
    expect(nav.getByText('Brand ingredients')).toBeTruthy()
    expect(nav.getByText('Tagline / CCI')).toBeTruthy()
    expect(nav.getByText('Manifiesto')).toBeTruthy()
    expect(nav.getByText('Cuadros finales')).toBeTruthy()
  })

  it('una etapa aprobada con borrador nuevo muestra el aviso, pero sigue mostrando lo aprobado', () => {
    armarPanel({ conBorrador: true })
    irAConsumidor()
    expect(screen.getByText('Ver la nueva')).toBeTruthy()
    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.queryByText('lo nuevo')).toBeNull()

    fireEvent.click(screen.getByText('Ver la nueva'))
    expect(screen.getByText('lo nuevo')).toBeTruthy()
    expect(screen.queryByText('lo aprobado')).toBeNull()
    expect(screen.getByText('Ver la aprobada')).toBeTruthy()
  })

  it('el botón de aprobar manda el versionId de la versión visible al endpoint de estrategia', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    armarPanel({ conBorrador: true })
    irAConsumidor()
    fireEvent.click(screen.getByText('Ver la nueva'))
    fireEvent.click(screen.getByText('Aprobar esta versión'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p1/estrategia/consumidor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'aprobar', versionId: 'v2' }),
    })
  })

  it('agrupa el carril en tres grupos con contador propio; solo el grupo activo arranca expandido', () => {
    armarPanel({ conBorrador: false })
    const nav = within(screen.getByRole('navigation', { name: 'Etapas de la estrategia' }))

    expect(nav.getByText('Diagnóstico y consumidor')).toBeTruthy()
    expect(nav.getByText('Esencia de marca')).toBeTruthy()
    expect(nav.getByText('Cierre')).toBeTruthy()

    // Consumidor está aprobada, diagnóstico no; ninguna etapa es 'no_aplica'.
    expect(nav.getByText('1 de 2')).toBeTruthy()
    expect(nav.getByText('0 de 11')).toBeTruthy()
    expect(nav.getByText('0 de 1')).toBeTruthy()

    // El grupo de la etapa activa (diagnóstico) arranca expandido.
    expect(nav.getByText('Diagnóstico')).toBeTruthy()
    expect(nav.getByText('Consumidor')).toBeTruthy()

    // Los otros dos grupos arrancan plegados: sus filas no están en el DOM.
    expect(nav.queryByText('RTBs')).toBeNull()
    expect(nav.queryByText('Cuadros finales')).toBeNull()
  })

  it('clic en la cabecera de un grupo plegado muestra sus filas', () => {
    armarPanel({ conBorrador: false })
    const nav = within(screen.getByRole('navigation', { name: 'Etapas de la estrategia' }))

    expect(nav.queryByText('RTBs')).toBeNull()
    fireEvent.click(nav.getByText('Esencia de marca'))
    expect(nav.getByText('RTBs')).toBeTruthy()
  })

  it('el pie muestra anterior/siguiente para una etapa del medio y navega expandiendo el grupo destino', () => {
    armarPanel({ conBorrador: false })
    irAConsumidor()

    // Consumidor: anterior Diagnóstico, siguiente RTBs (cruza a "Esencia de marca").
    expect(screen.getByText('‹ Diagnóstico')).toBeTruthy()
    expect(screen.getByText('RTBs ›')).toBeTruthy()

    fireEvent.click(screen.getByText('RTBs ›'))

    expect(screen.getByRole('heading', { name: 'RTBs' })).toBeTruthy()

    const nav = within(screen.getByRole('navigation', { name: 'Etapas de la estrategia' }))
    // Se expandió el grupo destino ("Esencia de marca")...
    expect(nav.getByText('Concepto estratégico')).toBeTruthy()
    // ...y se plegó el grupo anterior ("Diagnóstico y consumidor").
    expect(nav.queryByText('Diagnóstico')).toBeNull()
  })

  it('en diagnóstico (primera) no hay anterior; en cuadros (última) no hay siguiente', () => {
    armarPanel({ conBorrador: false })

    expect(screen.queryByText(/‹/)).toBeNull()
    expect(screen.getByText('Consumidor ›')).toBeTruthy()

    const nav = within(screen.getByRole('navigation', { name: 'Etapas de la estrategia' }))
    fireEvent.click(nav.getByText('Cierre'))
    fireEvent.click(nav.getByText('Cuadros finales'))

    expect(screen.getByText('‹ Manifiesto')).toBeTruthy()
    expect(screen.queryByText(/›/)).toBeNull()
  })
})
