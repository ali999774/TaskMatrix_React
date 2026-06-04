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
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        setAuthLoading(false)
        return
      }
      setAuthLoading(false)
    })
  }, [])

  const signInWithGoogle = async () => {
    setAuthError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    })
    if (error) setAuthError(error.message)
  }

  // Listen for OAuth callback
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        setAuthLoading(false)
        setAuthError(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const { tasks, loading: tasksLoading, addTask, updateStatus, deleteTask } = useTasks(userId)
  const { notes, loading: notesLoading, addNote, deleteNote } = useStickyNotes(userId)
  const [noteInput, setNoteInput] = useState('')

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        Loading...
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-2xl font-bold text-white">TaskMatrix</h1>
        <p className="text-slate-400 text-sm">Sign in to see your tasks</p>
        <button
          onClick={signInWithGoogle}
          className="bg-white text-slate-800 px-6 py-3 rounded-lg font-medium hover:bg-slate-200 transition-colors"
        >
          Sign in with Google
        </button>
        {authError && <p className="text-red-400 text-sm">{authError}</p>}
      </div>
    )
  }

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        Loading tasks...
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
