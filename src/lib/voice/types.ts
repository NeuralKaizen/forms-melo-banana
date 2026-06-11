export interface VoiceAdapter {
  /** Empieza a escuchar; llama onPartial con el texto acumulado en vivo. */
  start(onPartial: (text: string) => void): void
  /** Corta la escucha y resuelve con el texto final acumulado. */
  stop(): Promise<string>
  /** Si el STT está disponible; si no, la UI degrada a teclado. */
  isSTTSupported(): boolean
}
