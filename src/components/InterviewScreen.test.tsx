// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { InterviewScreen } from './InterviewScreen'
import { FakeVoice } from '@/lib/voice/fake-voice'
import type { Question } from '@/lib/script/types'

const q: Question = { id: 'demo', type: 'open', prompt: '¿Qué tal?', audio: '/audio/demo.mp3' }

describe('InterviewScreen', () => {
  it('toggle: 2do toque llena el texto y NO avanza; Siguiente avanza', async () => {
    const voice = new FakeVoice('una respuesta completa', ['una', 'una respuesta'])
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={1} total={20} voice={voice} onAnswer={onAnswer} />)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /hablar/i })) })
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(ta.value).toBe('una respuesta')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /cortar/i })) })
    expect(ta.value).toBe('una respuesta completa')
    expect(onAnswer).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onAnswer).toHaveBeenCalledWith({ rawText: 'una respuesta completa' })
  })

  it('regrabar limpia el texto y vuelve a escuchar (sin avanzar)', async () => {
    const voice = new FakeVoice('', [])
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={2} total={20} voice={voice}
      initial={{ rawText: 'texto previo' }} canGoBack onAnswer={onAnswer} />)

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('texto previo')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /regrabar/i })) })
    expect(voice.started).toBe(true)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('sin voz: oculta el micro y avanza al escribir + Siguiente', () => {
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={1} total={20} onAnswer={onAnswer} />)
    expect(screen.queryByRole('button', { name: /hablar/i })).toBeNull()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tecleado' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onAnswer).toHaveBeenCalledWith({ rawText: 'tecleado' })
  })
})
