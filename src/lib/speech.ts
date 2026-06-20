import { Capacitor } from '@capacitor/core'

// Safely check if we're on a Capacitor native platform.
// Wrapped in try-catch because @capacitor/core can throw
// in some browser environments during module init.
function isNativePlatformSafe(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

// Check if any speech recognition is available.
// On iOS: uses native SFSpeechRecognizer via @capgo/capacitor-speech-recognition.
// On web: uses Web Speech API.
export function speechSupported(): boolean {
  if (typeof window === 'undefined') return false
  // Native platforms: check Capacitor (plugin available if installed)
  if (isNativePlatformSafe()) return true
  // Web: check Web Speech API
  const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

// Returns true if the native Capacitor speech plugin is available
// (import succeeds — plugin is installed and synced).
export function isNativeSpeech(): boolean {
  return isNativePlatformSafe()
}

// Format a voice transcript as a sticky note with mic icon + timestamp header.
export function formatVoiceNote(transcript: string): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `🎙️ *${dateStr} at ${timeStr}*  \n${transcript.trim()}`
}
