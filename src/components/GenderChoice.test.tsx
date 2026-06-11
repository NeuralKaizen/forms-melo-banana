// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GenderChoice } from './GenderChoice'

describe('GenderChoice', () => {
  it('clic en una opción llama onSelect con su id', () => {
    const onSelect = vi.fn()
    render(<GenderChoice options={[
      { id: 'hombre', label: 'Hombre' },
      { id: 'mujer', label: 'Mujer' },
    ]} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mujer' }))
    expect(onSelect).toHaveBeenCalledWith('mujer')
  })
})
