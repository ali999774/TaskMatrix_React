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
