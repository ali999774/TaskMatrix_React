// useRefetchOnFocus — calls a callback when the screen regains focus.
// Three triggers: Capacitor app foreground, web tab visibility, and
// a manual refetch() for wiring to pull-to-refresh or similar.
//
// Skips the initial mount — only fires on actual focus gain after
// background or tab switch.

import { useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'

export function useRefetchOnFocus(onFocus: () => void) {
  const mountedRef = useRef(false)
  const callbackRef = useRef(onFocus)
  callbackRef.current = onFocus

  // ── Capacitor: background → foreground ──────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let handle: PluginListenerHandle | undefined
    CapacitorApp.addListener('appStateChange', (state: { isActive: boolean }) => {
      if (state.isActive && mountedRef.current) {
        callbackRef.current()
      }
    }).then(h => { handle = h }).catch(() => { /* plugin not available */ })

    return () => {
      handle?.remove()
    }
  }, [])

  // ── Web: tab visibility ─────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        callbackRef.current()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // Mark mounted after first render so initial mount doesn't trigger
  useEffect(() => {
    mountedRef.current = true
  }, [])

  // Manual refetch for pull-to-refresh / explicit user action
  const refetch = useCallback(() => {
    callbackRef.current()
  }, [])

  return { refetch }
}
