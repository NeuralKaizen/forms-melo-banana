import type { VoiceAdapter } from './types'

export class FakeVoice implements VoiceAdapter {
  played: string[] = []
  private queue: string[]
  constructor(transcripts: string[]) { this.queue = [...transcripts] }
  async play(url: string) { this.played.push(url) }
  async listen() { return this.queue.shift() ?? '' }
  isSTTSupported() { return true }
  stop() {}
}
