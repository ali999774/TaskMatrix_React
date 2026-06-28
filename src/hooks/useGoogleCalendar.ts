// useGoogleCalendar — incremental GIS auth for Calendar scope
// Opt-in only — no permission prompt unless user explicitly connects

import { useState, useEffect, useCallback } from 'react'
import { connectCalendar, disconnectCalendar, isCalendarConnected, fetchTodayEvents, formatEventsForContext } from '../lib/gcal'
import type { CalendarEvent } from '../lib/gcal'

interface UseGoogleCalendar {
  isConnected: boolean
  isLoading: boolean
  todayEvents: CalendarEvent[]
  todayEventsText: string
  connect: () => Promise<{ success: boolean; error?: string }>
  disconnect: () => void
}

export function useGoogleCalendar(): UseGoogleCalendar {
  const [isConnected, setIsConnected] = useState(() => isCalendarConnected())
  const [isLoading, setIsLoading] = useState(false)
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [todayEventsText, setTodayEventsText] = useState('')

  // Fetch today's events when connected
  useEffect(() => {
    if (!isConnected) {
      setTodayEvents([])
      setTodayEventsText('')
      return
    }

    let cancelled = false
    setIsLoading(true)
    fetchTodayEvents().then(events => {
      if (cancelled) return
      setTodayEvents(events)
      setTodayEventsText(formatEventsForContext(events))
      setIsLoading(false)
    }).catch(() => {
      if (cancelled) return
      setIsLoading(false)
    })

    // Refresh every 5 minutes
    const interval = setInterval(() => {
      fetchTodayEvents().then(events => {
        if (cancelled) return
        setTodayEvents(events)
        setTodayEventsText(formatEventsForContext(events))
      }).catch(() => {})
    }, 5 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isConnected])

  const connect = useCallback(async () => {
    setIsLoading(true)
    const result = await connectCalendar()
    setIsLoading(false)
    if (result.success) {
      setIsConnected(true)
      // Token stored — the useEffect above will fetch events
    }
    return result
  }, [])

  const disconnect = useCallback(() => {
    disconnectCalendar()
    setIsConnected(false)
    setTodayEvents([])
    setTodayEventsText('')
  }, [])

  return {
    isConnected,
    isLoading,
    todayEvents,
    todayEventsText,
    connect,
    disconnect,
  }
}
