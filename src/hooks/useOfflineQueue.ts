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
  const [flushing, setFlushing] = useState(false)
  const dbRef = useRef<OfflineDB | null>(null)

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
  const onlineRef = useRef(navigator.onLine)
  const [online, setOnline] = useState(navigator.onLine)

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

  // Enqueue a mutation
  const enqueue = useCallback(async (
    table: 'tasks' | 'sticky_notes',
    operation: 'create' | 'update' | 'delete',
    recordId: string,
    payload?: Record<string, unknown>,
  ) => {
    const db = dbRef.current
    if (!db) return
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
    if (!db || !supabase || flushing) return

    const items = await db.mutations.orderBy('timestamp').toArray()
    if (items.length === 0) return

    setFlushing(true)

    for (const item of items) {
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
        // Conflict — surface to user, don't silently drop
        console.warn('[OfflineQueue] Flush failed for', item, err)
      }
    }

    const remaining = await db.mutations.count()
    setPendingCount(remaining)
    setFlushing(false)
  }, [supabase, flushing])

  // Auto-flush on reconnect
  useEffect(() => {
    if (online && pendingCount > 0) {
      flush()
    }
  }, [online, pendingCount, flush])

  return { enqueue, flush, pendingCount, online, flushing }
}
