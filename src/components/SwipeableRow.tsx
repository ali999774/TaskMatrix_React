import { useState, useRef, useCallback } from 'react'

export interface SwipeAction {
  label: string
  icon: string
  className: string
  onAction: () => void
}

interface Props {
  children: React.ReactNode
  actions: SwipeAction[]
  onTap?: () => void
  className?: string
  'aria-label'?: string
}

/**
 * Touch/mouse swipe-to-reveal action buttons.
 * Swipe left on mobile to reveal action buttons behind the card.
 * Desktop: click-and-drag left also works.
 */
export default function SwipeableRow({ children, actions, onTap, className = '', 'aria-label': ariaLabel }: Props) {
  const [translateX, setTranslateX] = useState(0)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const swipingRef = useRef(false)
  const openRef = useRef(false)
  const rowRef = useRef<HTMLDivElement>(null)

  const ACTION_WIDTH = 56
  const MAX_SWIPE = actions.length * ACTION_WIDTH
  const SWIPE_THRESHOLD = 60

  const onStart = useCallback((clientX: number, clientY: number) => {
    startRef.current = { x: clientX, y: clientY }
    swipingRef.current = false
  }, [])

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startRef.current) return
      const dx = clientX - startRef.current.x
      const dy = clientY - startRef.current.y

      if (!swipingRef.current && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) {
        swipingRef.current = true
      }

      if (swipingRef.current) {
        const base = openRef.current ? -MAX_SWIPE : 0
        let newX = base + dx
        newX = Math.max(-MAX_SWIPE - 20, Math.min(20, newX))
        setTranslateX(newX)
      }
    },
    [MAX_SWIPE]
  )

  const onEnd = useCallback(() => {
    if (!startRef.current) return
    startRef.current = null

    if (swipingRef.current) {
      if (translateX < -SWIPE_THRESHOLD) {
        setTranslateX(-MAX_SWIPE)
        openRef.current = true
      } else {
        setTranslateX(0)
        openRef.current = false
      }
      swipingRef.current = false
    }
  }, [translateX, SWIPE_THRESHOLD, MAX_SWIPE])

  const handleTouchStart = (e: React.TouchEvent) => {
    onStart(e.touches[0].clientX, e.touches[0].clientY)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    onMove(e.touches[0].clientX, e.touches[0].clientY)
  }
  const handleTouchEnd = () => onEnd()

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle primary button
    if (e.button !== 0) return
    onStart(e.clientX, e.clientY)
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!startRef.current) return
    onMove(e.clientX, e.clientY)
  }
  const handleMouseUp = () => onEnd()

  const handleClick = () => {
    if (openRef.current) {
      setTranslateX(0)
      openRef.current = false
    } else {
      onTap?.()
    }
  }

  const handleAction = (fn: () => void) => {
    setTranslateX(0)
    openRef.current = false
    fn()
  }

  return (
    <div
      ref={rowRef}
      className={`relative overflow-hidden rounded-xl ${className}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Action buttons — rendered behind the sliding card */}
      <div className="absolute inset-y-0 right-0 flex rounded-r-xl overflow-hidden">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation()
              handleAction(action.onAction)
            }}
            aria-label={action.label}
            className={`${action.className} w-[56px] h-full flex flex-col items-center justify-center gap-0.5 text-white font-medium transition-colors min-h-[44px] min-w-[44px]`}
          >
            <span className="text-[1.25rem] leading-none" aria-hidden="true">
              {action.icon}
            </span>
            <span
              className="text-[0.625rem] uppercase tracking-wide opacity-90 leading-none"
              aria-hidden="true"
            >
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Sliding card surface */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        className="relative bg-inherit transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
}
