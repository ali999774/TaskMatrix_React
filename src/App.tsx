import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useTasks } from './hooks/useTasks'
import { useStickyNotes } from './hooks/useStickyNotes'
import { useOfflineQueue } from './hooks/useOfflineQueue'
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

  const signOut = async () => {
    await supabase.auth.signOut()
    setUserId(null)
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

  const offlineQueue = useOfflineQueue(userId, supabase)

  const { tasks, loading: tasksLoading, addTask, updateStatus, updateTask, deleteTask } = useTasks(userId, offlineQueue)
  const { notes, pinnedNotes, addNote, updateNote, deleteNote } = useStickyNotes(userId, offlineQueue)
  const [quickAdd, setQuickAdd] = useState('')
  const [context, setContext] = useState(() => localStorage.getItem('tm-context') || 'all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null)
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')

  // Persist context filter across sessions
  useEffect(() => {
    localStorage.setItem('tm-context', context)
  }, [context])

  // Lock body scroll when any modal is open (prevents iOS horizontal overscroll)
  const hasModal = !!(editingNote || showNotesModal || selectedTask || showPomodoro)
  useEffect(() => {
    document.body.style.overflow = hasModal ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [hasModal])

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
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-white dark:bg-[#121212]">
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
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-[#121212] px-3 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-4xl">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 min-h-[220px] animate-pulse">
              <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
              <div className="space-y-2">
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg w-3/4" />
              </div>
            </div>
          ))}
        </div>
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

  const handleNewBlankNote = async () => {
    const note = await addNote('')
    if (note) setEditingNote(note)
  }

  const handleVoiceNote = async (transcript: string) => {
    if (!transcript.trim()) return
    setVoiceStatus('saving')
    const note = await addNote(transcript.trim())
    if (note) {
      setEditingNote(note)
      setTimeout(() => setEditingNote(null), 2000)
      setVoiceStatus('saved!')
      setTimeout(() => setVoiceStatus(''), 2500)
    } else {
      setVoiceStatus('save failed')
      setTimeout(() => setVoiceStatus(''), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] pb-[env(safe-area-inset-bottom)] overflow-x-clip max-w-[100vw]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#121212]/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="px-1 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
            <h1 className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 tracking-tight whitespace-nowrap shrink-0">
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
                      className={`shrink-0 text-xs font-medium px-3 py-2 rounded-lg border min-h-[44px]
                        transition-all active:scale-95 motion-reduce:scale-100 active:opacity-80 ${QUADRANT_COLORS[q]} shadow-sm`}
                    >
                      {QUADRANT_LABELS_SHORT[q]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-0 shrink-0">
              <button
                onClick={() => window.location.reload()}
                className="text-sm p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 motion-reduce:scale-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500"
                title="Refresh"
                aria-label="Refresh"
              >
                ↻
              </button>
              <button
                onClick={signOut}
                className="text-sm p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 motion-reduce:scale-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500"
                title="Sign out"
                aria-label="Sign out"
              >
                ⏻
              </button>
            </div>
          </div>
        </header>

      {/* Context switcher + body */}
      {/* Offline banner */}
      {!offlineQueue.online && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-3 sm:px-6 py-2 text-center">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            You're offline.{offlineQueue.pendingCount > 0 ? ` ${offlineQueue.pendingCount} change${offlineQueue.pendingCount !== 1 ? 's' : ''} pending.` : ''} Changes will sync when you reconnect.
          </span>
        </div>
      )}
      {/* Context switcher */}
      <div className="px-3 sm:px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-[#121212]/60">
        <div className="flex gap-1.5 overflow-x-auto">
          {['all', 'clinic', 'practice-launch', 'dev', 'personal'].map((ctx) => (
            <button
              key={ctx}
              onClick={() => setContext(ctx)}
              className={`text-xs px-3 py-2 rounded-full font-medium transition-all active:scale-95 motion-reduce:scale-100 active:opacity-80 min-h-[44px] inline-flex items-center
                ${context === ctx
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
            >
              {ctx === 'all' ? 'All' : ctx === 'practice-launch' ? '🏗 Launch' : ctx === 'clinic' ? '🏥 Clinic' : ctx === 'dev' ? '💻 Dev' : '👤 Personal'}
            </button>
          ))}
        </div>
      </div>

      {/* Body: matrix + sticky notes side by side */}
      <div className="px-1 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col lg:flex-row gap-5 lg:items-start w-full">

          {/* Matrix column */}
          <div className="flex-1 min-w-0 w-full">

            {/* Today strip */}
            <TodayStrip tasks={filteredTasks} onTaskClick={setSelectedTask} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-start w-full">
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
          </div>

          {/* Sticky notes sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            <StickyWall
              notes={pinnedNotes}
              onDelete={deleteNote}
              onAdd={addNote}
              onEdit={setEditingNote}
              onShowAll={() => setShowNotesModal(true)}
              onNewBlank={handleNewBlankNote}
              sidebar
            />
          </div>
        </div>

        <CompletedSection
          userId={userId}
          context={context}
          onTaskClick={setSelectedTask}
        />
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

      {/* Mobile bottom action bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#121212]/80 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-3 py-2">
          <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg min-h-[44px] min-w-[44px]">
            <VoiceButton
              onTranscript={handleVoiceNote}
              onStatus={setVoiceStatus}
              icon="🎙️"
              className="p-0 bg-transparent border-none text-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {voiceStatus || 'Voice'}
            </span>
          </div>
          <button
            onClick={() => setShowPomodoro(v => !v)}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all min-h-[44px] min-w-[44px]"
            aria-label="Pomodoro timer"
          >
            <span className="text-lg">⏱</span>
            <span className="text-xs font-medium">Focus</span>
          </button>
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all min-h-[44px] min-w-[44px]"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="text-lg">{dark ? '☀️' : '🌙'}</span>
            <span className="text-xs font-medium">Theme</span>
          </button>
          <button
            onClick={() => setShowNotesModal(true)}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all min-h-[44px] min-w-[44px]"
            aria-label="View all notes"
          >
            <span className="text-lg">📌</span>
            <span className="text-xs font-medium">Notes</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
