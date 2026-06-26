// Date-only strings ('YYYY-MM-DD') passed to `new Date()` are parsed as UTC
// midnight per the ECMAScript spec. In US timezones that's the *previous*
// evening local time, so due dates render one day early and "Today" math is
// off by one. Always parse date-only strings as LOCAL midnight instead.
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Local YYYY-MM-DD (NOT toISOString(), which converts to UTC and can shift
// the date depending on timezone offset).
export function localTodayStr(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Full weekday + date, e.g. "Saturday, May 30, 2026". Parses the date-only
// string as local midnight to avoid the UTC off-by-one (see parseLocalDate).
export function formatLongDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 'HH:MM' (24h) → locale time string, e.g. "9:30 AM".
export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
