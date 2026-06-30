// BottomSheet — reusable iOS-idiomatic bottom sheet overlay
// Drag-to-dismiss, backdrop scrim, focus trap, Escape-to-close.
// Internal scrolling when content overflows.

import { useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export default function BottomSheet({ open, onClose, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // ── Drag-to-dismiss ────────────────────────────────────────────
  const touchStartY = useRef<number | null>(null)
  const touchCurrentY = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only initiate drag-to-dismiss from the drag handle — otherwise
    // scrolling inside the content area triggers an accidental dismiss.
    const target = e.target as HTMLElement
    if (!target.closest('[data-drag-handle]')) return
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) {
      touchCurrentY.current = delta
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${delta}px)`
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current === null) return
    if (touchCurrentY.current > 100) {
      onClose()
    }
    touchStartY.current = null
    touchCurrentY.current = 0
    if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
  }, [onClose])

  // ── Focus trapping ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Return focus to the trigger element on close
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
      return
    }

    // Save current focus so we can restore it on close
    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus the sheet on open
    const sheet = sheetRef.current
    if (sheet) {
      // Small delay so the animation doesn't fight focus
      requestAnimationFrame(() => {
        sheet.focus()
      })
    }

    // Keyboard handler
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      // Simple focus trap: if Tab moves focus outside, loop it back
      if (e.key !== 'Tab' || !sheet) return
      const focusable = sheet.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // ── Body scroll lock — handled by App.tsx hasModal ─────────────

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center">
          {/* Backdrop scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet panel */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-full max-w-lg h-full bg-white dark:bg-slate-900
              rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700
              overflow-hidden flex flex-col
              pt-[env(safe-area-inset-top)]
              pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            {/* Drag handle */}
            <div data-drag-handle className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-8 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
