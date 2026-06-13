import { useState, useRef, useCallback, useEffect } from 'react'
import { useHaptics } from '../hooks/useHaptics'

type SessionType = 'work' | 'short' | 'long'

const SESSION_LABELS: Record<SessionType, string> = {
  work: 'Work',
  short: 'Short Break',
  long: 'Long Break',
}

const CIRCUMFERENCE = 439.8 // 2 * PI * 70

interface Props {
  show: boolean
  onClose: () => void
}

export default function PomodoroPopup({ show, onClose }: Props) {
  const [durations, setDurations] = useState({ work: 25, short: 5, long: 15 })
  const [session, setSession] = useState<SessionType>('work')
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const popupRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(pos)
  const haptics = useHaptics()
  // eslint-disable-next-line react-hooks/refs -- keep ref in sync for pointer event callbacks
  posRef.current = pos

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Request notification permission on first open
  useEffect(() => {
    if (show && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [show])

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), [stopTimer])

  const switchSession = useCallback((type: SessionType) => {
    stopTimer()
    setRunning(false)
    setSession(type)
    setTimeLeft(durations[type] * 60)
  }, [durations, stopTimer])

  const toggleTimer = () => {
    haptics(running ? 'light' : 'medium')
    if (running) {
      stopTimer()
      setRunning(false)
    } else {
      setRunning(true)
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopTimer()
            setRunning(false)
            // Auto-advance after completion
            setSessionCount((sc) => {
              const newCount = sc + 1
              // Notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Pomodoro complete!', {
                  body: session === 'work' ? 'Time for a break.' : 'Back to work!',
                })
              }
              // Advance session
              if (session === 'work') {
                const next: SessionType = newCount % 4 === 0 ? 'long' : 'short'
                switchSession(next)
              } else {
                switchSession('work')
              }
              return newCount
            })
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }

  const resetTimer = useCallback(() => {
    haptics('medium')
    stopTimer()
    setRunning(false)
    setTimeLeft(durations[session] * 60)
  }, [durations, session, stopTimer])

  const adjustDuration = useCallback((type: SessionType, delta: number) => {
    const min = type === 'short' ? 1 : 5
    const max = type === 'work' ? 60 : type === 'short' ? 15 : 30
    setDurations((prev) => {
      const newVal = Math.max(min, Math.min(max, prev[type] + delta))
      return { ...prev, [type]: newVal }
    })
  }, [])

  // Drag handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, select')) return
    // Seed actual screen position on first grab
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

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const total = durations[session] * 60
  const progress = total > 0 ? 1 - timeLeft / total : 0
  const offset = CIRCUMFERENCE * (1 - progress)

  return (
    <div className="fixed inset-0 z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={popupRef}
        className="absolute bg-white dark:bg-slate-900 rounded-2xl shadow-xl
          border border-slate-200 dark:border-slate-700 min-w-[280px] overflow-hidden
          animate-[slideUp_0.3s_ease] motion-reduce:animate-none select-none"
        style={{
          right: pos.x ? undefined : '24px',
          bottom: pos.y ? undefined : '100px',
          left: pos.x ? `${pos.x}px` : undefined,
          top: pos.y ? `${pos.y}px` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — drag handle */}
        <div
          className="px-4 pt-4 pb-2 flex justify-between items-center cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="font-bold text-[1rem] text-slate-800 dark:text-white">
            ⏱ Pomodoro
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={session}
              onChange={(e) => switchSession(e.target.value as SessionType)}
              className="text-[0.75rem] border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1
                bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="work">Work</option>
              <option value="short">Short Break</option>
              <option value="long">Long Break</option>
            </select>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[1.125rem] leading-none min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
              aria-label="Close pomodoro timer"
            >
              ×
            </button>
          </div>
        </div>

        {/* Circular timer */}
        <div className="flex flex-col items-center py-5">
          <div className="relative w-40 h-40">
            <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor"
                className="text-slate-200 dark:text-slate-700" strokeWidth="8" />
              <circle cx="80" cy="80" r="70" fill="none" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
                style={{
                  transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
                  stroke: session === 'work' ? '#ef4444' : session === 'short' ? '#22c55e' : '#f59e0b',
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold text-slate-800 dark:text-white tabular-nums tracking-tight">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </div>
              <div className="text-[0.75rem] text-slate-400 dark:text-slate-500 mt-0.5">
                {SESSION_LABELS[session]}
              </div>
            </div>
          </div>

          {/* Session dots */}
          <div className="flex gap-2 mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-colors duration-300"
                style={{
                  background: i < (sessionCount % 4)
                    ? '#3b82f6'
                    : 'var(--border-color, #d1d5db)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 justify-center pb-4">
          <button
            onClick={toggleTimer}
            className="px-8 py-2.5 rounded-lg text-[0.875rem] font-semibold tracking-wide text-white
              bg-blue-600 dark:bg-blue-500 text-white hover:opacity-90 active:scale-95 motion-reduce:scale-100 active:opacity-80 transition-all min-h-[44px]"
            aria-label={running ? 'Pause timer' : timeLeft < durations[session] * 60 ? 'Resume timer' : 'Start timer'}
          >
            {running ? 'PAUSE' : timeLeft < durations[session] * 60 ? 'RESUME' : 'START'}
          </button>
          <button
            onClick={resetTimer}
            className="px-4 py-2.5 rounded-lg text-[0.875rem] text-slate-500 dark:text-slate-400
              bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700
              hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
            aria-label="Reset timer"
          >
            ↺
          </button>
        </div>

        {/* Duration settings */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <div className="text-[0.75rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Durations
          </div>
          <div className="flex flex-col gap-2">
            {(['work', 'short', 'long'] as SessionType[]).map((type) => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-[0.875rem] text-slate-500 dark:text-slate-400">
                  {type === 'work' ? 'Work' : type === 'short' ? 'Short break' : 'Long break'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustDuration(type, type === 'short' ? -1 : -5)}
                    className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-600
                      text-slate-500 dark:text-slate-400 text-[1.125rem] hover:bg-slate-100 dark:hover:bg-slate-800
                      flex items-center justify-center transition-colors active:scale-90 motion-reduce:scale-100"
                    aria-label={`Decrease ${type} duration`}
                  >
                    −
                  </button>
                  <span className="text-[0.875rem] font-semibold text-slate-700 dark:text-slate-300 w-9 text-center tabular-nums">
                    {durations[type]}m
                  </span>
                  <button
                    onClick={() => adjustDuration(type, type === 'short' ? 1 : 5)}
                    className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-600
                      text-slate-500 dark:text-slate-400 text-[1.125rem] hover:bg-slate-100 dark:hover:bg-slate-800
                      flex items-center justify-center transition-colors active:scale-90 motion-reduce:scale-100"
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
