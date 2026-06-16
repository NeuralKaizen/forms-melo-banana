// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SectionNav } from './SectionNav'
import { visibleSections } from '@/lib/script/flow'

const sections = visibleSections({})

describe('SectionNav', () => {
  it('una pregunta respondida llama onJump con su índice global', () => {
    // empresa_historia (index 0) y productos (index 1) respondidas; actual = index 2
    const answered = new Set(['empresa_historia', 'productos'])
    const onJump = vi.fn()
    render(<SectionNav sections={sections} currentIndex={2} answeredIds={answered} onJump={onJump} />)
    const rail = screen.getByRole('navigation', { name: /preguntas/i })
    fireEvent.click(within(rail).getByRole('button', { name: /Contexto del proyecto: pregunta 1/i }))
    expect(onJump).toHaveBeenCalledWith(0)
  })

  it('una pregunta futura está deshabilitada y no navega', () => {
    const onJump = vi.fn()
    render(<SectionNav sections={sections} currentIndex={0} answeredIds={new Set()} onJump={onJump} />)
    const rail = screen.getByRole('navigation', { name: /preguntas/i })
    const future = within(rail).getByRole('button', { name: /Contexto del proyecto: pregunta 3/i })
    expect((future as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(future)
    expect(onJump).not.toHaveBeenCalled()
  })

  it('marca la sección actual con aria-current en su título de riel', () => {
    render(<SectionNav sections={sections} currentIndex={0} answeredIds={new Set()} onJump={() => {}} />)
    const rail = screen.getByRole('navigation', { name: /preguntas/i })
    const current = within(rail).getByText('Contexto del proyecto')
    expect(current.getAttribute('aria-current')).toBe('step')
  })
})
