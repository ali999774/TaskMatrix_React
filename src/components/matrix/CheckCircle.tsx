import { useRef } from 'react'
import { useHaptics } from '../../hooks/useHaptics'

interface CheckCircleProps {
  status: string
  onToggle: () => void
}

/**
 * Interactive status toggle circle.
 * Encapsulates haptic feedback and the completion chime —
 * shared by TaskCard in both MatrixList and MatrixGrid.
 */
export default function CheckCircle({ status, onToggle }: CheckCircleProps) {
  const haptics = useHaptics()
  // Prevent the chime from stacking when tapped rapidly
  const audioRef = useRef<AudioContext | null>(null)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    const isDone = status === 'done'
    const nextIsDone = !isDone

    if (nextIsDone) {
      haptics('success')
      // Play a subtle completion chime
      try {
        // Reuse context if available (Chrome limits concurrent AudioContexts)
        const ctx = audioRef.current ?? new AudioContext()
        audioRef.current = ctx
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = 'sine'
        o.frequency.setValueAtTime(880, ctx.currentTime)
        o.frequency.setValueAtTime(1100, ctx.currentTime + 0.08)
        g.gain.setValueAtTime(0.15, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        o.start(ctx.currentTime)
        o.stop(ctx.currentTime + 0.3)
      } catch { /* AudioContext may not be available */ }
    } else {
      haptics('light')
    }

    onToggle()
  }

  const isDone = status === 'done'

  return (
    <button
      onClick={handleClick}
      className={`mt-0.5 text-[1.125rem] flex-shrink-0 transition-colors
        active:scale-90 motion-reduce:scale-100
        min-h-[44px] min-w-[44px] inline-flex items-center justify-center
        ${isDone
          ? 'text-emerald-500 dark:text-emerald-400'
          : 'text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300'
        }`}
      title={`Status: ${status}`}
      aria-label={`Cycle status: ${status}`}
    >
      {isDone ? '●' : '○'}
    </button>
  )
}
