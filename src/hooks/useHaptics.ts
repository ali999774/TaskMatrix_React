import { useCallback } from 'react'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

type HapticType = 'light' | 'medium' | 'success'

export function useHaptics() {
  const fire = useCallback((type: HapticType = 'light') => {
    try {
      // Respect reduced-motion preference
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const isIOS = Capacitor.getPlatform() === 'ios'
      if (isIOS) {
        if (type === 'success') {
          Haptics.notification({ type: NotificationType.Success })
        } else {
          Haptics.impact({
            style: type === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
          })
        }
      } else {
        // Web fallback — subtle vibration
        const duration = type === 'medium' ? 15 : 8
        navigator.vibrate?.(duration)
      }
    } catch {
      // Haptics unavailable — silently skip
    }
  }, [])

  return fire
}
