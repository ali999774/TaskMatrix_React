import { useState, useRef, useEffect } from 'react'

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
  // Keep callback in ref to avoid stale closure issues
  const onTranscriptRef = useRef(onTranscript)
  // eslint-disable-next-line react-hooks/refs -- canonical stale-closure fix: keep callback fresh in ref
  onTranscriptRef.current = onTranscript

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability detection on mount
      setUnsupported(true)
      return
    }

    const rec = new SpeechRecognitionAPI()
    rec.continuous = false
    rec.interimResults = true // get interim for faster feedback
    rec.lang = 'en-US'

    let finalTranscript = ''

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript || ''
        } else {
          interim += result[0]?.transcript || ''
        }
      }
      
      if (finalTranscript.trim()) {
        onTranscriptRef.current(finalTranscript.trim())
        onStatus?.('saved')
        setListening(false)
        finalTranscript = ''
      } else if (interim) {
        onStatus?.('hearing: ' + interim)
      }
    }

    rec.onerror = (event: { error: string }) => {
      console.warn('[Voice] Recognition error:', event.error)
      setListening(false)
      finalTranscript = ''
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
      if (!finalTranscript) {
        onStatus?.('')
      }
    }

    recognitionRef.current = rec

    return () => {
      try { rec.abort() } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onStatus is a stable prop; including it would recreate SpeechRecognition on every render
  }, []) // create once on mount

  const toggle = () => {
    const rec = recognitionRef.current
    if (!rec) return

    if (listening) {
      rec.stop()
      setListening(false)
    } else {
      try {
        rec.start()
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
      className={`shrink-0 p-2 rounded-lg text-sm transition-all active:scale-90 motion-reduce:scale-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center ${
        listening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
      } ${className}`}
      title={listening ? 'Listening... tap to stop' : 'Voice input'}
      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
    >
      {listening ? '🔴' : icon}
    </button>
  )
}
