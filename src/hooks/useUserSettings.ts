import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CategoryDef } from '../lib/categories'
import { DEFAULT_CATEGORIES } from '../lib/categories'
import { persistOrQueue } from '../lib/persist'

const LS_KEY = 'tm-categories'

interface OfflineQueue {
  enqueue: (table: 'tasks' | 'sticky_notes' | 'user_settings', op: 'create' | 'update' | 'delete', id: string, payload?: Record<string, unknown>, conflictKey?: string) => Promise<void>
  online: boolean
}

// Ali's pre-existing categories for the migration path
const ALI_CATEGORIES: CategoryDef[] = [
  { label: 'clinic', display: 'Clinic', color: 'red', icon: 'stethoscope' },
  { label: 'practice-launch', display: 'Launch', color: 'amber', icon: 'rocket' },
  { label: 'dev', display: 'Dev', color: 'blue', icon: 'monitor' },
  { label: 'personal', display: 'Personal', color: 'emerald', icon: 'user' },
]

// Emoji → Lucide migration map (one-time upgrade for existing categories)
const EMOJI_MIGRATION: Record<string, string> = {
  '👤': 'user',
  '💼': 'briefcase-business',
  '❤️': 'heart',
  '📚': 'graduation-cap',
  '🏥': 'stethoscope',
  '🏗': 'rocket',
  '💻': 'monitor',
  '📌': 'plus',
}

/** Upgrade emoji icons to Lucide icon names in-place. Returns true if anything changed. */
function migrateIcons(categories: CategoryDef[]): boolean {
  let changed = false
  for (const c of categories) {
    if (c.icon && c.icon in EMOJI_MIGRATION) {
      c.icon = EMOJI_MIGRATION[c.icon]
      changed = true
    }
  }
  return changed
}

export function useUserSettings(userId: string | null, offlineQueue?: OfflineQueue) {
  const [categories, setCategories] = useState<CategoryDef[]>(() => {
    try {
      const cached = localStorage.getItem(LS_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CategoryDef[]
        migrateIcons(parsed)
        return parsed
      }
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
        const cats = data.categories as CategoryDef[]
        const changed = migrateIcons(cats)
        setCategories(cats)
        localStorage.setItem(LS_KEY, JSON.stringify(cats))
        // If we upgraded emoji icons, persist the migration back to Supabase
        if (changed) {
          supabase
            .from('user_settings')
            .upsert({ user_id: userId, categories: cats as unknown as Record<string, unknown> }, { onConflict: 'user_id' })
            .then(() => {})
        }
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
          migrateIcons(row.categories)
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
      await persistOrQueue(offlineQueue, 'user_settings', 'update', userId,
        () => supabase
          .from('user_settings')
          .upsert({ user_id: userId, categories: cats as unknown as Record<string, unknown> }, { onConflict: 'user_id' }),
        { categories: cats as unknown as Record<string, unknown> },
        'user_id')
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
