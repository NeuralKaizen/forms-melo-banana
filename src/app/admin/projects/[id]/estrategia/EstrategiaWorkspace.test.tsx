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
})
