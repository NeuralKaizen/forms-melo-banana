// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectiveScreen } from './ProjectiveScreen'
import type { Question } from '@/lib/script/types'

const animal: Question = {
  id: 'animal', type: 'image-grid', prompt: '¿Animal?', audio: '/audio/animal.mp3',
  options: [
    { id: 'leon', label: 'León', src: '/x.jpg' },
    { id: 'gato', label: 'Gato', src: '/y.jpg' },
  ],
}

describe('ProjectiveScreen', () => {
  it('Siguiente arranca deshabilitado; elegir lo habilita y onAnswer lleva el imageChoice', () => {
    const onAnswer = vi.fn()
    render(<ProjectiveScreen question={animal} index={5} total={20} onAnswer={onAnswer} />)
    const next = screen.getByRole('button', { name: /siguiente/i }) as HTMLButtonElement
    expect(next.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'León' }))
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
    expect(onAnswer).toHaveBeenCalledWith({ rawText: '', imageChoice: 'leon' })
  })

  it('precarga la selección inicial', () => {
    const onAnswer = vi.fn()
    render(<ProjectiveScreen question={animal} index={5} total={20} initial={{ rawText: '', imageChoice: 'gato' }} onAnswer={onAnswer} />)
    const next = screen.getByRole('button', { name: /siguiente/i }) as HTMLButtonElement
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
    expect(onAnswer).toHaveBeenCalledWith({ rawText: '', imageChoice: 'gato' })
  })
})
