import { useState, useEffect, useRef, Component } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from './lib/supabase'
import { useTasks } from './hooks/useTasks'
import { useStickyNotes } from './hooks/useStickyNotes'
import { useOfflineQueue } from './hooks/useOfflineQueue'
import { usePushNotifications } from './hooks/usePushNotifications'
import { useUserSettings } from './hooks/useUserSettings'
import MatrixScreen from './components/matrix/MatrixScreen'
import StickyWall from './components/StickyWall'
import NotesModal from './components/NotesModal'
import NoteEditModal from './components/NoteEditModal'
import PomodoroPopup from './components/PomodoroPopup'
import TodayStrip from './components/TodayStrip'
import CompletedSection from './components/CompletedSection'
import TaskDetail from './components/TaskDetail'
import SettingsModal from './components/SettingsModal'
import VoiceButton from './components/VoiceButton'
import { speechSupported, formatVoiceNote } from './lib/speech'
import { parseVoiceTranscript, suggestNextTask, formatNoteContent } from './lib/ai-parse'
import { useAISettings } from './hooks/useAISettings'
import { QUADRANT_DEFAULTS } from './types'
import type { Quadrant, Task, StickyNote } from './types'


class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-2 px-6 bg-white dark:bg-[#121212] text-slate-700 dark:text-slate-300 text-[0.875rem]">
          <p className="font-bold text-red-500">App Crashed</p>
          <p className="text-center break-all font-mono text-[0.75rem]">{this.state.error.message}</p>
          <button onClick={() => { this.setState({ error: null }); window.location.reload() }}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-[0.875rem] min-h-[44px]">Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

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

export default function App() {
  const [dark, toggleTheme] = useTheme()
  const [userId, setUserId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [quickAction, setQuickAction] = useState<string | null>(null)
  const [voiceTaskQuickAction, setVoiceTaskQuickAction] = useState(false)
  const [voiceNoteQuickAction, setVoiceNoteQuickAction] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        setAuthLoading(false)
      } else {
        setAuthLoading(false)
      }
      // Cold-start quick action: URL may have landed before JS was ready
      const launch = await CapacitorApp.getLaunchUrl()
      if (launch?.url?.startsWith('taskmatrix://quick-action/')) {
        const action = launch.url.replace('taskmatrix://quick-action/', '')
        if (action === 'new-note') setQuickAction('new-note')
        if (action === 'voice-task') setVoiceTaskQuickAction(true)
        if (action === 'voice-note') setVoiceNoteQuickAction(true)
      }
    }).catch(err => {
      console.error('[App] getSession failed', err)
      setAuthLoading(false)
      setAuthError(err.message)
    })
  }, [])

  const signInWithGoogle = async () => {
    setAuthError(null)
    // isNativePlatform(), NOT `window.Capacitor` — importing @capacitor/core
    // defines window.Capacitor even in a regular browser (web shim), which
    // sent web users down the native OAuth path (new tab + taskmatrix://
    // redirect that no browser can complete).
    const isNative = Capacitor.isNativePlatform()
    const redirectTo = isNative ? 'taskmatrix-auth://callback' : window.location.origin + window.location.pathname

    if (isNative) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error) { setAuthError(error.message); return }
      if (data.url) await Browser.open({ url: data.url })
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) setAuthError(error.message)
    }
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

  // Handle Capacitor deep link — Google OAuth redirects to taskmatrix://auth/callback
  useEffect(() => {
    // Use a guard ref to prevent double-processing under React StrictMode
    // (mount → unmount → remount registers two listeners before cleanup resolves)
    let active = true
    const handlePromise = CapacitorApp.addListener('appUrlOpen', async ({ url: callbackUrl }) => {
      if (!active) return

      // Quick actions: taskmatrix://quick-action/new-note
      if (callbackUrl.startsWith('taskmatrix://quick-action/')) {
        const action = callbackUrl.replace('taskmatrix://quick-action/', '')
        if (action === 'new-note') {
          setQuickAction('new-note')
        }
        if (action === 'voice-task') {
          setVoiceTaskQuickAction(true)
        }
        if (action === 'voice-note') {
          setVoiceNoteQuickAction(true)
        }
        return
      }

      active = false // prevent re-entry from duplicate listener
      await Browser.close()
      // Extract tokens from URL hash (Google OAuth PKCE flow)
      const hash = callbackUrl.split('#')[1]
      if (hash) {
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token })
        }
      }
      // Fallback: try code exchange for PKCE code flow
      const qs = callbackUrl.includes('?') ? callbackUrl.split('?')[1] : ''
      const code = new URLSearchParams(qs).get('code')
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      }
    })
    return () => {
      active = false
      handlePromise.then((handle) => handle.remove())
    }
  }, [])

  const offlineQueue = useOfflineQueue(userId, supabase)

  // Register push notifications on iOS native
  usePushNotifications(userId)

  const { aiSettings, updateAISettings, getAIBaseUrl } = useAISettings()

  const { tasks, loading: tasksLoading, addTask, updateStatus, updateTask, deleteTask, restoreTask, clearCompleted } = useTasks(userId, offlineQueue)
  const { notes, pinnedNotes, addNote, updateNote, deleteNote, reorderNote } = useStickyNotes(userId, offlineQueue)
  const { categories, updateCategories } = useUserSettings(userId, offlineQueue)
  const [quickAdd, setQuickAdd] = useState('')
  const [context, setContext] = useState(() => localStorage.getItem('tm-context') || 'all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null)
  const cameFromNotesModal = useRef(false)
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceTaskStatus, setVoiceTaskStatus] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // Auto-close mobile menu after 5s
  useEffect(() => {
    if (!showMenu) return
    const t = setTimeout(() => setShowMenu(false), 5000)
    return () => clearTimeout(t)
  }, [showMenu])

  // Undo-on-delete: hold the deleted task for 5s so the snackbar can restore it
  const [undoTask, setUndoTask] = useState<Task | null>(null)
  const [undoIsDoneDismiss, setUndoIsDoneDismiss] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Increment to signal CompletedSection to re-fetch
  const [reloadTrigger, setReloadTrigger] = useState(0)

  const handleDeleteTask = (id: string) => {
    const task = tasks.find((t) => t.id === id)
    deleteTask(id)
    if (task) {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      setUndoTask(task)
      undoTimerRef.current = setTimeout(() => setUndoTask(null), 5000)
    }
  }

  const handleUndoDelete = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    if (undoTask) {
      if (undoIsDoneDismiss) {
        // Undo a completion: flip back to todo, returning the task to the matrix.
        updateStatus(undoTask.id, 'todo')
      } else {
        restoreTask(undoTask)
      }
    }
    setUndoIsDoneDismiss(false)
    setUndoTask(null)
  }

  // When a task is marked done, show an undo snackbar for 5s.
  // The task leaves the active matrix immediately (matrix filters status='todo').
  // No auto-delete timer — done tasks persist in CompletedSection until manually cleared.
  const handleStatusChange = (id: string, status: string) => {
    updateStatus(id, status)
    if (status === 'done') {
      const task = tasks.find((t) => t.id === id)
      if (task) {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
        setUndoIsDoneDismiss(true)
        setUndoTask(task)
        undoTimerRef.current = setTimeout(() => {
          setUndoTask(null)
          setUndoIsDoneDismiss(false)
        }, 5000)
      }
      // Signal CompletedSection to re-fetch so the newly done task appears.
      setReloadTrigger((n) => n + 1)
    } else {
      // Task un-completed — cancel any pending snackbar for this task.
      if (undoTask?.id === id) {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
        setUndoTask(null)
        setUndoIsDoneDismiss(false)
      }
    }
  }

  const handleClearCompleted = async () => {
    if (!window.confirm('Clear all completed tasks? This cannot be undone.')) return
    await clearCompleted()
    setReloadTrigger((n) => n + 1)
  }

  // Persist context filter across sessions
  useEffect(() => {
    localStorage.setItem('tm-context', context)
  }, [context])

  const handleNewBlankNote = async () => {
    const note = await addNote('')
    if (note) setEditingNote(note)
  }

  // Process new-note quick action
  useEffect(() => {
    if (!userId || quickAction !== 'new-note') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting one-shot trigger after consuming it
    setQuickAction(null)
    handleNewBlankNote()
  }, [userId, quickAction])

  // Lock body scroll when any modal is open (prevents iOS horizontal overscroll)
  const hasModal = !!(editingNote || showNotesModal || selectedTask || showPomodoro || showSettings)
  useEffect(() => {
    document.body.style.overflow = hasModal ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [hasModal])

  const handleSuggest = async () => {
    if (!aiSettings.enabled || filteredTasks.length === 0) return
    setSuggesting(true)
    const list = filteredTasks
      .filter(t => t.status !== 'done')
      .slice(0, 20)
      .map(t => `- [${t.importance},${t.urgency}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`)
      .join('\n')
    const result = await suggestNextTask(list)
    setSuggesting(false)
    if ('suggested' in result) {
      setSuggestion(result.suggested)
      setTimeout(() => setSuggestion(''), 5000)
    }
  }

  const filteredTasks = context === 'all' ? tasks : tasks.filter((t) => t.category === context)

  // Keep selectedTask in sync with realtime updates
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find((t) => t.id === selectedTask.id)
      if (updated) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing derived state from upstream data
        setSelectedTask(updated)
      } else {
        setSelectedTask(null)
      }
    }
  }, [tasks, selectedTask])

  // Handle push notification taps — open the referenced task
  useEffect(() => {
    const handler = (e: Event) => {
      const { task_id } = (e as CustomEvent).detail || {}
      if (!task_id || !tasks.length) return
      const task = tasks.find((t) => t.id === task_id)
      if (task) setSelectedTask(task)
    }
    window.addEventListener('tm:open-task', handler)
    return () => window.removeEventListener('tm:open-task', handler)
  }, [tasks])

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
        <h1 className="text-[1.5rem] font-bold text-slate-800 dark:text-white">TaskMatrix</h1>
        <p className="text-slate-500 dark:text-slate-400 text-[0.875rem]">Sign in to see your tasks</p>
        <button
          onClick={signInWithGoogle}
          className="bg-slate-800 dark:bg-white text-white dark:text-slate-800 px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity min-h-[44px]"
        >
          Sign in with Google
        </button>
        {authError && <p className="text-red-500 dark:text-red-400 text-[0.875rem]">{authError}</p>}
      </div>
    )
  }

  if (tasksLoading) {
    const QUADRANT_BG = [
      'bg-blue-50 dark:bg-blue-950/30',
      'bg-emerald-50 dark:bg-emerald-950/30',
      'bg-amber-50 dark:bg-amber-950/30',
      'bg-purple-50 dark:bg-purple-950/30',
    ]
    const SHIMMER = 'bg-gradient-to-r from-transparent via-slate-200/60 dark:via-slate-700/40 to-transparent bg-[length:200%_100%]'
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-[#121212] px-3 sm:px-6">
        <style>{`
          @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
          .shimmer-bar{animation:shimmer 1.5s ease-in-out infinite}
          @media (prefers-reduced-motion:reduce){.shimmer-bar{animation:none}}
        `}</style>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-4xl">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`rounded-xl border border-slate-200 dark:border-slate-700 p-4 min-h-[220px] ${QUADRANT_BG[i]} overflow-hidden motion-reduce:animate-none`}>
              <div className={`shimmer-bar h-5 w-20 rounded mb-3 bg-slate-300 dark:bg-slate-600 ${SHIMMER}`} />
              <div className="space-y-2">
                <div className={`shimmer-bar h-12 rounded-lg bg-slate-200 dark:bg-slate-700 ${SHIMMER}`} />
                <div className={`shimmer-bar h-12 rounded-lg bg-slate-200 dark:bg-slate-700 ${SHIMMER}`} />
                <div className={`shimmer-bar h-12 rounded-lg bg-slate-200 dark:bg-slate-700 w-3/4 ${SHIMMER}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }



  const handleQuickAdd = async (q: Quadrant) => {
    const title = quickAdd.trim()
    if (!title) return
    setQuickAdd('')

    // AI path: parse typed text like voice
    if (aiSettings.enabled) {
      const result = await parseVoiceTranscript(title, aiSettings.model, getAIBaseUrl())
      if (!('error' in result)) {
        const p = result.parsed
        addTask(p.title, p.importance || 3, p.urgency || 3, p.category || undefined,
          { due_date: p.due_date || undefined, due_time: p.due_time || undefined, notes: p.notes || undefined })
        return
      }
    }

    // Fallback: use quadrant defaults
    const defaults = QUADRANT_DEFAULTS[q]
    addTask(title, defaults.importance, defaults.urgency, context !== 'all' ? context : undefined)
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

  const handleVoiceTask = async (transcript: string) => {
    if (!transcript.trim()) return
    setVoiceTaskStatus('saving')
    setVoiceTaskQuickAction(false)  // consumed

    // AI path: parse transcript into structured task
    if (aiSettings.enabled) {
      setVoiceTaskStatus('parsing...')
      const result = await parseVoiceTranscript(
        transcript,
        aiSettings.model,
        getAIBaseUrl()
      )
      if ('error' in result) {
        setVoiceTaskStatus(result.error)
        return
      } else {
        const p = result.parsed
        await addTask(
          p.title,
          p.importance || 3,
          p.urgency || 3,
          p.category || undefined,
          { due_date: p.due_date || undefined, due_time: p.due_time || undefined, notes: p.notes || undefined }
        )
        setVoiceTaskStatus('task created!')
        setTimeout(() => setVoiceTaskStatus(''), 2500)
        return
      }
    }

    // Fallback: fill quick-add input with raw transcript
    setQuickAdd(transcript.trim())
    setVoiceTaskStatus('')
  }

  const handleVoiceNote = async (transcript: string) => {
    if (!transcript.trim()) return
    setVoiceStatus('saving')
    setVoiceNoteQuickAction(false)  // consumed

    let content = transcript.trim()

    // AI formatting pass — clean up speech artifacts, structure the note
    if (aiSettings.enabled) {
      setVoiceStatus('formatting...')
      const result = await formatNoteContent(
        transcript,
        aiSettings.model,
        getAIBaseUrl()
      )
      if (!('error' in result)) {
        content = result.formatted
      }
      // On error, fall through with raw transcript
    }

    // Save as sticky note
    try {
      const note = await addNote(formatVoiceNote(content))
      if (note) {
        setEditingNote(note)
        setTimeout(() => setEditingNote(null), 2000)
        setVoiceStatus('saved!')
        setTimeout(() => setVoiceStatus(''), 2500)
      } else {
        setVoiceStatus('save failed')
        setTimeout(() => setVoiceStatus(''), 2000)
      }
    } catch (err) {
      console.error('[Voice] Failed to save note:', err)
      setVoiceStatus('save failed')
      setTimeout(() => setVoiceStatus(''), 2000)
    }
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] overflow-x-hidden w-full max-w-full">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#121212]/80 backdrop-blur border-b border-slate-200 dark:border-slate-800" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <div className="px-1 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
            <h1 className="text-[1rem] sm:text-[1.125rem] font-bold text-blue-600 dark:text-blue-400 tracking-tight whitespace-nowrap shrink-0">
              TaskMatrix
            </h1>

            {/* Quick-add input */}
            <div className="flex-1 relative">
              <div className="flex items-center gap-1.5">
                <VoiceButton onTranscript={handleVoiceTask} onStatus={setVoiceTaskStatus} autoStart={voiceTaskQuickAction} />
                <input
                  type="text"
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  onKeyDown={handleQuickAddKeyDown}
                  placeholder={suggestion ? `Try: ${suggestion}` : voiceTaskStatus || 'Quick add task...'}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 
                    dark:border-slate-700 rounded-lg px-3 py-1.5 text-[1rem] text-slate-700 
                    dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 placeholder:truncate
                    outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors min-w-0"
                />
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Sync indicator */}
              {(!offlineQueue.online || offlineQueue.isFlushing || offlineQueue.pendingCount > 0) && (
                <span className={`text-[0.75rem] px-2 py-1 rounded-full font-medium min-h-[44px] inline-flex items-center ${
                  !offlineQueue.online
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                    : offlineQueue.isFlushing
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`} role="status" aria-live="polite">
                  {!offlineQueue.online
                    ? `Offline${offlineQueue.pendingCount > 0 ? ` · ${offlineQueue.pendingCount}` : ''}`
                    : offlineQueue.isFlushing
                    ? 'Syncing…'
                    : `${offlineQueue.pendingCount} pending`}
                </span>
              )}

              {/* Desktop: inline buttons (sm+) */}
              <div className="hidden sm:flex items-center gap-0.5">
                <button onClick={() => setShowSettings(true)} className="text-[0.875rem] p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500" title="Settings" aria-label="Settings">⚙️</button>
                {aiSettings.enabled && (
                  <button onClick={handleSuggest} disabled={suggesting} className="text-[0.75rem] px-1.5 sm:px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all active:scale-90 min-h-[44px] disabled:opacity-50 shrink-0" title="AI suggests the best task to work on right now">
                    🎯 What next?
                  </button>
                )}
                <button onClick={() => window.location.reload()} className="text-[0.875rem] p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500" title="Refresh" aria-label="Refresh">↻</button>
                <button onClick={signOut} className="text-[0.875rem] p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500" title="Sign out" aria-label="Sign out">⏻</button>
              </div>

              {/* Mobile: dropdown menu (below sm) */}
              <div className="sm:hidden relative shrink-0">
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }} className="text-[1.125rem] p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500" aria-label="Menu">☰</button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 min-w-[160px]">
                      {aiSettings.enabled && (
                        <button onClick={() => { handleSuggest(); setShowMenu(false) }} disabled={suggesting} className="w-full text-left text-[0.875rem] px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2 min-h-[44px]">
                          🎯 What next?
                        </button>
                      )}
                      <button onClick={() => { setShowSettings(true); setShowMenu(false) }} className="w-full text-left text-[0.875rem] px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2 min-h-[44px]">
                        ⚙️ Settings
                      </button>
                      <button onClick={() => { window.location.reload() }} className="w-full text-left text-[0.875rem] px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2 min-h-[44px]">
                        ↻ Refresh
                      </button>
                      <button onClick={() => { signOut(); setShowMenu(false) }} className="w-full text-left text-[0.875rem] px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2 min-h-[44px]">
                        ⏻ Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

      {/* Context switcher + body */}
      {/* Offline banner */}
      {!offlineQueue.online && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-3 sm:px-6 py-2 text-center">
          <span className="text-[0.75rem] font-medium text-amber-700 dark:text-amber-400">
            You're offline.{offlineQueue.pendingCount > 0 ? ` ${offlineQueue.pendingCount} change${offlineQueue.pendingCount !== 1 ? 's' : ''} pending.` : ''} Changes will sync when you reconnect.
          </span>
        </div>
      )}
      {/* Context switcher */}
      <div className="px-3 sm:px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-[#121212]/60">
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            key="all"
            onClick={() => setContext('all')}
            className={`text-[0.75rem] px-3 py-2 rounded-full font-medium transition-all active:scale-95 motion-reduce:scale-100 active:opacity-80 min-h-[44px] inline-flex items-center
              ${context === 'all'
                ? 'bg-blue-600 dark:bg-blue-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setContext(cat.label)}
              className={`text-[0.75rem] px-3 py-2 rounded-full font-medium transition-all active:scale-95 motion-reduce:scale-100 active:opacity-80 min-h-[44px] inline-flex items-center
                ${context === cat.label
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
            >
              {cat.icon} {cat.display}
            </button>
          ))}
        </div>
      </div>

      {/* Body: matrix + sticky notes side by side */}
      {/* pb clears the fixed bottom nav (+ home-indicator safe area) */}
      <div className="px-1 sm:px-6 pt-4 sm:pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <div className="flex flex-col lg:flex-row gap-5 lg:items-start w-full">

          {/* Matrix column */}
          <div className="flex-1 min-w-0 w-full">

            {/* Today strip */}
            <TodayStrip tasks={filteredTasks} onTaskClick={setSelectedTask} />

            <MatrixScreen
              tasks={filteredTasks}
              onMove={handleMove}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
              onTaskClick={setSelectedTask}
              categories={categories}
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
              onNewBlank={handleNewBlankNote}
              onReorder={reorderNote}
              sidebar
            />
          </div>
        </div>

        <CompletedSection
          userId={userId}
          context={context}
          reloadTrigger={reloadTrigger}
          onUncomplete={(id) => { updateStatus(id, 'todo'); setReloadTrigger((n) => n + 1) }}
          onClearCompleted={handleClearCompleted}
          onTaskClick={setSelectedTask}
        />
      </div>

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onUpdate={updateTask}
          onClose={() => setSelectedTask(null)}
          categories={categories}
        />
      )}

      {showNotesModal && (
        <NotesModal
          notes={notes}
          onClose={() => setShowNotesModal(false)}
          onAdd={addNote}
          onEdit={(note) => {
            cameFromNotesModal.current = true
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
          onClose={() => {
            setEditingNote(null)
            if (cameFromNotesModal.current) {
              cameFromNotesModal.current = false
              setShowNotesModal(true)
            }
          }}
        />
      )}

      <PomodoroPopup show={showPomodoro} onClose={() => setShowPomodoro(false)} />

      {showSettings && (
        <SettingsModal
          categories={categories}
          onSave={updateCategories}
          onClose={() => setShowSettings(false)}
          aiSettings={aiSettings}
          onAISettingsChange={updateAISettings}
        />
      )}

      {/* Undo snackbar — sits above the bottom nav */}
      {undoTask && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50
            flex items-center gap-1 bg-slate-800 dark:bg-slate-700 text-white
            rounded-xl shadow-lg pl-4 pr-1 py-1 max-w-[calc(100vw-2rem)]"
        >
          <span className="text-[0.875rem] truncate">{undoIsDoneDismiss ? 'Completed' : 'Deleted'} “{undoTask.title}”</span>
          <button
            onClick={handleUndoDelete}
            className="text-[0.875rem] font-semibold text-blue-300 hover:text-blue-200 px-3 rounded-lg min-h-[44px] shrink-0"
          >
            Undo
          </button>
        </div>
      )}

      {/* Mobile bottom action bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#121212]/80 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-3 py-1">
          {/* Hide the whole slot when speech is unsupported (e.g. WKWebView) —
              VoiceButton renders null but the label would remain as a dead item */}
          {speechSupported() && (
            <div className="flex flex-col items-center gap-0.5 p-1 rounded-lg min-h-[44px] min-w-[44px]">
              <VoiceButton
                onTranscript={handleVoiceNote}
                onStatus={setVoiceStatus}
                autoStart={voiceNoteQuickAction}
                icon="🎙️"
                className="p-0 bg-transparent border-none text-[1.125rem] text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              />
              <span className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400">
                {voiceStatus || 'Voice'}
              </span>
            </div>
          )}
          <button
            onClick={() => setShowPomodoro(v => !v)}
            className="flex flex-col items-center gap-0.5 p-1 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all min-h-[44px] min-w-[44px]"
            aria-label="Pomodoro timer"
          >
            <span className="text-[1.125rem]">⏱</span>
            <span className="text-[0.75rem] font-medium">Focus</span>
          </button>
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center gap-0.5 p-1 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all min-h-[44px] min-w-[44px]"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="text-[1.125rem]">{dark ? '☀️' : '🌙'}</span>
            <span className="text-[0.75rem] font-medium">Theme</span>
          </button>
          <button
            onClick={() => setShowNotesModal(true)}
            className="flex flex-col items-center gap-0.5 p-1 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all min-h-[44px] min-w-[44px]"
            aria-label="View all notes"
          >
            <span className="text-[1.125rem]">📌</span>
            <span className="text-[0.75rem] font-medium">Notes</span>
          </button>
        </div>
      </nav>
    </div>
    </ErrorBoundary>
  )
}
