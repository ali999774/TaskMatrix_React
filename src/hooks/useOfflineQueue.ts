import { useState, useEffect, useCallback, useRef } from 'react'
import Dexie, { type Table } from 'dexie'
import type { SupabaseClient } from '@supabase/supabase-js'
import { coalesceMutations } from '../lib/coalesce'

// Transport error = dead socket / no server response. NOT a server rejection.
// Server rejections carry a PostgREST code (e.g. '42501' RLS, '23505' unique) or
// a 4xx status; those won't fix on blind retry. Anything we can't classify is
// treated as transport (keep, don't drop) — never lose data on uncertainty.
function isTransportError(error: unknown): boolean {
  if (!error) return false
  const e = error as { message?: string; code?: string; status?: number }
  if (typeof e.code === 'string' && e.code.length > 0) return false
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500) return false
  const msg = (e.message ?? '').toLowerCase()
  return msg === '' || msg.includes('failed to fetch') || msg.includes('networkerror')
    || msg.includes('network error') || msg.includes('load failed')
    || msg.includes('unreachable') || msg.includes('disconnected') || msg.includes('timeout')
}

export interface QueuedMutation {
  id?: number
  table: 'tasks' | 'sticky_notes' | 'user_settings'
  operation: 'create' | 'update' | 'delete'
  recordId: string
  /** Column to use as upsert conflict key (defaults to 'id'). */
  conflictKey?: string
  payload?: Record<string, unknown>
  /** Pre-edit value, for reverting optimistic state if this mutation is permanently rejected. */
  previousPayload?: Record<string, unknown>
  /** Human-readable description of the change, for surfacing failures to the user. */
  label?: string
  timestamp: number
  /** 'pending' retries automatically; 'failed' is a permanent server rejection awaiting manual retry. */
  status: 'pending' | 'failed'
  errorMessage?: string
}

class OfflineDB extends Dexie {
  mutations!: Table<QueuedMutation, number>

  constructor(userId: string) {
    super(`taskmatrix_offline_${userId}`)
    this.version(1).stores({
      mutations: '++id, table, timestamp',
    })
    // v2: distinguish permanently-rejected mutations ('failed') from ones still
    // awaiting retry ('pending') so a server rejection is never silently dropped.
    this.version(2).stores({
      mutations: '++id, table, timestamp, status',
    }).upgrade((tx) => tx.table('mutations').toCollection().modify((m) => {
      m.status = 'pending'
    }))
  }
}

/** Replay a single mutation against Supabase. Shared by flush() and retryFailed(). */
async function writeMutation(
  supabase: SupabaseClient,
  m: { table: QueuedMutation['table']; operation: 'create' | 'update' | 'delete'; recordId: string; conflictKey?: string; payload?: Record<string, unknown> },
): Promise<{ error: unknown }> {
  try {
    const ck = m.conflictKey ?? 'id'
    const payload = m.payload ?? {}
    if (m.operation === 'create') {
      return await supabase.from(m.table).upsert({ [ck]: m.recordId, ...payload }, { onConflict: ck })
    } else if (m.operation === 'update') {
      return await supabase.from(m.table).update(payload).eq(ck, m.recordId)
    } else {
      return await supabase.from(m.table).delete().eq(ck, m.recordId)
    }
  } catch (err) {
    return { error: err } // some environments throw instead of resolving { error }
  }
}

