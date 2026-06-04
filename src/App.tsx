import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useTasks } from './hooks/useTasks'
import { useStickyNotes } from './hooks/useStickyNotes'
import QuadrantPanel from './components/QuadrantPanel'
import StickyWall from './components/StickyWall'
import { importanceUrgencyToQuadrant } from './types'
import type { Quadrant } from './types'

export default function App() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.signInAnonymously().then(({ data, error }) => {
      if (data?.user) setUserId(data.user.id)
      else if (error) console.error('Auth failed:', error.message)
      setAuthLoading(false)
    })
  }, [])

  const { tasks, loading: tasksLoading, addTask, updateStatus, deleteTask } = useTasks(userId)
  const { notes, loading: notesLoading, addNote, deleteNote } = useStickyNotes(userId)
  const [noteInput, setNoteInput] = useState('')

  if (authLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        Loading...
      </div>
    )
  }

  const quadrants: Quadrant[] = [1, 2, 3, 4]
  const quadrantTasks = (q: Quadrant) =>
    tasks.filter((t) => importanceUrgencyToQuadrant(t.importance, t.urgency) === q)

  const handleAddNote = () => {
    if (noteInput.trim()) {
      addNote(noteInput.trim())
      setNoteInput('')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TaskMatrix</h1>
          <p className="text-sm text-slate-500 mt-1">
            {tasks.length} tasks · {notes.length} notes
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            placeholder="+ Sticky note..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 
              text-sm text-slate-300 placeholder-slate-600 focus:outline-none 
              focus:border-slate-500 w-40 transition-colors"
          />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {quadrants.map((q) => (
          <QuadrantPanel
            key={q}
            quadrant={q}
            tasks={quadrantTasks(q)}
            onStatusChange={updateStatus}
            onDelete={deleteTask}
            onAdd={addTask}
          />
        ))}
      </div>

      {!notesLoading && <StickyWall notes={notes} onDelete={deleteNote} />}
    </div>
  )
}
