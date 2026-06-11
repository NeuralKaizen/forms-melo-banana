// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { InterviewScreen } from './InterviewScreen'
import { FakeVoice } from '@/lib/voice/fake-voice'
import type { Question } from '@/lib/script/types'

const q: Question = { id: 'demo', type: 'open', prompt: '¿Qué tal?', audio: '/audio/demo.mp3' }

describe('InterviewScreen', () => {
  it('toggle: 1er toque escucha (parcial en vivo), 2do toque guarda y avanza', async () => {
    const voice = new FakeVoice('una respuesta completa', ['una', 'una respuesta'])
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={1} total={15} voice={voice} onAnswer={onAnswer} />)

    const mic = screen.getByRole('button', { name: /hablar/i })
    await act(async () => { fireEvent.click(mic) })           // start
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('una respuesta')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /cortar/i })) }) // stop
    expect(onAnswer).toHaveBeenCalledWith({ rawText: 'una respuesta completa', imageChoice: undefined })
  })

  it('regrabar limpia el texto y vuelve a escuchar (sin avanzar)', async () => {
    const voice = new FakeVoice('', [])
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={2} total={15} voice={voice}
      initial={{ rawText: 'texto previo' }} canGoBack onAnswer={onAnswer} />)

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('texto previo')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /regrabar/i })) })
    expect(voice.started).toBe(true)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('image-grid: hablar sin elegir imagen no avanza', async () => {
    const iq: Question = { id: 'img', type: 'image-grid', prompt: '¿Cuál?', audio: '/audio/img.mp3',
      options: [{ id: 'a', label: 'A', src: '/a.jpg' }, { id: 'b', label: 'B', src: '/b.jpg' }] }
    const voice = new FakeVoice('hola', ['hola'])
    const onAnswer = vi.fn()
    render(<InterviewScreen question={iq} index={1} total={15} voice={voice} onAnswer={onAnswer} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /hablar/i })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /cortar/i })) })
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('sin voz: oculta el micro y avanza al escribir + Siguiente', () => {
    const onAnswer = vi.fn()
    render(<InterviewScreen question={q} index={1} total={15} onAnswer={onAnswer} />)
    expect(screen.queryByRole('button', { name: /hablar/i })).toBeNull()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tecleado' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onAnswer).toHaveBeenCalledWith({ rawText: 'tecleado', imageChoice: undefined })
  })
})
