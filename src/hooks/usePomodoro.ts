import { useState, useRef, useCallback, useEffect } from 'react'
import { useHaptics } from './useHaptics'

export type SessionType = 'work' | 'short' | 'long'

export const SESSION_LABELS: Record<SessionType, string> = {
  work: 'Work',
  short: 'Short Break',
  long: 'Long Break',
}

export interface UsePomodoroReturn {
  durations: Record<SessionType, number>
  session: SessionType
  timeLeft: number
  running: boolean
  sessionCount: number
  toggleTimer: () => void
  resetTimer: () => void
  skipSession: () => void
  switchSession: (type: SessionType) => void
  adjustDuration: (type: SessionType, delta: number) => void
}

/**
 * usePomodoro — all timer state + logic for the Focus/Pomodoro feature.
 *
 * Strict behavior contract:
 * - State machine, time computation, round logic, notifications, and any
 *   completion sound are untouched here versus the original inline code.
 * - `toggleTimer` is intentionally NOT memoized so it always closes over
 *   the current `session` value at call time — same semantics as the
 *   original component-level function.
 */
export function usePomodoro(show: boolean): UsePomodoroReturn {
  const [durations, setDurations] = useState<Record<SessionType, number>>({
    work: 25,
    short: 5,
    long: 15,
  })
  const [session, setSession] = useState<SessionType>('work')
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const haptics = useHaptics()
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

  const switchSession = useCallback(
    (type: SessionType) => {
      stopTimer()
      setRunning(false)
      setSession(type)
      setTimeLeft(durations[type] * 60)
    },
    [durations, stopTimer],
  )

  // Not wrapped in useCallback — must close over the CURRENT `session` value
  // at the moment the user taps START so the interval's completion branch
  // advances to the correct next session type.
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
  }, [durations, session, stopTimer, haptics])

  // Skip to the next session without incrementing the completed-round count.
  const skipSession = useCallback(() => {
    haptics('light')
    if (session === 'work') {
      switchSession('short')
    } else {
      switchSession('work')
    }
  }, [session, switchSession, haptics])

  const adjustDuration = useCallback(
    (type: SessionType, delta: number) => {
      if (type === session && running) return
      const min = type === 'short' ? 1 : 5
      const max = type === 'work' ? 60 : type === 'short' ? 15 : 30
      const newVal = Math.max(min, Math.min(max, durations[type] + delta))
      setDurations((prev) => ({ ...prev, [type]: newVal }))
      // Reflect immediately when adjusting the current idle session
      if (type === session && !running) setTimeLeft(newVal * 60)
    },
    [durations, session, running],
  )

  return {
    durations,
    session,
    timeLeft,
    running,
    sessionCount,
    toggleTimer,
    resetTimer,
    skipSession,
    switchSession,
    adjustDuration,
  }
}
