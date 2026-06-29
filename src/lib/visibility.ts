// Visibility predicates — when does a task/occurrence demand attention?
//
// Two surfaces, two rules:
//   • Today    — the "act on it now" list.  A task shows once it reaches its
//                show_date (due_date − lead_days) or once it is overdue.
//   • Upcoming — a flat rolling horizon (UPCOMING_HORIZON_DAYS).  Any incomplete
//                occurrence whose due_date falls inside the horizon shows here,
//                REGARDLESS of its lead_days, so a task can never be "due soon
//                but completely invisible."  It is the relief valve.
//
// These are small, pure, testable functions.  `lead_days` is coalesced NULL→0
// ONLY inside this module (read-time) — never at write time.

import { parseLocalDate } from './dates'

/**
 * The Upcoming horizon, in days.  A single named constant by design: it will be
 * tuned by feel later and must be changeable in exactly one place.  Do not
 * scatter the literal 7.
 */
export const UPCOMING_HORIZON_DAYS = 7

/** Minimal shape the predicates need — a Task satisfies this structurally. */
export interface VisibilityOccurrence {
  due_date?: string | null
  lead_days?: number | null
  status?: string | null
}

/** Add (or subtract, for negative `days`) calendar days to a 'YYYY-MM-DD' string. */
function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isComplete(o: VisibilityOccurrence): boolean {
  return o.status === 'done'
}

/**
 * show_date = due_date − coalesce(lead_days, 0).  The day a task starts
 * demanding attention.  Returns null when there is no due_date.
 * NULL lead is coalesced to 0 HERE (read-time) only.
 */
export function showDate(o: VisibilityOccurrence): string | null {
  if (!o.due_date) return null
  const lead = o.lead_days ?? 0
  return addDays(o.due_date, -lead)
}

/**
 * Today rule: today >= due_date − coalesce(lead_days, 0)  OR  overdue-and-incomplete.
 * Date comparisons use lexicographic ordering of 'YYYY-MM-DD' strings, which is
 * correct for the zero-padded ISO format.
 */
export function isInTodayView(o: VisibilityOccurrence, today: string): boolean {
  if (!o.due_date) return false
  const show = showDate(o)
  if (show !== null && today >= show) return true
  // overdue-and-incomplete
  if (!isComplete(o) && o.due_date < today) return true
  return false
}

/**
 * Upcoming rule: incomplete  AND  not yet promoted to Today (today < show_date)
 * AND  due_date <= today + UPCOMING_HORIZON_DAYS.
 * This is mutually exclusive with isInTodayView's promotion clause, so a task is
 * never in both Today and Upcoming.
 */
export function isInUpcomingView(o: VisibilityOccurrence, today: string): boolean {
  if (!o.due_date) return false
  if (isComplete(o)) return false
  const show = showDate(o)
  if (show === null || !(today < show)) return false // already promoted to Today
  const horizonEnd = addDays(today, UPCOMING_HORIZON_DAYS)
  return o.due_date <= horizonEnd
}
