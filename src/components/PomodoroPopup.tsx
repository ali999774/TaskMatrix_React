import { useRef, useCallback, useState } from 'react'
import { usePomodoro, SESSION_LABELS } from '../hooks/usePomodoro'
import type { SessionType } from '../hooks/usePomodoro'

// Ring geometry constants
const MODAL_CIRCUMFERENCE = 439.8  // 2π × 70  (idle compact ring)
const FOCUS_CIRCUMFERENCE = 753.98 // 2π × 120 (full-screen ring)

interface Props {
  show: boolean
  onClose: () => void
}

export default function PomodoroPopup({ show, onClose }: Props) {
  const {
    durations, session, timeLeft, running,
    toggleTimer, resetTimer, skipSession, switchSession, adjustDuration,
  } = usePomodoro(show)

  // Drag state (idle modal only)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const popupRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(pos)
  // eslint-disable-next-line react-hooks/refs -- keep ref in sync for pointer event callbacks
  posRef.current = pos

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, select')) return
    if (posRef.current.x === 0 && posRef.current.y === 0 && popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect()
      setPos({ x: rect.left, y: rect.top })
      dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    } else {
      dragStart.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }
    }
    dragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }, [])

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  if (!show) return null

  // Derived display values
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const total = durations[session] * 60
  const progress = total > 0 ? 1 - timeLeft / total : 0
  const modalOffset = MODAL_CIRCUMFERENCE * (1 - progress)
  const focusOffset = FOCUS_CIRCUMFERENCE * (1 - progress)
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  // Session arc color via CSS variable — no hardcoded hex in JSX
  const arcColor =
    session === 'work'
      ? 'var(--color-pomodoro-work)'
      : session === 'short'
      ? 'var(--color-pomodoro-short)'
      : 'var(--color-pomodoro-long)'

  // ── RUNNING: full-screen immersive ──────────────────────────────────────
  if (running) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-between
          animate-[fadeIn_0.2s_ease] motion-reduce:animate-none"
        style={{ backgroundColor: 'var(--color-pomodoro-bg)' }}
      >
        {/* Top: safe area + session label */}
        <div
          className="flex flex-col items-center pt-safe mt-8 text-[0.75rem] font-semibold
            uppercase tracking-widest"
          style={{ color: arcColor }}
        >
          {SESSION_LABELS[session]}
        </div>

        {/* Hero: ring + time */}
        <div className="flex flex-col items-center gap-7">
          <div className="relative w-[280px] h-[280px]">
            <svg
              width="280"
              height="280"
              viewBox="0 0 280 280"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Neutral track */}
              <circle
                cx="140" cy="140" r="120"
                fill="none"
                stroke="var(--color-pomodoro-track)"
                strokeWidth="10"
              />
              {/* Accent progress arc */}
              <circle
                cx="140" cy="140" r="120"
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={FOCUS_CIRCUMFERENCE}
                strokeDashoffset={focusOffset}
                style={{
                  stroke: arcColor,
                  transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
                }}
              />
            </svg>

            {/* Time display */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[4.5rem] font-bold tabular-nums tracking-tighter leading-none"
                style={{ color: 'var(--color-pomodoro-text-hero)' }}
              >
                {timeStr}
              </span>
            </div>
          </div>

        </div>

        {/* Transport controls: reset | pause | skip */}
        <div
          className="flex items-center justify-center gap-10 pb-safe mb-10"
        >
          {/* Reset */}
          <button
            onClick={resetTimer}
            className="w-14 h-14 rounded-full flex items-center justify-center
              transition-opacity active:opacity-50 motion-reduce:transition-none"
            style={{ color: 'var(--color-pomodoro-text-label)' }}
            aria-label="Reset timer"
          >
            {/* Circular-arrow icon */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          {/* Pause — calm dark/neutral, NOT accent */}
          <button
            onClick={toggleTimer}
            className="w-20 h-20 rounded-full flex items-center justify-center
              transition-opacity active:opacity-70 motion-reduce:transition-none"
            style={{
              backgroundColor: 'var(--color-pomodoro-btn-calm)',
              color: 'var(--color-pomodoro-text-hero)',
            }}
            aria-label="Pause timer"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>

          {/* Skip */}
          <button
            onClick={skipSession}
            className="w-14 h-14 rounded-full flex items-center justify-center
              transition-opacity active:opacity-50 motion-reduce:transition-none"
            style={{ color: 'var(--color-pomodoro-text-label)' }}
            aria-label="Skip to next session"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // ── IDLE / SETUP: compact draggable modal ────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={popupRef}
        className="absolute bg-white dark:bg-slate-900 rounded-2xl shadow-xl
          border border-slate-200 dark:border-slate-800 min-w-[280px] overflow-hidden
          animate-[slideUp_0.25s_ease] motion-reduce:animate-none select-none"
        style={{
          right:  pos.x ? undefined : '24px',
          bottom: pos.y ? undefined : '100px',
          left:   pos.x ? `${pos.x}px` : undefined,
          top:    pos.y ? `${pos.y}px` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / drag handle */}
        <div
          className="px-4 pt-4 pb-2 flex justify-between items-center cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <span className="font-bold text-[1rem] text-slate-800 dark:text-white">
            ⏱ Focus
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
              text-[1.25rem] leading-none min-h-[44px] min-w-[44px]
              inline-flex items-center justify-center"
            aria-label="Close pomodoro timer"
          >
            ×
          </button>
        </div>

        {/* Ring + time */}
        <div className="flex flex-col items-center py-5 px-4 w-full">
          <div className="relative w-40 h-40">
            <svg
              width="160"
              height="160"
              viewBox="0 0 160 160"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Neutral track */}
              <circle
                cx="80" cy="80" r="70"
                fill="none"
                stroke="var(--color-pomodoro-track)"
                strokeWidth="7"
              />
              {/* Accent progress arc */}
              <circle
                cx="80" cy="80" r="70"
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={MODAL_CIRCUMFERENCE}
                strokeDashoffset={modalOffset}
                style={{
                  stroke: arcColor,
                  transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
                }}
              />
            </svg>

            {/* Time + mode label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span
                className="text-[2.5rem] font-bold tabular-nums tracking-tight leading-none
                  text-slate-800 dark:text-white"
              >
                {timeStr}
              </span>
              <span className="text-[0.6875rem] font-medium text-slate-400 dark:text-slate-500">
                {SESSION_LABELS[session]}
              </span>
            </div>
          </div>

        </div>

        {/* Primary + reset controls */}
        <div className="flex gap-2 justify-center pb-4">
          <button
            onClick={toggleTimer}
            className="px-8 py-2.5 rounded-xl text-[0.875rem] font-semibold tracking-wide
              text-white active:scale-95 motion-reduce:scale-100 active:opacity-80
              transition-all min-h-[44px]"
            style={{ backgroundColor: arcColor }}
            aria-label={
              timeLeft < durations[session] * 60 ? 'Resume timer' : 'Start timer'
            }
          >
            {timeLeft < durations[session] * 60 ? 'RESUME' : 'START'}
          </button>
          <button
            onClick={resetTimer}
            className="px-4 py-2.5 rounded-xl text-[0.875rem] text-slate-500 dark:text-slate-400
              bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700
              hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
            aria-label="Reset timer"
          >
            ↺
          </button>
        </div>

        {/* Duration stepper panel */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3">
          <div className="text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500
            uppercase tracking-wider mb-2">
            Durations
          </div>
          <div className="flex flex-col gap-1.5">
            {(['work', 'short', 'long'] as SessionType[]).map((type) => (
              <div key={type} className="flex justify-between items-center">
                <button
                  onClick={() => switchSession(type)}
                  className={`text-[0.875rem] px-2 py-1 rounded-lg transition-colors min-h-[36px]
                    text-left font-medium
                    ${type === session
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  style={type === session ? { color: arcColor } : undefined}
                  aria-label={`Switch to ${SESSION_LABELS[type]}`}
                >
                  {type === 'work' ? 'Work' : type === 'short' ? 'Short break' : 'Long break'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustDuration(type, type === 'short' ? -1 : -5)}
                    disabled={type === session && running}
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700
                      text-slate-400 dark:text-slate-500 text-[1rem]
                      hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center
                      transition-colors active:scale-90 motion-reduce:scale-100
                      disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`Decrease ${type} duration`}
                  >
                    −
                  </button>
                  <span className="text-[0.8125rem] font-semibold text-slate-700 dark:text-slate-300
                    w-9 text-center tabular-nums">
                    {durations[type]}m
                  </span>
                  <button
                    onClick={() => adjustDuration(type, type === 'short' ? 1 : 5)}
                    disabled={type === session && running}
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700
                      text-slate-400 dark:text-slate-500 text-[1rem]
                      hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center
                      transition-colors active:scale-90 motion-reduce:scale-100
                      disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`Increase ${type} duration`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
