export interface VoiceAdapter {
  /** Play the agent's question audio; resolves when finished (or immediately if unavailable). */
  play(audioUrl: string): Promise<void>
  /** Listen to the user; resolves with the transcript, or rejects if STT unsupported/denied. */
  listen(): Promise<string>
  /** Whether speech-to-text is available in this environment. */
  isSTTSupported(): boolean
  /** Stop any in-progress playback or listening. */
  stop(): void
}
