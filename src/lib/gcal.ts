// Google Calendar integration — incremental GIS auth + Calendar API
// Uses Google Identity Services for Calendar scope (separate from Supabase sign-in)

const CLIENT_ID = '1074748783638-hn00a79u8e94ko90ql0mu1u3gvv32ojk.apps.googleusercontent.com'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly'
const TOKEN_KEY = 'tm-gcal-token'
const EXPIRY_KEY = 'tm-gcal-expires'

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
            error_callback?: (error: GoogleError) => void
          }) => TokenClient
        }
      }
    }
  }
}

interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void
}

interface GoogleError {
  message: string
  type: string
}

export interface CalendarEvent {
  id: string
  summary: string
  start: string // ISO datetime or date
  end: string
  isAllDay: boolean
  htmlLink: string
}

function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const expires = localStorage.getItem(EXPIRY_KEY)
  if (token && expires && Date.now() < parseInt(expires, 10)) {
    return token
  }
  clearStoredToken()
  return null
}

function setStoredToken(token: string, expiresIn: number): void {
  localStorage.setItem(TOKEN_KEY, token)
  // Expire 60s early to avoid edge cases
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + (expiresIn - 60) * 1000))
}

function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
}

export function isCalendarConnected(): boolean {
  return getStoredToken() !== null
}

export async function connectCalendar(): Promise<{ success: boolean; error?: string }> {
  if (!window.google?.accounts?.oauth2) {
    return { success: false, error: 'Google Identity Services not loaded' }
  }

  return new Promise((resolve) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: CALENDAR_SCOPE,
        callback: (response: TokenResponse) => {
          if (response.error) {
            resolve({ success: false, error: response.error_description || response.error })
          } else {
            setStoredToken(response.access_token, response.expires_in)
            resolve({ success: true })
          }
        },
        error_callback: (error: GoogleError) => {
          resolve({ success: false, error: error.message })
        }
      })

      // Use empty prompt to request silently first; GIS will show popup if needed
      client.requestAccessToken({ prompt: '' })
    } catch (err) {
      resolve({ success: false, error: String(err) })
    }
  })
}

export function disconnectCalendar(): void {
  clearStoredToken()
  // Also revoke the token if we have Google access
  const token = getStoredToken()
  if (token) {
    // Best-effort revocation — fires and forgets
    fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' }).catch(() => {})
  }
  clearStoredToken()
}

export async function fetchTodayEvents(): Promise<CalendarEvent[]> {
  const token = getStoredToken()
  if (!token) return []

  const now = new Date()
  const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  })

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearStoredToken()
      }
      return []
    }

    const data = await res.json()
    const items = data.items || []

    return items.map((item: Record<string, unknown>) => {
      const start = item.start as Record<string, string> | undefined
      const end = item.end as Record<string, string> | undefined
      return {
        id: item.id as string,
        summary: (item.summary as string) || '(no title)',
        start: start?.dateTime || start?.date || '',
        end: end?.dateTime || end?.date || '',
        isAllDay: !!(start?.date),
        htmlLink: item.htmlLink as string,
      }
    })
  } catch {
    return []
  }
}

// For the Morning Brief edge function — format events as context text
export function formatEventsForContext(events: CalendarEvent[]): string {
  if (events.length === 0) return 'No calendar events today.'

  return events.map(e => {
    if (e.isAllDay) return `- All day: ${e.summary}`
    const startTime = new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const endTime = new Date(e.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `- ${startTime}–${endTime}: ${e.summary}`
  }).join('\n')
}
