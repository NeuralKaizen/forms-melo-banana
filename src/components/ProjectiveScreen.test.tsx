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

const animalFU: Question = {
  ...animal,
  followUp: '¿Por qué ese animal?',
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

  it('muestra el nombre de cada opción como texto guía', () => {
    render(<ProjectiveScreen question={animal} index={5} total={20} onAnswer={vi.fn()} />)
    expect(screen.getByText('León')).toBeTruthy()
    expect(screen.getByText('Gato')).toBeTruthy()
  })

  it('al elegir revela la pregunta guía y guarda el "por qué" en rawText', () => {
    const onAnswer = vi.fn()
    render(<ProjectiveScreen question={animalFU} index={5} total={20} onAnswer={onAnswer} />)
    // antes de elegir, la pregunta guía no está
    expect(screen.queryByText('¿Por qué ese animal?')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'León' }))
    // aparece la guía referida a la opción elegida
    expect(screen.getByText('¿Por qué ese animal?')).toBeTruthy()
    expect(screen.getByText('Elegiste León')).toBeTruthy()
    const why = screen.getByRole('textbox', { name: /por qué/i }) as HTMLTextAreaElement
    fireEvent.change(why, { target: { value: 'Porque transmite fuerza' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onAnswer).toHaveBeenCalledWith({ rawText: 'Porque transmite fuerza', imageChoice: 'leon' })
  })

  it('la explicación es opcional: sin texto, rawText queda vacío', () => {
    const onAnswer = vi.fn()
    render(<ProjectiveScreen question={animalFU} index={5} total={20} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByRole('button', { name: 'León' }))
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onAnswer).toHaveBeenCalledWith({ rawText: '', imageChoice: 'leon' })
  })
})
