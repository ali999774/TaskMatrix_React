// Unit tests for the pure recurrence helpers.
// Run with Node's built-in runner (no extra deps), TS stripped on the fly:
//   node --experimental-strip-types --test src/lib/recurrence.test.ts
// (Co-located under src/ so Playwright's testDir ./tests does not pick it up.)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchesSeries,
  findActiveSeriesClone,
  hasActiveOccurrenceOnDate,
  findSpawnedSiblingOnUncomplete,
  seriesKey,
  type SeriesTaskFields,
} from './recurrence.ts'

const T = (o: Partial<SeriesTaskFields> & { id: string }): SeriesTaskFields => ({
  status: 'todo',
  recurring: true,
  recur_frequency: 'daily',
  ...o,
})

test('seriesKey falls back to row id when series_id is absent', () => {
  assert.equal(seriesKey(T({ id: 'a' })), 'a')
  assert.equal(seriesKey(T({ id: 'a', series_id: 's1' })), 's1')
})

test('matchesSeries: matches by series_id', () => {
  const target = T({ id: 'cur', series_id: 's1' })
  assert.ok(matchesSeries(T({ id: 'other', series_id: 's1' }), target))
  assert.ok(!matchesSeries(T({ id: 'other', series_id: 's2' }), target))
})

test('matchesSeries: null-series fallback uses title + frequency', () => {
  const target = T({ id: 'cur', series_id: null, title: 'Water plants', recur_frequency: 'weekly' })
  assert.ok(matchesSeries(T({ id: 'o1', series_id: null, title: 'Water plants', recur_frequency: 'weekly' }), target))
  // different title → not the same series
  assert.ok(!matchesSeries(T({ id: 'o2', series_id: null, title: 'Pay rent', recur_frequency: 'weekly' }), target))
  // different frequency → not the same series
  assert.ok(!matchesSeries(T({ id: 'o3', series_id: null, title: 'Water plants', recur_frequency: 'daily' }), target))
})

test('findActiveSeriesClone ignores self, done, and soft-deleted rows', () => {
  const target = T({ id: 'cur', series_id: 's1' })
  const tasks = [
    target,
    T({ id: 'done', series_id: 's1', status: 'done' }),
    T({ id: 'deleted', series_id: 's1', deleted_at: '2026-06-29T00:00:00Z' }),
  ]
  assert.equal(findActiveSeriesClone(tasks, target), null)

  const live = T({ id: 'live', series_id: 's1' })
  assert.equal(findActiveSeriesClone([...tasks, live], target)?.id, 'live')
})

test('hasActiveOccurrenceOnDate guards a filled occurrence_date', () => {
  const target = T({ id: 'cur', series_id: 's1', due_date: '2026-06-30' })
  const tasks = [target, T({ id: 'next', series_id: 's1', due_date: '2026-07-01' })]
  assert.ok(hasActiveOccurrenceOnDate(tasks, target, '2026-07-01'))
  assert.ok(!hasActiveOccurrenceOnDate(tasks, target, '2026-07-02'))
})

test('early-completion undo: spawned forward occurrence is the one retracted', () => {
  // Scenario: "tomorrow's" occurrence (2026-06-30) was completed today; the
  // spawn created day-after-tomorrow (2026-07-01). Undoing the completion must
  // identify the 2026-07-01 sibling for retraction.
  const completed = T({ id: 'cur', series_id: 's1', due_date: '2026-06-30', status: 'todo' })
  const spawned = T({ id: 'spawn', series_id: 's1', due_date: '2026-07-01' })
  const sibling = findSpawnedSiblingOnUncomplete([completed, spawned], completed)
  assert.equal(sibling?.id, 'spawn')
})

test('undo does not retract an earlier or same-dated occurrence', () => {
  const target = T({ id: 'cur', series_id: 's1', due_date: '2026-06-30' })
  const earlier = T({ id: 'old', series_id: 's1', due_date: '2026-06-29' })
  const same = T({ id: 'same', series_id: 's1', due_date: '2026-06-30' })
  assert.equal(findSpawnedSiblingOnUncomplete([target, earlier, same], target), null)
})
