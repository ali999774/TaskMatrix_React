import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { isNativeSpeech } from '../lib/speech'
import { registerPlugin } from '@capacitor/core'

// Registered once at module level — calling registerPlugin() inside a callback
// triggers Capacitor's "already registered" warning on every subsequent call.
const NativeSpeech = registerPlugin('SpeechRecognition')

interface Props {
  onTranscript: (text: string) => void
  onStatus?: (status: string) => void
  className?: string
  icon?: ReactNode
  autoStart?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionLike = any

export default function VoiceButton({ onTranscript, onStatus, className = '', icon = '🎤', autoStart = false }: Props) {
  const [listening, setListening] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listenerRef = useRef<any>(null) // native plugin listener handle
  const partialRef = useRef('') // accumulated partial results for fallback
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTranscriptRef = useRef(onTranscript)

  // Keep callback ref in sync without triggering re-renders
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  })

  // --- Helper: clear all auto-stop timers ---
  const clearTimers = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current)
      maxDurationTimerRef.current = null
    }
  }

  // --- Native (iOS) path using Capacitor plugin bridge ---
  const setupNative = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = NativeSpeech as any

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

          // Clear any stale timers
          clearTimers()

          // Register partial results listener
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const handlePartial = (event: any) => {
            const match = event.matches?.[0]
            if (match) {
              partialRef.current = match
              onStatus?.('hearing: ' + match)
              // Reset silence timer on every recognized phrase
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
              silenceTimerRef.current = setTimeout(() => {
                onStatus?.('auto-stop in 1s...')
                silenceTimerRef.current = setTimeout(() => {
                  silenceTimerRef.current = null
                  const rec = recognitionRef.current
                  if (rec) {
                    try { rec.stop() } catch { /* ignore */ }
                  }
                }, 1000)
              }, 4000) // 5s total: 4s silence → 1s warning → auto-stop
            }
          }
          listenerRef.current = await SpeechRecognition.addListener('partialResults', handlePartial)

          await SpeechRecognition.start({
            language: 'en-US',
            maxResults: 1,
            partialResults: true,
          })

          // Max duration safety net: 5 minutes
          maxDurationTimerRef.current = setTimeout(() => {
            maxDurationTimerRef.current = null
            const rec = recognitionRef.current
            if (rec) {
              try { rec.stop() } catch { /* ignore */ }
            }
          }, 5 * 60 * 1000)
        },
        stop: async () => {
          // Clear silence + max-duration timers
          clearTimers()
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
          clearTimers()
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      } else if (event.error === 'language-not-supported') {
        onStatus?.('unsupported browser')
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
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isNativeSpeech()) {
      setupNative()
    } else {
      setupWeb()
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      clearTimers()
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
      clearTimers()
      try {
        await rec.stop()
      } catch { /* ignore */ }
      setListening(false)
    } else {
      try {
        await rec.start()
        setListening(true)
        onStatus?.('listening')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        // Edge and some browsers throw 'language-not-supported' even though
        // the SpeechRecognition constructor exists. Don't hide the button
        // for recoverable errors — show the status so the user knows why.
        const msg = err?.message || String(err)
        if (msg.includes('language-not-supported')) {
          onStatus?.('unsupported browser')
        } else {
          setUnsupported(true)
        }
      }
    }
  }

  // Auto-start recording (used by iOS home screen quick action)
  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStart && !autoStarted.current && recognitionRef.current && !listening) {
      autoStarted.current = true
      toggle()
    }
    // toggle intentionally omitted — including it would re-fire on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, listening])

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
