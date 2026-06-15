declare module '@capgo/capacitor-speech-recognition' {
  export const SpeechRecognition: {
    requestPermissions(): Promise<{ speechRecognition: 'granted' | 'denied' | 'prompt' }>
    available(): Promise<{ available: boolean }>
    start(options: { language: string; maxResults: number; partialResults: boolean }): Promise<void>
    stop(): Promise<void>
    getLastPartialResult(): Promise<{ matches?: string[] }>
    addListener(event: string, callback: (data: any) => void): Promise<{ remove: () => Promise<void> }>
  }
}
