// Pure helpers for recurring-occurrence identity and spawn/undo decisions.
//
// Occurrences are materialized one row at a time and advanced on completion
// (see useTasks.updateStatus). These functions encode the (series_id,
// occurrence_date) identity the app relies on to prevent ghost resurrection,
// and the decisions around early completion:
//   • which active row counts as "the same series" (matchesSeries)
//   • whether a series already has a live occurrence (findActiveSeriesClone)
//   • whether a given occurrence_date is already taken (hasActiveOccurrenceOnDate)
//   • which forward occurrence to retract when an early completion is undone
//     (findSpawnedSiblingOnUncomplete)
//
// They are pure and structurally typed so they can be unit-tested without React.

/** The subset of Task fields these decisions read. Task satisfies this. */
export interface SeriesTaskFields {
  id: string
  series_id?: string | null
  status?: string | null
  deleted_at?: string | null
  title?: string
  recurring?: boolean
  recur_frequency?: string | null
  due_date?: string | null
}

/** A series is identified by its series_id, falling back to the row id. */
export function seriesKey(t: SeriesTaskFields): string {
  return t.series_id || t.id
}

/**
 * Whether `candidate` belongs to the same recurring series as `target`.
 * Primary match is series_id; the null-series fallback (title + frequency)
 * mirrors the legacy spawn guard so pre-series_id rows still de-dupe.
 */
export function matchesSeries(candidate: SeriesTaskFields, target: SeriesTaskFields): boolean {
  const key = seriesKey(target)
  if (candidate.series_id === key) return true
  return (
    candidate.series_id == null &&
    candidate.title === target.title &&
    candidate.recurring === true &&
    candidate.recur_frequency === target.recur_frequency
  )
}

function isActive(t: SeriesTaskFields): boolean {
  return t.status === 'todo' && !t.deleted_at
}

/**
 * An active (todo, not deleted) occurrence in `target`'s series other than
 * `target` itself — used as the spawn guard so a series never has two live
 * occurrences at once.
 */
export function findActiveSeriesClone<T extends SeriesTaskFields>(tasks: T[], target: SeriesTaskFields): T | null {
  return tasks.find((t) => t.id !== target.id && isActive(t) && matchesSeries(t, target)) ?? null
}

/**
 * Whether an active occurrence already occupies `date` in `target`'s series.
 * This is the explicit (series_id, occurrence_date) guard: it stops a second
 * occurrence from being created for a date that is already filled.
 */
export function hasActiveOccurrenceOnDate(tasks: SeriesTaskFields[], target: SeriesTaskFields, date: string): boolean {
  return tasks.some((t) => t.id !== target.id && isActive(t) && matchesSeries(t, target) && t.due_date === date)
}

/**
 * When an (early) completion is undone, the next occurrence that was spawned
 * forward must be retracted so undo doesn't leave a duplicate live sibling.
 * That sibling is the active same-series occurrence dated AFTER `target`
 * (when target has a due_date), else any active same-series sibling.
 */
export function findSpawnedSiblingOnUncomplete<T extends SeriesTaskFields>(tasks: T[], target: SeriesTaskFields): T | null {
  return (
    tasks.find(
      (t) =>
        t.id !== target.id &&
        isActive(t) &&
        matchesSeries(t, target) &&
        (target.due_date == null || (t.due_date != null && t.due_date > target.due_date)),
    ) ?? null
  )
}
