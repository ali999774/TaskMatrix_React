import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { CategoryDef } from '../lib/categories'
import { DEFAULT_CATEGORIES } from '../lib/categories'
import { persistOrQueue } from '../lib/persist'
import type { QueuedMutation } from './useOfflineQueue'

const LS_KEY = 'tm-categories'

interface OfflineQueue {
  enqueue: (table: 'tasks' | 'sticky_notes' | 'user_settings', op: 'create' | 'update' | 'delete', id: string, payload?: Record<string, unknown>, conflictKey?: string, previousPayload?: Record<string, unknown>, label?: string) => Promise<void>
  online: boolean
  failedMutations?: QueuedMutation[]
  retryFailed?: (id: number) => Promise<{ ok: boolean; mutation: QueuedMutation } | undefined>
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
    const previousCategories = categories
    setCategories(cats)
    localStorage.setItem(LS_KEY, JSON.stringify(cats))

    if (!userId) return

    const payload = { categories: cats as unknown as Record<string, unknown> }
    const previousPayload = { categories: previousCategories as unknown as Record<string, unknown> }
    const label = 'category settings'

    if (offlineQueue && !offlineQueue.online) {
      // Queue offline — flush will upsert on reconnect using user_id as conflict key
      await offlineQueue.enqueue('user_settings', 'update', userId, payload, 'user_id', previousPayload, label)
    } else {
      await persistOrQueue(offlineQueue, 'user_settings', 'update', userId,
        () => supabase
          .from('user_settings')
          .upsert({ user_id: userId, categories: cats as unknown as Record<string, unknown> }, { onConflict: 'user_id' }),
        payload, 'user_id', previousPayload, label)
    }
  }, [userId, offlineQueue, categories])

  // If a category-settings write is permanently rejected (RLS / constraint),
  // revert the optimistic local state so the UI reflects what's actually
  // true server-side rather than a phantom edit that never saved.
  const revertedFailedIdsRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    const failed = offlineQueue?.failedMutations
    if (!failed) return
    for (const m of failed) {
      if (m.table !== 'user_settings' || m.id === undefined || revertedFailedIdsRef.current.has(m.id)) continue
      revertedFailedIdsRef.current.add(m.id)
      const prevCats = m.previousPayload?.categories
      if (Array.isArray(prevCats)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local state to an external queue transition (mutation → failed), not derivable from render
        setCategories(prevCats as CategoryDef[])
        localStorage.setItem(LS_KEY, JSON.stringify(prevCats))
      }
    }
  }, [offlineQueue?.failedMutations])

  // Re-attempt a failed category-settings save; on success, re-apply the
  // originally-attempted value (kept on the queued mutation) to local state.
  const retryFailedCategoryUpdate = useCallback(async (id: number) => {
    const result = await offlineQueue?.retryFailed?.(id)
    if (result?.ok && Array.isArray(result.mutation.payload?.categories)) {
      const cats = result.mutation.payload.categories as CategoryDef[]
      setCategories(cats)
      localStorage.setItem(LS_KEY, JSON.stringify(cats))
    }
  }, [offlineQueue])

  return { categories, updateCategories, loading, retryFailedCategoryUpdate }
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
