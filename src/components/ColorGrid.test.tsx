// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColorGrid } from './ColorGrid'

describe('ColorGrid', () => {
  it('clic en una paleta llama onSelect con su id', () => {
    const onSelect = vi.fn()
    render(<ColorGrid options={[
      { id: 'amarillo', label: 'Amarillo', colors: ['#fff', '#ff0'] },
      { id: 'rojo', label: 'Rojo', colors: ['#f00', '#900'] },
    ]} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Amarillo' }))
    expect(onSelect).toHaveBeenCalledWith('amarillo')
  })
})
