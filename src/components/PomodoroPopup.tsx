import { useRef, useCallback, useState } from 'react'
import { ArrowLeft, RotateCcw, Pause, SkipForward } from 'lucide-react'
import { usePomodoro, SESSION_LABELS } from '../hooks/usePomodoro'
import type { SessionType } from '../hooks/usePomodoro'

// Ring geometry constants
const MODAL_CIRCUMFERENCE = 502.65  // 2π × 80  (idle compact ring)
const FOCUS_CIRCUMFERENCE = 753.98 // 2π × 120 (full-screen ring)

interface Props {
  onClose: () => void
}

const COLORS: Record<SessionType, string> = {
  work: 'var(--color-pomodoro-work)',
  short: 'var(--color-pomodoro-short)',
  long: 'var(--color-pomodoro-long)',
}

export default function PomodoroPopup({ onClose }: Props) {
  const {
    running,
    session,
    timeLeft,
    progress,
    toggleTimer,
    resetTimer,
    skipSession,
  } = usePomodoro()

  const arcColor = COLORS[session]

  // Full-screen mode: auto-fires after 0.5s of holding the main button
  const [fullScreen, setFullScreen] = useState(false)
  const fullScreenTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const startFullScreen = useCallback(() => {
    fullScreenTimer.current = setTimeout(() => setFullScreen(true), 500)
  }, [])

  const cancelFullScreen = useCallback(() => {
    clearTimeout(fullScreenTimer.current)
  }, [])

  // Drag-to-dismiss on full screen
  const [dragOffset, setDragOffset] = useState(0)
  const touchStartY = useRef(0)

  const onFullTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const onFullTouchMove = (e: React.TouchEvent) => {
    setDragOffset(Math.max(0, e.touches[0].clientY - touchStartY.current))
  }

  const onFullTouchEnd = () => {
    if (dragOffset > 80) {
      setFullScreen(false)
    }
    setDragOffset(0)
  }

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
        onTouchStart={onFullTouchStart}
        onTouchMove={onFullTouchMove}
        onTouchEnd={onFullTouchEnd}
        style={{ transform: `translateY(${dragOffset}px)`, transition: dragOffset === 0 ? 'transform 0.3s' : 'none' }}
      >
        <button
          onClick={() => setFullScreen(false)}
          className="absolute top-[calc(env(safe-area-inset-top)+1rem)] left-4 text-white/60 hover:text-white p-2 min-h-[44px] min-w-[44px]"
          aria-label="Close"
        >
          <ArrowLeft size={24} />
        </button>

        <svg width="300" height="300" viewBox="0 0 300 300" className="drop-shadow-lg">
          <circle cx="150" cy="150" r="120" fill="none" stroke="white" strokeWidth="2" opacity="0.1" />
          <circle
            cx="150" cy="150" r="120" fill="none"
            stroke={arcColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${FOCUS_CIRCUMFERENCE}`}
            strokeDashoffset={FOCUS_CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 150 150)"
            style={{
              filter: running ? `drop-shadow(0 0 12px ${arcColor})` : 'none',
              transition: 'stroke-dashoffset 0.5s linear',
            }}
          />
        </svg>

        <div className="text-white text-[4rem] font-bold mt-[-180px] mb-12 font-mono tabular-nums tracking-tight">
          {timeLeft}
        </div>

        <div className="flex items-center gap-8">
          <button
            onClick={resetTimer}
            className="w-16 h-16 rounded-full flex items-center justify-center text-white/50 hover:text-white/80 transition-opacity active:opacity-50"
            aria-label="Reset timer"
          >
            <RotateCcw size={30} strokeWidth={2} />
          </button>

          <button
            onClick={toggleTimer}
            className="w-24 h-24 rounded-full flex items-center justify-center bg-white text-black
              transition-opacity active:opacity-70 hover:bg-white/90"
            aria-label={running ? 'Pause timer' : 'Start timer'}
          >
            {running ? (
              <Pause size={32} strokeWidth={2.5} />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            )}
          </button>

          <button
            onClick={skipSession}
            className="w-16 h-16 rounded-full flex items-center justify-center text-white/50 hover:text-white/80 transition-opacity active:opacity-50"
            aria-label="Skip to next session"
          >
            <SkipForward size={30} strokeWidth={2} />
          </button>
        </div>

        <p className="text-white/50 text-[0.875rem] mt-6">
          {SESSION_LABELS[session]}
        </p>
      </div>
    )
  }

  // Compact modal
  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40
      bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl px-5 py-4
      flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300 min-w-[240px]">
      {/* Compact ring: 80px radius, 100px viewBox */}
      <div className="relative shrink-0">
        <svg width="54" height="54" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200 dark:text-slate-700" />
          <circle
            cx="100" cy="100" r="80" fill="none"
            stroke={arcColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${MODAL_CIRCUMFERENCE}`}
            strokeDashoffset={MODAL_CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 100 100)"
            className="transition-[stroke-dashoffset] duration-500"
            style={{
              filter: running ? `drop-shadow(0 0 8px ${COLORS.work})` : 'none',
            }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[0.75rem] font-bold font-mono tabular-nums text-slate-700 dark:text-slate-200">
          {timeLeft}
        </span>
      </div>

      <div className="flex flex-col">
        <span className="text-[0.75rem] text-slate-400 dark:text-slate-500">
          {SESSION_LABELS[session]}
        </span>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={resetTimer}
          className="w-10 h-10 rounded-full flex items-center justify-center
            text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-opacity active:opacity-50"
          aria-label="Reset timer"
        >
          <RotateCcw size={18} strokeWidth={2} />
        </button>

        <button
          onClick={toggleTimer}
          className="w-12 h-12 rounded-full flex items-center justify-center
            bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
            hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90"
          aria-label={running ? 'Pause timer' : 'Start timer'}
        >
          {running ? (
            <Pause size={20} strokeWidth={2} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          )}
        </button>

        <button
          onClick={skipSession}
          className="w-10 h-10 rounded-full flex items-center justify-center
            text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-opacity active:opacity-50"
          aria-label="Skip to next session"
        >
          <SkipForward size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
