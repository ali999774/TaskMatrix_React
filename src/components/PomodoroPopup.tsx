import { useRef, useCallback, useState } from 'react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { usePomodoro, SESSION_LABELS } from '../hooks/usePomodoro'
import type { SessionType } from '../hooks/usePomodoro'

// Ring geometry constants
const MODAL_CIRCUMFERENCE = 502.65  // 2π × 80  (idle compact ring)
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

  // Idle-dial progress-head dot: leading edge of the arc (r=80, center 88,88),
  // -90° so 0 progress sits at 12 o'clock to match the rotated ring.
  const dotAngle = progress * 2 * Math.PI - Math.PI / 2
  const dotX = 88 + 80 * Math.cos(dotAngle)
  const dotY = 88 + 80 * Math.sin(dotAngle)
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
                className="text-[4.5rem] max-sm:text-[5rem] font-bold tabular-nums tracking-tighter leading-none"
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
      className={`fixed inset-0 z-50 ${pos.x || pos.y ? '' : 'flex items-end justify-center pb-[calc(5rem+env(safe-area-inset-bottom))]'}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={popupRef}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl
          border border-slate-200 dark:border-slate-800 w-[300px] overflow-hidden
          animate-[slideUp_0.25s_ease] motion-reduce:animate-none select-none"
        style={pos.x || pos.y ? {
          position: 'absolute',
          left:   pos.x ? `${pos.x}px` : undefined,
          top:    pos.y ? `${pos.y}px` : undefined,
          right:  pos.x ? undefined : '16px',
          bottom: pos.y ? undefined : '92px',
        } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Back — out of the centered flow so it never pushes the dial off-axis */}
        <button
          onClick={onClose}
          aria-label="Back"
          className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full flex items-center justify-center
            text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        {/* Drag handle strip — keeps the modal repositionable (back button excluded) */}
        <div
          className="h-12 cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />

        {/* Single centered column — dial, primary action, and config share one axis */}
        <div className="flex flex-col items-center px-6 pb-6">
          {/* Dial */}
          <div className="relative w-44 h-44">
            <svg
              width="176"
              height="176"
              viewBox="0 0 176 176"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Neutral track (slate-200) */}
              <circle
                cx="88" cy="88" r="80"
                fill="none"
                stroke="var(--color-pomodoro-track)"
                strokeWidth="8"
              />
              {/* Progress arc — same emerald token as the START button */}
              <circle
                cx="88" cy="88" r="80"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 80}
                strokeDashoffset={modalOffset}
                style={{
                  stroke: 'var(--color-pomodoro-work)',
                  transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
                }}
              />
            </svg>

            {/* Progress-head dot at the arc's leading edge */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 14,
                height: 14,
                left: `${dotX}px`,
                top: `${dotY}px`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'var(--color-pomodoro-work)',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
              }}
            />

            {/* Time display — the visual hero */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[2.5rem] max-sm:text-[3rem] font-bold tabular-nums tracking-tight leading-none text-slate-700 dark:text-slate-200"
              >
                {timeStr}
              </span>
            </div>
          </div>

          {/* Primary action (centered) + demoted ghost reset (absolute right) */}
          <div className="relative flex justify-center w-full mt-8">
            <button
              onClick={toggleTimer}
              className="px-8 py-2.5 rounded-2xl text-[0.875rem] font-semibold tracking-wide
                text-white bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500
                active:scale-95 motion-reduce:scale-100 active:opacity-90
                transition-all min-h-[44px] shadow-lg shadow-emerald-500/20"
              aria-label={
                timeLeft < durations[session] * 60 ? 'Resume timer' : 'Start timer'
              }
            >
              {timeLeft < durations[session] * 60 ? 'RESUME' : 'START'}
            </button>
            <button
              onClick={resetTimer}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center
                text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Reset timer"
            >
              <RotateCcw size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {/* Config row — Work selector + stepper as a matched pair */}
          <div className="flex items-center justify-center gap-2 w-full mt-6">
            <select
              value={session}
              onChange={(e) => switchSession(e.target.value as SessionType)}
              className="h-9 text-[0.875rem] font-medium px-3 rounded-lg bg-slate-100 dark:bg-slate-800
                border border-slate-200 dark:border-slate-700 outline-none cursor-pointer
                text-slate-700 dark:text-slate-200"
              aria-label="Session mode"
            >
              <option value="work">Work</option>
              <option value="short">Short break</option>
              <option value="long">Long break</option>
            </select>
            <div className="flex items-center h-9 rounded-lg bg-slate-100 dark:bg-slate-800
              border border-slate-200 dark:border-slate-700 px-1">
              <button
                onClick={() => adjustDuration(session, session === 'short' ? -1 : -5)}
                disabled={running}
                className="w-7 h-7 rounded-md text-slate-500 dark:text-slate-400 text-[1rem]
                  hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center
                  transition-colors active:scale-90 motion-reduce:scale-100
                  disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Decrease duration"
              >
                −
              </button>
              <span className="text-[0.8125rem] font-semibold text-slate-700 dark:text-slate-300
                w-9 text-center tabular-nums">
                {durations[session]}m
              </span>
              <button
                onClick={() => adjustDuration(session, session === 'short' ? 1 : 5)}
                disabled={running}
                className="w-7 h-7 rounded-md text-slate-500 dark:text-slate-400 text-[1rem]
                  hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center
                  transition-colors active:scale-90 motion-reduce:scale-100
                  disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Increase duration"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
