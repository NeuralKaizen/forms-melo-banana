import type { VoiceAdapter } from './types'

// In browsers, read from window. In vitest node env, window is undefined — fall
// back to globalThis so the mock injected by tests is visible in both cases.
const w = (typeof window !== 'undefined' ? window : globalThis) as any

export class BrowserVoice implements VoiceAdapter {
  private rec?: any
  private finalText = ''

  isSTTSupported(): boolean {
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
  }

  start(onPartial: (text: string) => void): void {
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    if (this.rec) return
    this.finalText = ''
    const rec = new Ctor()
    this.rec = rec
    rec.lang = 'es-ES'
    rec.interimResults = true
    rec.continuous = true
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      let finalText = ''
      let interim = ''
      // Reconstruimos desde toda la lista (e.results es acumulativa en Web Speech):
      // más robusto que ir agregando por resultIndex, que se rompe si un índice se reusa.
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      this.finalText = finalText
      onPartial((finalText + interim).trim())
    }
    rec.onerror = () => { /* degrada en silencio; el texto sigue editable a mano */ }
    rec.start()
  }

  async stop(): Promise<string> {
    this.rec?.stop?.()
    this.rec = undefined
    return this.finalText.trim()
  }
}
