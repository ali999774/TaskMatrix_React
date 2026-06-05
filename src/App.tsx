import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useTasks } from './hooks/useTasks'
import { useStickyNotes } from './hooks/useStickyNotes'
import QuadrantPanel from './components/QuadrantPanel'
import StickyWall from './components/StickyWall'
import NotesModal from './components/NotesModal'
import NoteEditModal from './components/NoteEditModal'
import PomodoroPopup from './components/PomodoroPopup'
import TodayStrip from './components/TodayStrip'
import CompletedSection from './components/CompletedSection'
import TaskDetail from './components/TaskDetail'
import VoiceButton from './components/VoiceButton'
import { importanceUrgencyToQuadrant, QUADRANT_DEFAULTS } from './types'
import type { Quadrant, Task, StickyNote } from './types'

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('tm-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('tm-theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, () => setDark((d) => !d)]
}

const QUADRANT_COLORS: Record<Quadrant, string> = {
  1: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20',
  2: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20',
  3: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20',
  4: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20',
}

const QUADRANT_LABELS_SHORT: Record<Quadrant, string> = {
  1: 'Do First',
  2: 'Schedule',
  3: 'Delegate',
  4: "Don't Do",
}

export default function App() {
  const [dark, toggleTheme] = useTheme()
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

  const { tasks, loading: tasksLoading, addTask, updateStatus, updateTask, deleteTask } = useTasks(userId)
  const { notes, pinnedNotes, addNote, updateNote, deleteNote } = useStickyNotes(userId)
  const [quickAdd, setQuickAdd] = useState('')
  const [context, setContext] = useState('all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null)
  const [showPomodoro, setShowPomodoro] = useState(false)

  const filteredTasks = context === 'all' ? tasks : tasks.filter((t) => t.category === context)

  // Keep selectedTask in sync with realtime updates
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find((t) => t.id === selectedTask.id)
      if (updated) {
        setSelectedTask(updated)
      } else {
        setSelectedTask(null)
      }
    }
  }, [tasks, selectedTask])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400 dark:text-slate-500">
        Loading...
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-white dark:bg-slate-950">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">TaskMatrix</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Sign in to see your tasks</p>
        <button
          onClick={signInWithGoogle}
          className="bg-slate-800 dark:bg-white text-white dark:text-slate-800 px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Sign in with Google
        </button>
        {authError && <p className="text-red-500 dark:text-red-400 text-sm">{authError}</p>}
      </div>
    )
  }

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400 dark:text-slate-500">
        Loading tasks...
      </div>
    )
  }

  const quadrants: Quadrant[] = [1, 2, 3, 4]
  const quadrantTasks = (q: Quadrant) =>
    filteredTasks.filter((t) => importanceUrgencyToQuadrant(t.importance, t.urgency) === q)

  const handleQuickAdd = (q: Quadrant) => {
    const title = quickAdd.trim()
    if (!title) return
    const defaults = QUADRANT_DEFAULTS[q]
    addTask(title, defaults.importance, defaults.urgency, context !== 'all' ? context : undefined)
    setQuickAdd('')
  }

  const handleQuickAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuickAdd(1) // default to Do First on Enter
    }
  }

  const handleMove = (taskId: string, toQuadrant: Quadrant) => {
    const defaults = QUADRANT_DEFAULTS[toQuadrant]
    updateTask(taskId, { importance: defaults.importance, urgency: defaults.urgency })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
            <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white tracking-tight whitespace-nowrap shrink-0">
              TaskMatrix
            </h1>

            {/* Quick-add input */}
            <div className="flex-1 relative">
              <div className="flex items-center gap-1.5">
                <VoiceButton onTranscript={setQuickAdd} />
                <input
                  type="text"
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  onKeyDown={handleQuickAddKeyDown}
                  placeholder="Quick add task..."
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 
                    dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-700 
                    dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 
                    outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
                />
              </div>
              {/* Dropdown: appears when input has text */}
              {quickAdd.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1 flex gap-1.5 z-50">
                  {quadrants.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQuickAdd(q)}
                      className={`shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg border 
                        transition-colors ${QUADRANT_COLORS[q]} shadow-sm`}
                    >
                      {QUADRANT_LABELS_SHORT[q]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                {filteredTasks.length}t · {notes.length}n
              </span>
              <button
                onClick={toggleTheme}
                className="text-lg p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title={dark ? 'Switch to light' : 'Switch to dark'}
              >
                {dark ? '☀️' : '🌙'}
              </button>
              <button
                onClick={() => setShowPomodoro((v) => !v)}
                className="text-lg p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Pomodoro timer"
              >
                ⏱
              </button>
            </div>
          </div>
        </header>

      {/* Context switcher */}
      <div className="px-3 sm:px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60">
        <div className="flex gap-1.5 overflow-x-auto">
          {['all', 'clinic', 'practice-launch', 'dev', 'personal'].map((ctx) => (
            <button
              key={ctx}
              onClick={() => setContext(ctx)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors
                ${context === ctx
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
            >
              {ctx === 'all' ? 'All' : ctx === 'practice-launch' ? '🏗 Launch' : ctx === 'clinic' ? '🏥 Clinic' : ctx === 'dev' ? '💻 Dev' : '👤 Personal'}
            </button>
          ))}
        </div>
      </div>

      {/* Body: matrix + sticky notes side by side */}
      <div className="px-3 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* Matrix column */}
          <div className="flex-1 min-w-0 w-full">

            {/* Today strip */}
            <TodayStrip tasks={filteredTasks} onTaskClick={setSelectedTask} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {quadrants.map((q) => (
                <QuadrantPanel
                  key={q}
                  quadrant={q}
                  tasks={quadrantTasks(q)}
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                  onMove={handleMove}
                  onTaskClick={setSelectedTask}
                />
              ))}
            </div>

            <CompletedSection
              userId={userId}
              context={context}
              onTaskClick={setSelectedTask}
            />
          </div>

          {/* Sticky notes sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            <StickyWall
              notes={pinnedNotes}
              onDelete={deleteNote}
              onAdd={addNote}
              onEdit={setEditingNote}
              onShowAll={() => setShowNotesModal(true)}
              sidebar
            />
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onUpdate={updateTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {showNotesModal && (
        <NotesModal
          notes={notes}
          onClose={() => setShowNotesModal(false)}
          onAdd={addNote}
          onEdit={(note) => {
            setShowNotesModal(false)
            setEditingNote(note)
          }}
        />
      )}

      {editingNote && (
        <NoteEditModal
          note={editingNote}
          onSave={updateNote}
          onDelete={deleteNote}
          onClose={() => setEditingNote(null)}
        />
      )}

      <PomodoroPopup show={showPomodoro} onClose={() => setShowPomodoro(false)} />
    </div>
  )
}
