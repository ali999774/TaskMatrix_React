import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications'
import { supabase } from '../lib/supabase'

/**
 * Register for push notifications and sync the APNs device token to Supabase.
 * Call once after the user is authenticated.
 *
 * Flow:
 *  1. requestPermissions() → prompt iOS notification permission
 *  2. register() → get APNs token
 *  3. Store token in supabase device_tokens table
 *  4. Listen for incoming notifications (foreground toast)
 *  5. Listen for notification taps → open task detail
 */
export function usePushNotifications(userId: string | null) {
  const registered = useRef(false)

  useEffect(() => {
    // Only register on native (iOS) and only once per session, after auth
    if (!Capacitor.isNativePlatform() || !userId || registered.current) return
    registered.current = true

    const setup = async () => {
      // 1. Request permission
      const perm = await PushNotifications.checkPermissions()
      if (perm.receive !== 'granted') {
        const req = await PushNotifications.requestPermissions()
        if (req.receive !== 'granted') {
          console.log('[Push] Permission denied')
          return
        }
      }

      // 2. Listen for registration token
      PushNotifications.addListener('registration', async (token: Token) => {
        console.log('[Push] Token:', token.value.slice(0, 10) + '...')
        // Store in Supabase
        const { error } = await supabase
          .from('device_tokens')
          .upsert({
            user_id: userId,
            token: token.value,
            platform: 'ios',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,token' })

        if (error) console.error('[Push] Failed to store token:', error.message)
      })

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Registration error:', err.error)
      })

      // 3. Foreground notification received
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('[Push] Received:', notification.title, notification.body)
        // Capacitor shows the system notification automatically.
        // We could show an in-app toast here if desired.
      })

      // 4. User tapped a notification → deep-link into task
      PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('[Push] Tapped:', action.notification.data)
        // The app opens; data payload can route to a specific task
        const { task_id } = action.notification.data || {}
        if (task_id) {
          // Dispatch custom event so App.tsx can pick it up
          window.dispatchEvent(new CustomEvent('tm:open-task', { detail: { task_id } }))
        }
      })

      // 5. Register with APNs
      await PushNotifications.register()
    }

    setup()
  }, [userId])

  // Listen for sign-out → unregister
  useEffect(() => {
    if (userId || !registered.current) return
    // User signed out — unregister push
    PushNotifications.unregister().catch(() => {})
    registered.current = false
  }, [userId])
}
