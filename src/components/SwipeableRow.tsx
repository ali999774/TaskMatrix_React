import { useRef } from 'react'
import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion'

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
  /** When false, renders iOS-style circular buttons with labels below */
  showLabels?: boolean
}

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.8 }

/**
 * Touch/mouse swipe-to-reveal action buttons backed by framer-motion.
 * Uses `useMotionValue` — zero React re-renders during drag, pure 60fps.
 */
export default function SwipeableRow({
  children,
  actions,
  onTap,
  className = '',
  'aria-label': ariaLabel,
  showLabels = true,
}: Props) {
  const x = useMotionValue(0)
  const openRef = useRef(false)

  // iOS mode: each column is 44px circle + gap
  // Classic mode: each button is 56px full-height block
  const colWidth = showLabels ? 56 : 44
  const maxSwipe = actions.length * colWidth

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = -maxSwipe * 0.4
    const shouldOpen = x.get() < threshold || info.velocity.x < -500

    if (shouldOpen) {
      animate(x, -maxSwipe, SPRING)
      openRef.current = true
    } else {
      animate(x, 0, SPRING)
      openRef.current = false
    }
  }

  const handleClick = () => {
    if (openRef.current) {
      animate(x, 0, SPRING)
      openRef.current = false
    } else {
      onTap?.()
    }
  }

  const handleAction = (fn: () => void) => {
    animate(x, 0, { ...SPRING, stiffness: 500 })
    openRef.current = false
    fn()
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {/* Action buttons behind the card */}
      <div className={`absolute inset-y-0 right-0 flex ${showLabels ? 'rounded-r-xl overflow-hidden' : 'items-center gap-1.5 pr-2'}`}>
        {actions.map((action, i) => (
          <motion.button
            key={i}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              handleAction(action.onAction)
            }}
            aria-label={action.label}
            className={`${action.className} ${
              showLabels
                ? 'w-[56px] h-full rounded-none'
                : 'w-11 h-11 rounded-full shadow-md'
            } flex items-center justify-center text-white font-medium`}
            whileTap={{ scale: 0.92 }}
          >
            <span className="text-[1.25rem] leading-none" aria-hidden="true">
              {action.icon}
            </span>
            {showLabels && (
              <span
                className="text-[0.625rem] uppercase tracking-wide opacity-90 leading-none mt-0.5"
                aria-hidden="true"
              >
                {action.label}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -maxSwipe, right: 0 }}
        dragElastic={0.08}
        dragSnapToOrigin={false}
        style={{ x, touchAction: 'pan-y' }}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        className="relative bg-inherit cursor-pointer"
        whileTap={{ cursor: 'grabbing' }}
      >
        {children}
      </motion.div>
    </div>
  )
}
