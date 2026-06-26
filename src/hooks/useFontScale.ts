import { useState, useEffect, useCallback } from 'react'

// Global type scale. The app's type is rem-based off the <html> root, so a single
// root font-size multiplier scales every text size consistently. Discrete steps
// (not a slider) keep layout reflow predictable and mirror iOS Dynamic Type.
//
// Device-local (localStorage, like the theme) — text size is a per-device display
// preference, so it intentionally does NOT sync through Supabase / the offline queue.

export interface FontScaleOption {
  key: string
  /** Multiplier applied to the 16px root. */
  size: number
  /** Accessible name for the step. */
  aria: string
}

export const FONT_SCALES: FontScaleOption[] = [
  { key: 'sm', size: 0.9, aria: 'Small text' },
  { key: 'md', size: 1.0, aria: 'Default text size' },
  { key: 'lg', size: 1.15, aria: 'Large text' },
  { key: 'xl', size: 1.3, aria: 'Extra large text' },
]

export const FONT_SCALE_LS_KEY = 'tm-font-scale'
const BASE_PX = 16

/**
 * Apply a scale to the document root. At scale 1 the explicit size is removed so
 * the app respects any ambient root size instead of pinning 16px; other steps set
 * an explicit px value that all rem units resolve against.
 */
export function applyFontScale(scale: number) {
  if (scale === 1) {
    document.documentElement.style.removeProperty('font-size')
  } else {
    document.documentElement.style.fontSize = `${BASE_PX * scale}px`
  }
}

export function useFontScale() {
  const [fontScale, setScale] = useState<number>(() => {
    const stored = parseFloat(localStorage.getItem(FONT_SCALE_LS_KEY) || '')
    return Number.isFinite(stored) && stored > 0 ? stored : 1
  })

  useEffect(() => {
    applyFontScale(fontScale)
    localStorage.setItem(FONT_SCALE_LS_KEY, String(fontScale))
  }, [fontScale])

  const setFontScale = useCallback((s: number) => setScale(s), [])

  return { fontScale, setFontScale }
}
