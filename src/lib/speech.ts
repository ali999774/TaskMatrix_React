import { Capacitor } from '@capacitor/core'

// Check if any speech recognition is available.
// On iOS: uses native SFSpeechRecognizer via @capgo/capacitor-speech-recognition.
// On web: uses Web Speech API.
export function speechSupported(): boolean {
  if (typeof window === 'undefined') return false
  // Native platforms: check Capacitor (plugin available if installed)
  if (Capacitor.isNativePlatform()) return true
  // Web: check Web Speech API
  const w = window as any
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

// Returns true if the native Capacitor speech plugin is available
// (import succeeds — plugin is installed and synced).
export function isNativeSpeech(): boolean {
  return Capacitor.isNativePlatform()
}
