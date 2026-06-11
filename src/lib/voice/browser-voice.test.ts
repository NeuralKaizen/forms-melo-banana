import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserVoice } from './browser-voice'

// Mock mínimo de Web Speech: guarda la última instancia para dispararle eventos.
class MockRecognition {
  static last: MockRecognition | null = null
  lang = ''
  interimResults = false
  continuous = false
  maxAlternatives = 1
  onresult: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  started = false
  constructor() { MockRecognition.last = this }
  start() { this.started = true }
  stop() { this.started = false }
}

// Construye un evento con la forma de SpeechRecognitionEvent.
// Cada llamada recibe la lista COMPLETA y acumulada de resultados (como hace la API real).
function resultEvent(items: { transcript: string; isFinal: boolean }[]) {
  const results = items.map(it => {
    const r: any = [{ transcript: it.transcript }]
    r.isFinal = it.isFinal
    return r
  })
  return { resultIndex: 0, results }
}

describe('BrowserVoice', () => {
  beforeEach(() => { (globalThis as any).webkitSpeechRecognition = MockRecognition })
  afterEach(() => { delete (globalThis as any).webkitSpeechRecognition; MockRecognition.last = null })

  it('reports support when the API exists', () => {
    expect(new BrowserVoice().isSTTSupported()).toBe(true)
  })

  it('configures es-ES with interim results and emits accumulated partials', () => {
    const v = new BrowserVoice()
    const partials: string[] = []
    v.start(t => partials.push(t))
    const rec = MockRecognition.last!
    expect(rec.lang).toBe('es-ES')
    expect(rec.interimResults).toBe(true)
    expect(rec.started).toBe(true)
    rec.onresult!(resultEvent([{ transcript: 'hola', isFinal: true }]))
    rec.onresult!(resultEvent([{ transcript: 'hola', isFinal: true }, { transcript: ' mundo', isFinal: false }]))
    expect(partials.at(-1)).toBe('hola mundo')
  })

  it('stop() resolves with the accumulated final text only', async () => {
    const v = new BrowserVoice()
    v.start(() => {})
    const rec = MockRecognition.last!
    rec.onresult!(resultEvent([{ transcript: 'una respuesta', isFinal: true }, { transcript: ' a medias', isFinal: false }]))
    expect(await v.stop()).toBe('una respuesta')
    expect(rec.started).toBe(false)
  })
})