export function useOfflineQueue(userId: string | null, supabase: SupabaseClient | null) {
  const [pendingCount, setPendingCount] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  const [isFlushing, setIsFlushing] = useState(false)
  const [failedMutations, setFailedMutations] = useState<QueuedMutation[]>([])
  const dbRef = useRef<OfflineDB | null>(null)
  const flushingRef = useRef(false)
  const onlineRef = useRef(navigator.onLine)

  // Initialize DB
  useEffect(() => {
    if (!userId) {
      dbRef.current = null
      return
    }
    const db = new OfflineDB(userId)
    dbRef.current = db
    db.mutations.where('status').equals('pending').count().then(setPendingCount)
    db.mutations.where('status').equals('failed').toArray().then(setFailedMutations)
  }, [userId])

  // Track online status
  useEffect(() => {
    const goOnline = () => { onlineRef.current = true; setOnline(true) }
    const goOffline = () => { onlineRef.current = false; setOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Enqueue a mutation (capped at 500, drops oldest if exceeded)
  const enqueue = useCallback(async (
    table: 'tasks' | 'sticky_notes' | 'user_settings',
    operation: 'create' | 'update' | 'delete',
    recordId: string,
    payload?: Record<string, unknown>,
    conflictKey?: string,
    previousPayload?: Record<string, unknown>,
    label?: string,
  ) => {
    const db = dbRef.current
    if (!db) return

    // Enforce queue size limit — drop oldest if at capacity
    const count = await db.mutations.count()
    if (count >= 500) {
      const oldest = await db.mutations.orderBy('timestamp').first()
      if (oldest?.id !== undefined) await db.mutations.delete(oldest.id)
    }

    await db.mutations.add({
      table,
      operation,
      recordId,
      conflictKey,
      payload,
      previousPayload,
      label,
      timestamp: Date.now(),
      status: 'pending',
    })
    setPendingCount((c) => c + 1)
  }, [])

  // Flush all pending mutations
  const flush = useCallback(async () => {
    const db = dbRef.current
    if (!db || !supabase || flushingRef.current) return

    // Only 'pending' mutations auto-retry — 'failed' ones are permanent server
    // rejections awaiting a manual retry (see failedMutations / retryFailed).
    const items = (await db.mutations.orderBy('timestamp').toArray()).filter((i) => i.status === 'pending')
    if (items.length === 0) return

    // Discard mutations older than 24h (stale — the record was likely
    // modified on another device in the meantime, or the user signed out)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const stale = items.filter((i) => i.timestamp < cutoff)
    for (const s of stale) {
      if (s.id !== undefined) await db.mutations.delete(s.id)
    }
    const fresh = items.filter((i) => i.timestamp >= cutoff)
    if (fresh.length === 0) {
      setPendingCount(await db.mutations.where('status').equals('pending').count())
      flushingRef.current = false
      return
    }

    flushingRef.current = true
    setIsFlushing(true)

    // Fold every queued mutation that targets the same (table, recordId) into one
    // effective write. Replaying a multi-step change (e.g. complete→undo) as a
    // single write keeps the record atomic — a flaky reconnect can no longer apply
    // only half of it.
    const coalesced = coalesceMutations(fresh)

    for (const m of coalesced) {
      if (m.operation === 'noop') {
        // Steps cancelled out (e.g. created then deleted offline): send nothing,
        // but still clear the folded rows.
        for (const id of m.sourceIds) await db.mutations.delete(id)
        continue
      }

      console.log('[TM][QUEUE-REPLAY]', m.table, m.operation, m.recordId,
        'payload ->', JSON.stringify(m.payload ?? null))

      const result = await writeMutation(supabase, { ...m, operation: m.operation as 'create' | 'update' | 'delete' })

      if (result.error) {
        if (isTransportError(result.error)) {
          // Dead socket: keep this mutation queued and STOP. A partial flush is what
          // splits a record. Retry on next reconnect.
          console.warn('[TM][QUEUE-HALT] transport failure — keeping queued', m.recordId, result.error)
          break
        }
        // Permanent rejection (RLS / constraint / 4xx) — retrying blindly won't
        // fix it. Move to 'failed' instead of deleting so the edit isn't silently
        // lost; the caller reverts optimistic state and surfaces a retry action.
        const message = (result.error as { message?: string })?.message ?? String(result.error)
        console.warn('[TM][QUEUE-FAILED] server rejected — moved to failed', m.recordId, result.error)
        for (const id of m.sourceIds) await db.mutations.delete(id)
        const failedId = await db.mutations.add({
          table: m.table,
          operation: m.operation,
          recordId: m.recordId,
          conflictKey: m.conflictKey,
          payload: m.payload,
          previousPayload: m.previousPayload,
          label: m.label,
          timestamp: Date.now(),
          status: 'failed',
          errorMessage: message,
        })
        const saved = await db.mutations.get(failedId)
        if (saved) setFailedMutations((prev) => [...prev, saved])
        continue
      }

      // Success: clear all folded rows.
      for (const id of m.sourceIds) await db.mutations.delete(id)
    }

    const remaining = await db.mutations.where('status').equals('pending').count()
    setPendingCount(remaining)
    flushingRef.current = false
    setIsFlushing(false)
  }, [supabase]) // stable — supabase client never changes

  // Re-attempt a single failed (permanently-rejected) mutation, e.g. from a
  // user-triggered "Retry" action. Returns the mutation so the caller can
  // re-apply its payload to local state on success.
  const retryFailed = useCallback(async (id: number): Promise<{ ok: boolean; mutation: QueuedMutation } | undefined> => {
    const db = dbRef.current
    if (!db || !supabase) return
    const m = await db.mutations.get(id)
    if (!m || m.status !== 'failed') return

    const result = await writeMutation(supabase, m)

    if (result.error) {
      const message = (result.error as { message?: string })?.message ?? String(result.error)
      await db.mutations.update(id, { errorMessage: message, timestamp: Date.now() })
      const updated = { ...m, errorMessage: message }
      setFailedMutations((prev) => prev.map((f) => (f.id === id ? updated : f)))
      return { ok: false, mutation: updated }
    }

    await db.mutations.delete(id)
    setFailedMutations((prev) => prev.filter((f) => f.id !== id))
    return { ok: true, mutation: m }
  }, [supabase])

  // Auto-flush on reconnect
  useEffect(() => {
    if (online && pendingCount > 0) {
      flush()
    }
  }, [online, pendingCount, flush])

  // Scan the mutations queue for tasks that have a pending soft-delete (update
  // with deleted_at set) but haven't been flushed to Supabase yet.  loadTasks
  // calls this before setTasks so Supabase-truth never resurrects a task that
  // the user deleted while offline.
  const getPendingDeleteIds = useCallback(async (): Promise<Set<string>> => {
    const db = dbRef.current
    if (!db) return new Set()
    // Only 'pending' rows represent a delete still awaiting sync — a 'failed'
    // delete was permanently rejected, so the task should NOT be hidden as if
    // it were successfully (or still pending) deleted.
    const items = (await db.mutations.where('table').equals('tasks').toArray())
      .filter((i) => i.status === 'pending')
    const deletedIds = new Set<string>()

    for (const item of items.sort((a, b) => a.timestamp - b.timestamp)) {
      if (item.operation === 'delete') {
        deletedIds.add(item.recordId)
        continue
      }
      if (
        item.operation === 'update' &&
        item.payload &&
        Object.prototype.hasOwnProperty.call(item.payload, 'deleted_at')
      ) {
        if (item.payload.deleted_at == null) {
          deletedIds.delete(item.recordId)
        } else {
          deletedIds.add(item.recordId)
        }
      }
    }

    return deletedIds
  }, [])

  // Expose online for the banner — single source of truth
  return { enqueue, flush, pendingCount, isFlushing, online, getPendingDeleteIds, failedMutations, retryFailed }
}
