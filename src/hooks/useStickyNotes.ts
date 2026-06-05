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

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('sticky-notes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sticky_notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as StickyNote
            setNotes((prev) => {
              if (prev.some((n) => n.id === row.id)) return prev
              return [row, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as StickyNote
            setNotes((prev) =>
              prev.map((n) => (n.id === row.id ? row : n))
            )
          } else if (payload.eventType === 'DELETE') {
            setNotes((prev) =>
              prev.filter((n) => n.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

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

  const updateNote = useCallback(async (id: string, updates: Partial<StickyNote>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    )
    await supabase.from('sticky_notes').update(updates).eq('id', id)
  }, [])

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    await supabase.from('sticky_notes').delete().eq('id', id)
  }, [])

  const pinnedNotes = notes.filter((n) => n.pinned)

  return { notes, pinnedNotes, loading, addNote, updateNote, deleteNote, reload: loadNotes }
}
