// Unit tests for the pure offline-queue coalescer.
// Run with Node's built-in runner (no extra deps), TS stripped on the fly:
//   node --experimental-strip-types --test src/lib/coalesce.test.ts
// (Co-located under src/ so Playwright's testDir ./tests does not pick it up.)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  coalesceMutations,
  type QueuedMutation,
} from './coalesce.ts'

const M = (o: Partial<QueuedMutation> & { id: number; operation: QueuedMutation['operation'] }): QueuedMutation => ({
  table: 'tasks',
  recordId: 'r1',
  timestamp: o.id, // default: id doubles as a monotonic timestamp
  ...o,
})

test('complete then undo on same id folds to one update with last-write-wins payload', () => {
  const mutations: QueuedMutation[] = [
    M({ id: 1, operation: 'update', payload: { status: 'done', completed_at: '2026-06-29T12:00:00Z' } }),
    M({ id: 2, operation: 'update', payload: { status: 'todo', completed_at: null } }),
  ]
  const result = coalesceMutations(mutations)
  assert.equal(result.length, 1)
  assert.equal(result[0].operation, 'update')
  assert.deepEqual(result[0].payload, { status: 'todo', completed_at: null })
  assert.deepEqual(result[0].sourceIds, [1, 2])
})

test('two updates on same id merge last-write-wins per key', () => {
  const mutations: QueuedMutation[] = [
    M({ id: 1, operation: 'update', payload: { title: 'A', priority: 1 } }),
    M({ id: 2, operation: 'update', payload: { title: 'B' } }),
  ]
  const result = coalesceMutations(mutations)
  assert.equal(result.length, 1)
  assert.equal(result[0].operation, 'update')
  // priority retained from first, title overwritten by second
  assert.deepEqual(result[0].payload, { title: 'B', priority: 1 })
})

test('create then update(s) on same id stays a create with merged payload', () => {
  const mutations: QueuedMutation[] = [
    M({ id: 1, operation: 'create', payload: { title: 'New', status: 'todo' } }),
    M({ id: 2, operation: 'update', payload: { status: 'done' } }),
    M({ id: 3, operation: 'update', payload: { completed_at: '2026-06-29T12:00:00Z' } }),
  ]
  const result = coalesceMutations(mutations)
  assert.equal(result.length, 1)
  assert.equal(result[0].operation, 'create')
  assert.deepEqual(result[0].payload, { title: 'New', status: 'done', completed_at: '2026-06-29T12:00:00Z' })
  assert.deepEqual(result[0].sourceIds, [1, 2, 3])
})

test('create then hard delete on same id folds to noop with all source ids', () => {
  const mutations: QueuedMutation[] = [
    M({ id: 1, operation: 'create', payload: { title: 'Ephemeral' } }),
    M({ id: 2, operation: 'delete' }),
  ]
  const result = coalesceMutations(mutations)
  assert.equal(result.length, 1)
  assert.equal(result[0].operation, 'noop')
  assert.deepEqual(result[0].payload, {})
  assert.deepEqual(result[0].sourceIds, [1, 2])
})

test('update followed by soft-delete (update with deleted_at) stays an update carrying deleted_at', () => {
  const mutations: QueuedMutation[] = [
    M({ id: 1, operation: 'update', payload: { title: 'Keep' } }),
    M({ id: 2, operation: 'update', payload: { deleted_at: '2026-06-29T12:00:00Z' } }),
  ]
  const result = coalesceMutations(mutations)
  assert.equal(result.length, 1)
  assert.equal(result[0].operation, 'update')
  assert.equal(result[0].payload.deleted_at, '2026-06-29T12:00:00Z')
  assert.equal(result[0].payload.title, 'Keep')
})

test('mutations for two different ids produce two separate coalesced mutations', () => {
  const mutations: QueuedMutation[] = [
    M({ id: 1, recordId: 'a', operation: 'update', payload: { status: 'done' } }),
    M({ id: 2, recordId: 'b', operation: 'update', payload: { status: 'todo' } }),
  ]
  const result = coalesceMutations(mutations)
  assert.equal(result.length, 2)
  const a = result.find((r) => r.recordId === 'a')
  const b = result.find((r) => r.recordId === 'b')
  assert.deepEqual(a?.payload, { status: 'done' })
  assert.deepEqual(b?.payload, { status: 'todo' })
})

test('input unsorted by timestamp still folds in timestamp order so last write wins', () => {
  // Provided out of order: the later timestamp must win even though it appears first.
  const mutations: QueuedMutation[] = [
    M({ id: 2, operation: 'update', payload: { status: 'todo' }, timestamp: 200 }),
    M({ id: 1, operation: 'update', payload: { status: 'done' }, timestamp: 100 }),
  ]
  const result = coalesceMutations(mutations)
  assert.equal(result.length, 1)
  assert.deepEqual(result[0].payload, { status: 'todo' }) // timestamp 200 wins
  assert.deepEqual(result[0].sourceIds, [1, 2]) // folded in timestamp order
})

test('conflictKey is carried through when present on any mutation in the group', () => {
  const mutations: QueuedMutation[] = [
    M({ id: 1, table: 'user_settings', recordId: 'u1', operation: 'update', payload: { theme: 'dark' } }),
    M({ id: 2, table: 'user_settings', recordId: 'u1', operation: 'update', payload: { theme: 'light' }, conflictKey: 'user_id' }),
  ]
  const result = coalesceMutations(mutations)
  assert.equal(result.length, 1)
  assert.equal(result[0].conflictKey, 'user_id')
})

test('update arriving after a delete is ignored (delete wins)', () => {
  const mutations: QueuedMutation[] = [
    M({ id: 1, operation: 'delete' }),
    M({ id: 2, operation: 'update', payload: { status: 'todo' } }),
  ]
  const result = coalesceMutations(mutations)
  assert.equal(result.length, 1)
  assert.equal(result[0].operation, 'delete')
  assert.deepEqual(result[0].payload, {})
  assert.deepEqual(result[0].sourceIds, [1, 2])
})
