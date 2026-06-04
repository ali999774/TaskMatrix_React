import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { StickyNote } from '../types'

const COLORS = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange']

export function useStickyNotes(userId: string | null) {
  const [notes, setNotes] = useState<StickyNote[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotes = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('sticky_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setNotes(data as StickyNote[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) loadNotes()
  }, [userId, loadNotes])

  const addNote = useCallback(async (content: string) => {
    if (!userId) return
    const note: Partial<StickyNote> = {
      id: crypto.randomUUID(),
      user_id: userId,
      content,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      position_x: Math.floor(Math.random() * 200),
      position_y: Math.floor(Math.random() * 200),
      pinned: false,
    }
    setNotes((prev) => [note as StickyNote, ...prev])
    await supabase.from('sticky_notes').upsert(note, { onConflict: 'id' })
  }, [userId])

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    await supabase.from('sticky_notes').delete().eq('id', id)
  }, [])

  return { notes, loading, addNote, deleteNote, reload: loadNotes }
}
