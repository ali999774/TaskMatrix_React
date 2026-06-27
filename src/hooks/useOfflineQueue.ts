import { useState, useEffect, useCallback, useRef } from 'react'
import Dexie, { type Table } from 'dexie'
import type { SupabaseClient } from '@supabase/supabase-js'

interface QueuedMutation {
  id?: number
  table: 'tasks' | 'sticky_notes' | 'user_settings'
  operation: 'create' | 'update' | 'delete'
  recordId: string
  /** Column to use as upsert conflict key (defaults to 'id'). */
  conflictKey?: string
  payload?: Record<string, unknown>
  timestamp: number
}

class OfflineDB extends Dexie {
  mutations!: Table<QueuedMutation, number>

  constructor(userId: string) {
    super(`taskmatrix_offline_${userId}`)
    this.version(1).stores({
      mutations: '++id, table, timestamp',
    })
  }
}

export function useOfflineQueue(userId: string | null, supabase: SupabaseClient | null) {
  const [pendingCount, setPendingCount] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  const [isFlushing, setIsFlushing] = useState(false)
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
    db.mutations.count().then(setPendingCount)
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
      timestamp: Date.now(),
    })
    setPendingCount((c) => c + 1)
  }, [])

  // Flush all pending mutations
  const flush = useCallback(async () => {
    const db = dbRef.current
    if (!db || !supabase || flushingRef.current) return

    const items = await db.mutations.orderBy('timestamp').toArray()
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
      setPendingCount(0)
      flushingRef.current = false
      return
    }

    flushingRef.current = true
    setIsFlushing(true)

    for (const item of fresh) {
      // [TM][QUEUE-REPLAY] log every mutation being replayed from the offline queue
      // eslint-disable-next-line no-console
      console.log('[TM][QUEUE-REPLAY]', item.table, item.operation, item.recordId, 'payload ->', JSON.stringify(item.payload ?? null))
      try {
        const ck = item.conflictKey ?? 'id'
        switch (item.operation) {
          case 'create': {
            // Full payload — upsert is safe because user_id is included
            const record = { [ck]: item.recordId, ...(item.payload || {}) }
            await supabase.from(item.table).upsert(record, { onConflict: ck })
            break
          }
          case 'update': {
            // Partial payload — use update().eq() to avoid the INSERT branch of
            // upsert, which would fail RLS when user_id is absent from the payload
            await supabase.from(item.table).update(item.payload || {}).eq(ck, item.recordId)
            break
          }
          case 'delete':
            await supabase.from(item.table).delete().eq(ck, item.recordId)
            break
        }
        // Remove from queue on success
        if (item.id !== undefined) await db.mutations.delete(item.id)
      } catch (err) {
        console.warn('[OfflineQueue] Flush failed for', item, err)
      }
    }

    const remaining = await db.mutations.count()
    setPendingCount(remaining)
    flushingRef.current = false
    setIsFlushing(false)
  }, [supabase]) // stable — supabase client never changes

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
    const items = await db.mutations.where('table').equals('tasks').toArray()
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
  return { enqueue, flush, pendingCount, isFlushing, online, getPendingDeleteIds }
}
