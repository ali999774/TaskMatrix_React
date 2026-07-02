import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { Mic, Circle } from 'lucide-react'
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

// TEMP DIAGNOSTIC: surfaces the raw recognition error code on-screen so it
// can be reported from a real device. Flip to false (or delete the block
// below that renders it) once the failing error code is confirmed.
const DEBUG_VOICE_ERRORS = true

export default function VoiceButton({ onTranscript, onStatus, className = '', icon = <Mic size={20} />, autoStart = false }: Props) {
  const [listening, setListening] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [recReady, setRecReady] = useState(false)
  const [debugError, setDebugError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listenerRef = useRef<any>(null) // native plugin listener handle
  const partialRef = useRef('') // accumulated partial results for fallback
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onStatusRef = useRef(onStatus)

  // Keep callback refs in sync without triggering re-renders. Reading
  // onStatus through a ref (instead of closing over the prop directly)
  // keeps setupNative/setupWeb's identity stable across renders — an
  // inline onStatus passed by the parent used to change identity every
  // render, which tore down and rebuilt the native recognizer mid-session
  // via the mount effect's cleanup (see useEffect below).
  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onStatusRef.current = onStatus
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
        // Don't permanently hide the button — the user may grant permission
        // (e.g. in Settings) and try again without reloading the app.
        // recognitionRef.current is left unset; toggle() retries setup on
        // the next click.
        if (DEBUG_VOICE_ERRORS) setDebugError('native permission: ' + perm.speechRecognition)
        onStatusRef.current?.('mic denied')
        return
      }

      const { available } = await SpeechRecognition.available()
      if (!available) {
        setUnsupported(true)
        if (DEBUG_VOICE_ERRORS) setDebugError('native: plugin unavailable')
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
            // TEMP DEBUG: raw partialResults payload from the native plugin,
            // before any processing. Remove once the transcript chain is confirmed.
            console.log('[Voice][DEBUG] native partialResults event:', JSON.stringify(event))
            const match = event.matches?.[0]
            if (match) {
              partialRef.current = match
              onStatusRef.current?.('hearing: ' + match)
              // Reset silence timer on every recognized phrase
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
              silenceTimerRef.current = setTimeout(() => {
                onStatusRef.current?.('auto-stop in 1s...')
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
          setListening(false)
          // Get final result
          try {
            const result = await SpeechRecognition.getLastPartialResult()
            // TEMP DEBUG: raw getLastPartialResult() payload, and what we fall
            // back to from the partialResults listener. Remove once confirmed.
            console.log('[Voice][DEBUG] native getLastPartialResult raw:', JSON.stringify(result), 'partialRef.current:', JSON.stringify(partialRef.current))
            const finalText = result?.matches?.[0] || partialRef.current
            partialRef.current = ''
            if (finalText?.trim()) {
              console.log('[Voice][DEBUG] native finalText resolved:', JSON.stringify(finalText.trim()), '— calling onTranscript')
              onTranscriptRef.current(finalText.trim())
              onStatusRef.current?.('saved')
            } else {
              console.log('[Voice][DEBUG] native: finalText empty after getLastPartialResult — taking no-speech branch, onTranscript NOT called')
              onStatusRef.current?.('no speech')
            }
          } catch (err) {
            console.log('[Voice][DEBUG] native getLastPartialResult() threw:', err, '— falling back to partialRef.current:', JSON.stringify(partialRef.current))
            const fallback = partialRef.current
            partialRef.current = ''
            if (fallback?.trim()) {
              console.log('[Voice][DEBUG] native fallback resolved:', JSON.stringify(fallback.trim()), '— calling onTranscript')
              onTranscriptRef.current(fallback.trim())
              onStatusRef.current?.('saved')
            } else {
              console.log('[Voice][DEBUG] native: fallback also empty — taking no-speech branch, onTranscript NOT called')
              onStatusRef.current?.('no speech')
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
      setRecReady(true)
    } catch (err) {
      console.warn('[Voice] Native speech setup failed:', err)
      if (DEBUG_VOICE_ERRORS) setDebugError('native setup threw: ' + (err instanceof Error ? err.message : String(err)))
      setUnsupported(true)
    }
    // No deps: onStatus/onTranscript are read via refs above so this
    // identity stays stable across renders — see onStatusRef comment.
  }, [])

  // --- Web path --- same implementation, just needs Mic/Circle imports now
  const setupWeb = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      if (DEBUG_VOICE_ERRORS) setDebugError('web: no SpeechRecognition API')
      setUnsupported(true)
      return
    }

    let accumulated = ''
    let currentRec: SpeechRecognitionLike | null = null
    let silenceTimer: ReturnType<typeof setTimeout> | null = null

    const clearSilenceTimer = () => {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null }
    }

    const makeRecorder = (retried = false): SpeechRecognitionLike => {
      const rec = new SpeechRecognitionAPI()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.onresult = (event: SpeechRecognitionEvent) => {
        const prevLen = accumulated.length
        for (let i = event.resultIndex; i < event.results.length; i++) {
          accumulated += event.results[i][0]?.transcript || ''
        }
        if (accumulated) {
          onStatusRef.current?.('hearing: ' + accumulated)
        }
        // Reset silence timer only when new speech is detected
        if (accumulated.length > prevLen) {
          clearSilenceTimer()
          silenceTimer = setTimeout(() => {
            onStatusRef.current?.('auto-stop in 1s...')
            silenceTimer = setTimeout(() => {
              silenceTimer = null
              if (currentRec === rec) {
                const r = currentRec
                currentRec = null
                try { r.stop() } catch { /* ignore */ }
              }
            }, 1000)
          }, 2000) // 3s total silence → auto-stop
        }
      }

      rec.onerror = (event: { error: string }) => {
        console.warn('[Voice] Recognition error:', event.error)
        if (DEBUG_VOICE_ERRORS) setDebugError(event.error)
        clearSilenceTimer()
        // Edge throws 'network' on first start — retry once. Mark this
        // recorder as pending a retry; onend (which always fires after
        // onerror) does the actual restart.
        if (event.error === 'network' && !retried && currentRec === rec) {
          ;(rec as any).__pendingRetry = true
          return // let onend fire; it will retry
        }
        setListening(false)
        accumulated = ''
        currentRec = null
        if (event.error === 'not-allowed') {
          // Don't permanently hide the button — permission may be granted
          // on a later attempt. Just report it; toggle() will retry setup.
          onStatusRef.current?.('mic denied')
        } else if (event.error === 'no-speech') {
          onStatusRef.current?.('no speech')
        } else if (event.error === 'language-not-supported') {
          onStatusRef.current?.('unsupported browser')
        } else {
          onStatusRef.current?.('error: ' + event.error)
        }
      }

      rec.onend = () => {
        clearSilenceTimer()
        // If onerror flagged this as a network-error-then-retry, restart
        // with a fresh recorder now that the original has ended.
        if ((rec as any).__pendingRetry && currentRec === rec) {
          currentRec = null
          setTimeout(() => {
            currentRec = makeRecorder(true)
            currentRec.start()
          }, 400)
          return
        }
        setListening(false)
        if (accumulated.trim()) {
          onTranscriptRef.current(accumulated.trim())
          onStatusRef.current?.('saved')
        } else if (currentRec) {
          onStatusRef.current?.('no speech')
        }
        accumulated = ''
        currentRec = null
      }

      return rec
    }

    recognitionRef.current = {
      start: () => {
        accumulated = ''
        clearSilenceTimer()
        currentRec = makeRecorder(false)
        currentRec.start()
        // Initial timer — auto-stop after 3s if user never speaks
        silenceTimer = setTimeout(() => {
          onStatusRef.current?.('auto-stop in 1s...')
          silenceTimer = setTimeout(() => {
            silenceTimer = null
            if (currentRec) {
              const r = currentRec
              currentRec = null
              try { r.stop() } catch { /* ignore */ }
            }
          }, 1000)
        }, 2000)
      },
      stop: () => {
        clearSilenceTimer()
        setListening(false)
        const r = currentRec
        currentRec = null
        if (r) r.stop()
      },
      abort: () => {
        clearSilenceTimer()
        const r = currentRec
        currentRec = null
        if (r) r.abort()
      },
    }
    setRecReady(true)
    // No deps: onStatus/onTranscript are read via refs above so this
    // identity stays stable across renders — see onStatusRef comment.
  }, [])

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
    let rec = recognitionRef.current
    if (!rec) {
      // Setup didn't leave a controller ready — most commonly because
      // permission was denied (or not yet granted) when the component
      // mounted. Retry setup now so a later click succeeds once permission
      // is granted, instead of the button being permanently dead.
      if (isNativeSpeech()) {
        await setupNative()
      } else {
        setupWeb()
      }
      rec = recognitionRef.current
      if (!rec) return
    }

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
        onStatusRef.current?.('listening')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        // Edge and some browsers throw 'language-not-supported' even though
        // the SpeechRecognition constructor exists. Don't hide the button
        // for recoverable errors — show the status so the user knows why.
        const msg = err?.message || String(err)
        if (DEBUG_VOICE_ERRORS) setDebugError('toggle threw: ' + msg)
        if (msg.includes('language-not-supported')) {
          onStatusRef.current?.('unsupported browser')
        } else {
          setUnsupported(true)
        }
      }
    }
  }

  // Auto-start recording (used by iOS home screen quick action / Siri Shortcut)
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoStart) {
      autoStarted.current = false
      return
    }
    if (autoStarted.current) return
    if (recReady && !listening) {
      autoStarted.current = true
      toggle()
    }
  }, [autoStart, listening, recReady])

  // TEMP DIAGNOSTIC: fixed, visible, non-auto-clearing toast showing the raw
  // error code — not aria-hidden so it's actually noticeable. Remove this
  // block (and DEBUG_VOICE_ERRORS above) once the failing code is confirmed.
  const debugToast = DEBUG_VOICE_ERRORS && debugError ? (
    <div
      role="alert"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] text-[0.75rem] font-mono text-white bg-red-600 px-2 py-1 rounded shadow-lg"
    >
      voice error: {debugError}
    </div>
  ) : null

  if (unsupported) return debugToast

  return (
    <>
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
        {listening ? <Circle size={20} fill="currentColor" stroke="none" /> : icon}
      </button>
      {debugToast}
    </>
  )
}
