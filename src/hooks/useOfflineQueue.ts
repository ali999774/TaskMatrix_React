import { useState, useEffect, useCallback, useRef } from 'react'
import Dexie, { type Table } from 'dexie'
import type { SupabaseClient } from '@supabase/supabase-js'

interface QueuedMutation {
  id?: number
  table: 'tasks' | 'sticky_notes'
  operation: 'create' | 'update' | 'delete'
  recordId: string
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
    table: 'tasks' | 'sticky_notes',
    operation: 'create' | 'update' | 'delete',
    recordId: string,
    payload?: Record<string, unknown>,
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
      try {
        switch (item.operation) {
          case 'create':
          case 'update': {
            const record = { id: item.recordId, ...(item.payload || {}) }
            await supabase.from(item.table).upsert(record, { onConflict: 'id' })
            break
          }
          case 'delete':
            await supabase.from(item.table).delete().eq('id', item.recordId)
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

  // Expose online for the banner — single source of truth
  return { enqueue, flush, pendingCount, isFlushing, online }
}
