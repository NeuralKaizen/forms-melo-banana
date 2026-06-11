// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MicButton } from './MicButton'

describe('MicButton', () => {
  it('exposes its state and fires onClick', () => {
    const onClick = vi.fn()
    const { rerender } = render(<MicButton active={false} onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /hablar/i })
    expect(btn.getAttribute('data-state')).toBe('idle')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
    rerender(<MicButton active onClick={onClick} />)
    expect(btn.getAttribute('data-state')).toBe('listening')
  })
})
