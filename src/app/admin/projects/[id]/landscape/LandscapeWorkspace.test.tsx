// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { buildStages } from '@/lib/landscape/stages'
import { LandscapeWorkspace } from './LandscapeWorkspace'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))

/**
 * El caso que llega con `guardar_etapa`: Claude escribe sobre una etapa que el equipo
 * ya aprobó. Lo aprobado tiene que seguir a la vista por defecto —una escritura desde
 * un chat no deshace una decisión— y lo nuevo tiene que estar a un clic.
 */
function armarPanel({ conBorrador }: { conBorrador: boolean }) {
  const stages = buildStages([{ stage: 'contexto', status: 'aprobada' }])
  return render(
    <LandscapeWorkspace
      projectId="p1"
      stages={stages}
      tendencias={[]}
      seleccionAprobada={[]}
      tendenciasAprobadas={false}
      contenidoPorEtapa={{
        contexto: {
          id: 'v1',
          content: { hallazgo: 'lo aprobado' },
          aprobada: true,
          borradorNuevo: conBorrador ? { id: 'v2', content: { hallazgo: 'lo nuevo' } } : null,
        },
      }}
      actividad={[]}
    />,
  )
}

/** El panel arranca en 'tendencias'; hay que ir a la etapa aprobada. */
function irAContexto() {
  fireEvent.click(screen.getByText('Contexto del sector'))
}

describe('LandscapeWorkspace · borrador nuevo sobre etapa aprobada', () => {
  it('sin borrador nuevo no aparece el aviso', () => {
    armarPanel({ conBorrador: false })
    irAContexto()
    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.queryByText('Ver la nueva')).toBeNull()
  })

  it('con borrador nuevo avisa, pero sigue mostrando lo aprobado', () => {
    armarPanel({ conBorrador: true })
    irAContexto()
    expect(screen.getByText('Ver la nueva')).toBeTruthy()
    // Lo aprobado manda: el contenido nuevo no se muestra hasta que se lo pide.
    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.queryByText('lo nuevo')).toBeNull()
    expect(screen.getByText('Versión aprobada')).toBeTruthy()
  })

  it('"Ver la nueva" muestra el borrador y ofrece aprobarlo', () => {
    armarPanel({ conBorrador: true })
    irAContexto()
    fireEvent.click(screen.getByText('Ver la nueva'))

    expect(screen.getByText('lo nuevo')).toBeTruthy()
    expect(screen.queryByText('lo aprobado')).toBeNull()
    expect(screen.getByText('Borrador sin aprobar')).toBeTruthy()
    // El gate humano aparece recién acá: aprobar sella la versión que se está viendo.
    expect(screen.getByText('Aprobar esta versión')).toBeTruthy()
  })

  it('se puede volver a la aprobada', () => {
    armarPanel({ conBorrador: true })
    irAContexto()
    fireEvent.click(screen.getByText('Ver la nueva'))
    fireEvent.click(screen.getByText('Ver la aprobada'))

    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.queryByText('Aprobar esta versión')).toBeNull()
  })

  it('cambiar de etapa no deja pegada la vista del borrador', () => {
    armarPanel({ conBorrador: true })
    irAContexto()
    fireEvent.click(screen.getByText('Ver la nueva'))
    fireEvent.click(screen.getByText('Tendencias'))
    irAContexto()

    expect(screen.getByText('lo aprobado')).toBeTruthy()
    expect(screen.getByText('Ver la nueva')).toBeTruthy()
  })
})
