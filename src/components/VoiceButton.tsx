import { useState, useRef, useEffect, useCallback } from 'react'
import { isNativeSpeech } from '../lib/speech'

interface Props {
  onTranscript: (text: string) => void
  onStatus?: (status: string) => void
  className?: string
  icon?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionLike = any

export default function VoiceButton({ onTranscript, onStatus, className = '', icon = '🎤' }: Props) {
  const [listening, setListening] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const listenerRef = useRef<any>(null) // native plugin listener handle
  const partialRef = useRef('') // accumulated partial results for fallback
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  // --- Native (iOS) path using @capgo/capacitor-speech-recognition ---
  const setupNative = useCallback(async () => {
    try {
      const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition')

      // Request permissions
      const perm = await SpeechRecognition.requestPermissions()
      if (perm.speechRecognition !== 'granted') {
        setUnsupported(true)
        onStatus?.('mic denied')
        return
      }

      const { available } = await SpeechRecognition.available()
      if (!available) {
        setUnsupported(true)
        return
      }

      // Store a start/stop controller in the ref
      recognitionRef.current = {
        start: async () => {
          // Remove any stale listener
          if (listenerRef.current) {
            await listenerRef.current.remove()
            listenerRef.current = null
          }

          // Register partial results listener
          listenerRef.current = await SpeechRecognition.addListener('partialResults', (event: any) => {
            const match = event.matches?.[0]
            if (match) {
              partialRef.current = match
              onStatus?.('hearing: ' + match)
            }
          })

          await SpeechRecognition.start({
            language: 'en-US',
            maxResults: 1,
            partialResults: true,
          })
        },
        stop: async () => {
          try {
            await SpeechRecognition.stop()
          } catch { /* ignore */ }
          // Get final result
          try {
            const result = await SpeechRecognition.getLastPartialResult()
            const finalText = result?.matches?.[0] || partialRef.current
            partialRef.current = ''
            if (finalText?.trim()) {
              onTranscriptRef.current(finalText.trim())
              onStatus?.('saved')
            } else {
              onStatus?.('no speech')
            }
          } catch {
            const fallback = partialRef.current
            partialRef.current = ''
            if (fallback?.trim()) {
              onTranscriptRef.current(fallback.trim())
              onStatus?.('saved')
            } else {
              onStatus?.('no speech')
            }
          }
          // Clean up listener
          if (listenerRef.current) {
            try { await listenerRef.current.remove() } catch { /* ignore */ }
            listenerRef.current = null
          }
        },
        abort: async () => {
          try { await SpeechRecognition.stop() } catch { /* ignore */ }
          if (listenerRef.current) {
            try { await listenerRef.current.remove() } catch { /* ignore */ }
            listenerRef.current = null
          }
        },
      }
    } catch (err) {
      console.warn('[Voice] Native speech setup failed:', err)
      setUnsupported(true)
    }
  }, [onStatus])

  // --- Web path using Web Speech API ---
  const setupWeb = useCallback(() => {
    const w = window as any
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setUnsupported(true)
      return
    }

    const rec = new SpeechRecognitionAPI()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    let accumulated = ''

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        accumulated += event.results[i][0]?.transcript || ''
      }
      if (accumulated) {
        onStatus?.('hearing: ' + accumulated)
      }
    }

    rec.onerror = (event: { error: string }) => {
      console.warn('[Voice] Recognition error:', event.error)
      setListening(false)
      accumulated = ''
      if (event.error === 'not-allowed') {
        setUnsupported(true)
        onStatus?.('mic denied')
      } else if (event.error === 'no-speech') {
        onStatus?.('no speech')
      } else {
        onStatus?.('error: ' + event.error)
      }
    }

    rec.onend = () => {
      setListening(false)
      if (accumulated.trim()) {
        onTranscriptRef.current(accumulated.trim())
        onStatus?.('saved')
      } else {
        onStatus?.('no speech')
      }
      accumulated = ''
    }

    recognitionRef.current = rec
  }, [onStatus])

  useEffect(() => {
    if (isNativeSpeech()) {
      setupNative()
    } else {
      setupWeb()
    }

    return () => {
      const rec = recognitionRef.current
      if (rec) {
        try { rec.abort() } catch { /* ignore */ }
      }
      if (listenerRef.current) {
        try { listenerRef.current.remove() } catch { /* ignore */ }
      }
    }
  }, [setupNative, setupWeb])

  const toggle = async () => {
    const rec = recognitionRef.current
    if (!rec) return

    if (listening) {
      try {
        await rec.stop()
      } catch { /* ignore */ }
      setListening(false)
    } else {
      try {
        await rec.start()
        setListening(true)
        onStatus?.('listening')
      } catch {
        setUnsupported(true)
      }
    }
  }

  if (unsupported) return null

  return (
    <button
      onClick={toggle}
      className={`shrink-0 p-2 rounded-lg text-[0.875rem] transition-all active:scale-90 motion-reduce:scale-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center ${
        listening
          ? 'bg-red-500 text-white animate-pulse motion-reduce:animate-none'
          : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
      } ${className}`}
      title={listening ? 'Listening... tap to stop' : 'Voice input'}
      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
    >
      {listening ? '🔴' : icon}
    </button>
  )
}
