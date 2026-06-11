import type { VoiceAdapter } from './types'

export class BrowserVoice implements VoiceAdapter {
  private audio?: HTMLAudioElement
  private rec?: any

  play(audioUrl: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.audio = new Audio(audioUrl)
        this.audio.onended = () => resolve()
        this.audio.onerror = () => resolve() // degrade silently; text is on screen
        void this.audio.play().catch(() => resolve())
      } catch { resolve() }
    })
  }

  isSTTSupported(): boolean {
    return typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  }

  listen(): Promise<string> {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) return Promise.reject(new Error('STT unsupported'))
    return new Promise((resolve, reject) => {
      const rec = new Ctor()
      this.rec = rec
      rec.lang = 'es-ES'
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.onresult = (e: any) => resolve(e.results[0][0].transcript)
      rec.onerror = (e: any) => reject(new Error(e.error))
      rec.onend = () => {} // resolved via onresult
      rec.start()
    })
  }

  stop() { this.audio?.pause(); this.rec?.stop?.() }
}
