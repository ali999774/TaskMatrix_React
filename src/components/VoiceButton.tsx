import { useState, useRef, useCallback } from 'react'

interface Props {
  onTranscript: (text: string) => void
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionLike = any

export default function VoiceButton({ onTranscript, className = '' }: Props) {
  const [listening, setListening] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const getRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (recognitionRef.current) return recognitionRef.current

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setUnsupported(true)
      return null
    }

    const rec = new SpeechRecognitionAPI()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'

    rec.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) {
        onTranscript(transcript.trim())
      }
      setListening(false)
    }

    rec.onerror = (event: { error: string }) => {
      console.warn('[Voice] Recognition error:', event.error)
      setListening(false)
      if (event.error === 'not-allowed') {
        setUnsupported(true)
      }
    }

    rec.onend = () => {
      setListening(false)
    }

    recognitionRef.current = rec
    return rec
  }, [onTranscript])

  const toggle = () => {
    const rec = getRecognition()
    if (!rec) return

    if (listening) {
      rec.stop()
      setListening(false)
    } else {
      try {
        rec.start()
        setListening(true)
      } catch {
        setUnsupported(true)
      }
    }
  }

  if (unsupported) return null

  return (
    <button
      onClick={toggle}
      className={`shrink-0 p-2 rounded-lg text-sm transition-all active:scale-90 ${
        listening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
      } ${className}`}
      title={listening ? 'Listening... tap to stop' : 'Voice input'}
      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
    >
      {listening ? '🔴' : '🎤'}
    </button>
  )
}
