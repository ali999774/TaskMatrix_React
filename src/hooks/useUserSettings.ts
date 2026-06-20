import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CategoryDef } from '../lib/categories'
import { DEFAULT_CATEGORIES } from '../lib/categories'

const LS_KEY = 'tm-categories'

interface OfflineQueue {
  enqueue: (table: 'tasks' | 'sticky_notes' | 'user_settings', op: 'create' | 'update' | 'delete', id: string, payload?: Record<string, unknown>, conflictKey?: string) => Promise<void>
  online: boolean
}

// Ali's pre-existing categories for the migration path
const ALI_CATEGORIES: CategoryDef[] = [
  { label: 'clinic', display: 'Clinic', color: 'red', icon: '🏥' },
  { label: 'practice-launch', display: 'Launch', color: 'amber', icon: '🏗' },
  { label: 'dev', display: 'Dev', color: 'blue', icon: '💻' },
  { label: 'personal', display: 'Personal', color: 'emerald', icon: '👤' },
]

export function useUserSettings(userId: string | null, offlineQueue?: OfflineQueue) {
  const [categories, setCategories] = useState<CategoryDef[]>(() => {
    try {
      const cached = localStorage.getItem(LS_KEY)
      if (cached) return JSON.parse(cached) as CategoryDef[]
    } catch { /* ignore invalid cached JSON */ }
    return DEFAULT_CATEGORIES
  })
  const [loading, setLoading] = useState(true)

  // Load from Supabase on mount
  useEffect(() => {
    if (!userId) return

    const load = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('categories')
        .eq('user_id', userId)
        .maybeSingle()

      if (data?.categories && Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories as CategoryDef[])
        localStorage.setItem(LS_KEY, JSON.stringify(data.categories))
      } else {
        // No settings yet — migrate Ali's existing categories if they have tasks
        await migrateExisting(userId)
      }
      setLoading(false)
    }

    load()
  }, [userId])

  // Realtime subscription for cross-device sync
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('user-settings-realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_settings',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as { categories: CategoryDef[] }
        if (row.categories && Array.isArray(row.categories)) {
          setCategories(row.categories)
          localStorage.setItem(LS_KEY, JSON.stringify(row.categories))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const updateCategories = useCallback(async (cats: CategoryDef[]) => {
    setCategories(cats)
    localStorage.setItem(LS_KEY, JSON.stringify(cats))

    if (!userId) return

    if (offlineQueue && !offlineQueue.online) {
      // Queue offline — flush will upsert on reconnect using user_id as conflict key
      await offlineQueue.enqueue(
        'user_settings',
        'update',
        userId,
        { categories: cats as unknown as Record<string, unknown> },
        'user_id',
      )
    } else {
      await supabase
        .from('user_settings')
        .upsert({ user_id: userId, categories: cats as unknown as Record<string, unknown> }, { onConflict: 'user_id' })
    }
  }, [userId, offlineQueue])

  return { categories, updateCategories, loading }
}

// Migrate Ali's existing hardcoded categories on first launch
async function migrateExisting(userId: string) {
  // Check if user has any tasks with the old category values
  const { data: tasks } = await supabase
    .from('tasks')
    .select('category')
    .eq('user_id', userId)
    .in('category', ['clinic', 'practice-launch', 'dev', 'personal'])
    .limit(1)

  const cats = tasks && tasks.length > 0 ? ALI_CATEGORIES : DEFAULT_CATEGORIES

  await supabase
    .from('user_settings')
    .upsert({ user_id: userId, categories: cats as unknown as Record<string, unknown> }, { onConflict: 'user_id' })

  localStorage.setItem(LS_KEY, JSON.stringify(cats))
}
