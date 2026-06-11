import type { VoiceAdapter } from './types'

export class FakeVoice implements VoiceAdapter {
  started = false
  constructor(private finalText: string, private partials: string[] = []) {}
  start(onPartial: (text: string) => void) {
    this.started = true
    for (const p of this.partials) onPartial(p)
  }
  async stop() {
    this.started = false
    return this.finalText
  }
  isSTTSupported() { return true }
}
