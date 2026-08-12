// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { EtapaDocumento } from './EtapaDocumento'

const base = {
  ubicacion: 'Estrategia · etapa 7 de 14',
  titulo: 'Personalidad',
  content: { rasgos: 'Cercana sin ser confianzuda', como_habla: 'Frases cortas' },
  procedencia: 'Escrito por Claude hace 2 h · sin aprobar',
  aprobada: false,
  onAprobar: () => {},
}

describe('EtapaDocumento', () => {
  it('muestra ubicación, título y procedencia', () => {
    render(<EtapaDocumento {...base} />)
    expect(screen.getByText('Estrategia · etapa 7 de 14')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Personalidad' })).toBeTruthy()
    expect(screen.getByText(/Escrito por Claude hace 2 h/)).toBeTruthy()
  })

  it('ofrece aprobar cuando la versión no está aprobada', () => {
    const onAprobar = vi.fn()
    render(<EtapaDocumento {...base} onAprobar={onAprobar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar etapa' }))
    expect(onAprobar).toHaveBeenCalledOnce()
  })

  it('no ofrece aprobar cuando ya está aprobada', () => {
    render(<EtapaDocumento {...base} aprobada procedencia="Aprobada por Flor · 12 ago" />)
    expect(screen.queryByRole('button', { name: 'Aprobar etapa' })).toBeNull()
  })

  it('rinde anterior y siguiente con el nombre de la etapa vecina', () => {
    render(<EtapaDocumento {...base}
      anterior={{ label: 'Arquetipo', href: '/x?etapa=arquetipo' }}
      siguiente={{ label: 'Valores', href: '/x?etapa=valores' }} />)
    expect(screen.getByRole('link', { name: /Arquetipo/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Valores/ })).toBeTruthy()
  })

  it('deshabilita el botón mientras guarda y muestra el error', () => {
    render(<EtapaDocumento {...base} guardando error="No se pudo guardar" />)
    expect(screen.getByRole('button', { name: /Guardando/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('No se pudo guardar')).toBeTruthy()
  })
})
