// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectIndex } from './ProjectIndex'
import type { FaseIndice } from '@/lib/pipeline/indice'

const fases: FaseIndice[] = [
  {
    key: 'landscape', label: 'Landscape', avance: '2/6', ocultas: 0,
    hrefTodas: '/x?etapa=tendencias&todas=1',
    entradas: [
      { key: 'landscape:setup', label: 'Setup', href: '/x?etapa=setup', estado: 'aprobada', espera: false },
      { key: 'landscape:tendencias', label: 'Tendencias', href: '/x?etapa=tendencias', estado: 'actual', espera: false },
      { key: 'landscape:panorama', label: 'Panorama', href: '/x?etapa=panorama', estado: 'pendiente', espera: true },
    ],
  },
  {
    key: 'estrategia', label: 'Estrategia', avance: '6 de 14', ocultas: 8,
    hrefTodas: '/y?etapa=personalidad&todas=1',
    entradas: [
      { key: 'estrategia:personalidad', label: 'Personalidad', href: '/y?etapa=personalidad', estado: 'pendiente', bloque: 'Esencia de marca', espera: false },
    ],
  },
]

describe('ProjectIndex', () => {
  it('muestra el nombre del proyecto y su subtítulo', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="Estrategia · 6 de 14 etapas" fases={fases} />)
    expect(screen.getByText('Café Lunar')).toBeTruthy()
    expect(screen.getByText('Estrategia · 6 de 14 etapas')).toBeTruthy()
  })

  it('rinde cada fase con su avance', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    expect(screen.getByText('Landscape')).toBeTruthy()
    expect(screen.getByText('2/6')).toBeTruthy()
    expect(screen.getByText('6 de 14')).toBeTruthy()
  })

  it('marca la etapa actual con aria-current="page" y sólo esa', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    const actuales = screen.getAllByRole('link').filter(a => a.getAttribute('aria-current') === 'page')
    expect(actuales).toHaveLength(1)
    expect(actuales[0].textContent).toContain('Tendencias')
  })

  it('la etapa que espera al equipo lo dice de forma accesible, no sólo con color', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    const panorama = screen.getByRole('link', { name: /Panorama/ })
    expect(panorama.textContent).toContain('Espera al equipo')
  })

  it('ofrece revelar las etapas ocultas y lo manda al href que le dieron', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    const revelar = screen.getByRole('link', { name: '＋ 8 etapas más' })
    // El componente no arma URLs: rinde la que viene de `construirIndice`, que es quien
    // sabe qué etapa está activa y no la puede perder.
    expect(revelar.getAttribute('href')).toBe('/y?etapa=personalidad&todas=1')
  })

  it('no ofrece revelar nada cuando la fase no está colapsada', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={[fases[0]]} />)
    expect(screen.queryByText(/etapas más/)).toBeNull()
  })

  it('muestra el rótulo del bloque cuando la entrada lo trae', () => {
    render(<ProjectIndex nombre="Café Lunar" subtitulo="—" fases={fases} />)
    expect(screen.getByText('Esencia de marca')).toBeTruthy()
  })
})
