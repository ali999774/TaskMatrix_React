// CalendarStrip — today's Google Calendar events, shown above the matrix
// Appears only when calendar is connected and events exist

import { Calendar, Clock, ExternalLink } from 'lucide-react'
import type { CalendarEvent } from '../lib/gcal'

interface Props {
  events: CalendarEvent[]
  isConnected: boolean
  isLoading: boolean
  onConnect: () => void
}

export default function CalendarStrip({ events, isConnected, isLoading, onConnect }: Props) {
  // Not connected — show connect prompt
  if (!isConnected) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-600">
        <button
          onClick={onConnect}
          disabled={isLoading}
          className="w-full flex items-center gap-2 text-[0.8125rem] text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-h-[44px] disabled:opacity-50"
        >
          <Calendar className="w-4 h-4 flex-shrink-0" />
          {isLoading ? 'Connecting…' : '📅 Connect Google Calendar to see today\'s events'}
        </button>
      </div>
    )
  }

  // Loading
  if (isLoading && events.length === 0) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 animate-pulse">
          <Calendar className="w-4 h-4" />
          <span>Loading today's events…</span>
        </div>
      </div>
    )
  }

  // No events today
  if (events.length === 0) {
    return (
      <div className="mx-3 mb-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-[0.75rem] text-slate-400 dark:text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>No events today</span>
        </div>
      </div>
    )
  }

  // Events exist
  const now = new Date()
  const upcoming = events.filter(e => new Date(e.start) > now)
  const current = events.find(e => new Date(e.start) <= now && new Date(e.end) > now)

  return (
    <div className="mx-3 mb-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Current event banner */}
      {current && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            <span className="text-[0.75rem] font-medium text-blue-700 dark:text-blue-300">Now</span>
            <span className="text-[0.8125rem] text-blue-800 dark:text-blue-200 truncate">{current.summary}</span>
            <span className="text-[0.6875rem] text-blue-500 ml-auto flex-shrink-0">
              until {new Date(current.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}

      {/* Upcoming events list */}
      <div className="px-4 py-2 space-y-1.5">
        {upcoming.slice(0, 5).map((event) => {
          const start = new Date(event.start)
          const timeStr = event.isAllDay
            ? 'All day'
            : start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

          return (
            <div key={event.id} className="flex items-center gap-2 group">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="text-[0.6875rem] text-slate-400 w-12 flex-shrink-0">{timeStr}</span>
                <span className="text-[0.8125rem] text-slate-700 dark:text-slate-300 truncate">{event.summary}</span>
              </div>
              {event.htmlLink && (
                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition-opacity flex-shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                  aria-label={`Open ${event.summary} in Google Calendar`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )
        })}

        {upcoming.length > 5 && (
          <p className="text-[0.6875rem] text-slate-400 pl-9">
            +{upcoming.length - 5} more events
          </p>
        )}
      </div>
    </div>
  )
}
