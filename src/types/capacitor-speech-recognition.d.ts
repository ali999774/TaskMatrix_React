declare module '@capgo/capacitor-speech-recognition' {
  export const SpeechRecognition: {
    requestPermissions(): Promise<{ speechRecognition: 'granted' | 'denied' | 'prompt' }>
    available(): Promise<{ available: boolean }>
    start(options: { language: string; maxResults: number; partialResults: boolean }): Promise<void>
    stop(): Promise<void>
    getLastPartialResult(): Promise<{ matches?: string[] }>
    addListener(event: 'partialResults', callback: (data: { matches: string[] }) => void): Promise<{ remove: () => Promise<void> }>
    addListener(event: string, callback: (data: Record<string, unknown>) => void): Promise<{ remove: () => Promise<void> }>
  }
}
