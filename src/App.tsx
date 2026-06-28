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
import { useFontScale } from './hooks/useFontScale'
import MatrixScreen from './components/matrix/MatrixScreen'
import StickyWall from './components/StickyWall'
import NotesModal from './components/NotesModal'
import ProgressHeatmap from './components/ProgressHeatmap'
import NoteEditModal from './components/NoteEditModal'
import PomodoroPopup from './components/PomodoroPopup'
import TodayStrip from './components/TodayStrip'
import CompletedSection from './components/CompletedSection'
import TaskDetail from './components/TaskDetail'
import SettingsModal from './components/SettingsModal'
import CalendarView from './components/CalendarView'
import VoiceButton from './components/VoiceButton'
import { Mic, Timer, Moon, Sun, StickyNote as StickyNoteIcon, CalendarDays } from 'lucide-react'
import { stripMarkdown } from './lib/markdown'
import { speechSupported, formatVoiceNote } from './lib/speech'
import { parseVoiceTranscript, suggestNextTask, formatNoteContent, suggestCategory } from './lib/ai-parse'
import { listenForReminderTaps, defaultReminder } from './lib/notifications'
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
        <div className="flex flex-col items-center justify-center h-screen gap-2 px-6 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-[0.875rem]">
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

  // Auto-navigate to notes when voice-note quick action is triggered
  useEffect(() => {
    if (voiceNoteQuickAction) {
      setShowNotesModal(true)
    }
  }, [voiceNoteQuickAction])
  const [focusQuickAdd, setFocusQuickAdd] = useState(false)
  const quickAddRef = useRef<HTMLInputElement>(null)

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

      // Siri Shortcut deep link: taskmatrix://quick-add
      if (callbackUrl === 'taskmatrix://quick-add') {
        setFocusQuickAdd(true)
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
  const { fontScale, setFontScale } = useFontScale()

  const { tasks, loading: tasksLoading, addTask, updateStatus, updateTask, deleteTask, restoreTask, clearCompleted } = useTasks(userId, offlineQueue)
  const { notes, pinnedNotes, addNote, updateNote, deleteNote, restoreNote, fetchDeletedNotes, permanentlyDeleteNote, reorderNote } = useStickyNotes(userId, offlineQueue)
  const { categories, updateCategories } = useUserSettings(userId, offlineQueue)
  const [quickAdd, setQuickAdd] = useState('')
  const [context, setContext] = useState(() => localStorage.getItem('tm-context') || 'all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [notesInitialView, setNotesInitialView] = useState<'notes' | 'trash'>('notes')
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null)
  const cameFromNotesModal = useRef(false)
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceTaskStatus, setVoiceTaskStatus] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [suggestionIsError, setSuggestionIsError] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // Auto-close mobile menu after 5s
  useEffect(() => {
    if (!showMenu) return
    const t = setTimeout(() => setShowMenu(false), 5000)
    return () => clearTimeout(t)
  }, [showMenu])

  // Generic undo snackbar — holds a message + restore action for 5s. Covers task
  // delete, task complete-dismiss, and note delete, so any single destructive
  // action is one tap away from being reversed.
  const [pendingUndo, setPendingUndo] = useState<{ message: string; onUndo: () => void } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recurring stop confirm — replaces ugly window.confirm() with a snackbar
  const recurringResolveRef = useRef<((v: boolean) => void) | null>(null)
  const recurringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [recurringConfirm, setRecurringConfirm] = useState<{ title: string } | null>(null)

  const confirmStopRecurring = (task: Task): Promise<boolean> => {
    return new Promise((resolve) => {
      recurringResolveRef.current = resolve
      setRecurringConfirm({ title: task.title })
      // Auto-dismiss after 6s — default to keep recurring (non-destructive)
      recurringTimerRef.current = setTimeout(() => {
        recurringTimerRef.current = null
        resolve(false)
        setRecurringConfirm(null)
      }, 6000)
    })
  }

  const showUndo = (message: string, onUndo: () => void) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setPendingUndo({ message, onUndo })
    undoTimerRef.current = setTimeout(() => setPendingUndo(null), 5000)
  }

  const clearUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setPendingUndo(null)
  }

  const handleUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    pendingUndo?.onUndo()
    setPendingUndo(null)
  }

  // Increment to signal CompletedSection to re-fetch
  const [reloadTrigger, setReloadTrigger] = useState(0)

  const handleDeleteTask = (id: string) => {
    const task = tasks.find((t) => t.id === id)
    deleteTask(id)
    if (task) showUndo(`Deleted “${task.title}”`, () => restoreTask(task))
  }

  const handleDeleteNote = (id: string) => {
    const note = notes.find((n) => n.id === id)
    deleteNote(id)
    if (note) {
      const label = note.title?.trim() || stripMarkdown(note.content || '').trim()
      showUndo(label ? `Deleted note “${label.slice(0, 32)}”` : 'Deleted note', () => restoreNote(note))
    }
  }

  // When a task is marked done, show an undo snackbar for 5s.
  // The task leaves the active matrix immediately (matrix filters status='todo').
  // No auto-delete timer — done tasks persist in CompletedSection until manually cleared.
  const handleStatusChange = async (id: string, status: string) => {
    let preventSpawn = false
    const task = tasks.find((t) => t.id === id)
    
    if (status === 'done' && task?.recurring) {
      preventSpawn = await confirmStopRecurring(task)
    }
    
    updateStatus(id, status, preventSpawn)
    
    if (status === 'done') {
      if (task) showUndo(`Completed “${task.title}”`, () => updateStatus(task.id, 'todo'))
      // Signal CompletedSection to re-fetch so the newly done task appears.
      setReloadTrigger((n) => n + 1)
    } else {
      // Task un-completed — clear any pending snackbar.
      clearUndo()
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

  // Focus quick-add input when triggered by Siri Shortcut
  useEffect(() => {
    if (focusQuickAdd) {
      setFocusQuickAdd(false)
      // Small delay for Capacitor to finish presenting the app
      setTimeout(() => quickAddRef.current?.focus(), 300)
    }
  }, [focusQuickAdd])

  // Calendar helpers
  const getTasksOnDate = (dateStr: string) => tasks.filter((t) => t.due_date === dateStr)

  // Lock body scroll when any modal is open (prevents iOS horizontal overscroll).
  // Save/restore scrollY so WKWebView doesn't jump to y=0 when position:fixed is applied.
  const hasModal = !!(editingNote || showNotesModal || selectedTask || showPomodoro || showSettings || showCalendar)
  const savedScrollY = useRef(0)
  useEffect(() => {
    if (hasModal) {
      savedScrollY.current = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${savedScrollY.current}px`
    } else {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      window.scrollTo(0, savedScrollY.current)
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
    }
  }, [hasModal])

  const handleSuggest = async () => {
    if (!aiSettings.enabled) {
      setSuggestion('AI disabled — enable in Settings ⚙️')
      setSuggestionIsError(true)
      setTimeout(() => { setSuggestion(''); setSuggestionIsError(false) }, 4000)
      return
    }
    if (filteredTasks.length === 0) {
      setSuggestion('No tasks to suggest from')
      setSuggestionIsError(true)
      setTimeout(() => { setSuggestion(''); setSuggestionIsError(false) }, 3000)
      return
    }
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
      setSuggestionIsError(false)
      setTimeout(() => setSuggestion(''), 10000)
    } else {
      setSuggestion(result.error || 'Could not reach AI')
      setSuggestionIsError(true)
      setTimeout(() => { setSuggestion(''); setSuggestionIsError(false) }, 4000)
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

  // Initialize local notification tap listener (runs once on mount)
  useEffect(() => { listenForReminderTaps() }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          {/* Header skeleton */}
          <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-6" />
          {/* Filter pills skeleton */}
          <div className="flex gap-2 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`h-10 rounded-full animate-pulse bg-slate-200 dark:bg-slate-800 ${i === 0 ? 'w-12' : 'w-20'}`} />
            ))}
          </div>
          {/* 2×2 grid skeleton */}
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl p-3 h-32 bg-slate-100 dark:bg-slate-800/50 animate-pulse">
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
                <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-white dark:bg-slate-950">
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
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 px-3 sm:px-6">
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
      const result = await parseVoiceTranscript(title, aiSettings.model, getAIBaseUrl(), categories.map(c => c.label))
      if (!('error' in result)) {
        const p = result.parsed
        addTask(p.title, p.importance || 3, p.urgency || 3, p.category || undefined,
          { due_date: p.due_date || undefined, due_time: p.due_time || undefined,
            notes: p.notes || undefined,
            reminder: defaultReminder({ due_date: p.due_date, due_time: p.due_time }) || undefined,
            pinned: p.pinned || undefined,
            recurring: p.recurring || undefined, recur_frequency: p.recur_frequency || undefined, recur_days: p.recur_days || undefined })
        return
      }
    }

    // Fallback: use quadrant defaults + AI category suggestion
    const defaults = QUADRANT_DEFAULTS[q]
    let autoCategory = context !== 'all' ? context : undefined

    if (aiSettings.enabled && !autoCategory) {
      const catResult = await suggestCategory(title)
      if ('category' in catResult) {
        autoCategory = catResult.category
      }
    }

    addTask(title, defaults.importance, defaults.urgency, autoCategory)
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

  // Flag = toggle the existing `pinned` field. Reuses updateTask (debounced
  // optimistic + offline-queue path), the same persistence as move/title edits.
  const handleFlag = (id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    updateTask(id, { pinned: !task.pinned })
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
        getAIBaseUrl(),
        categories.map(c => c.label)
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
          { due_date: p.due_date || undefined, due_time: p.due_time || undefined, notes: p.notes || undefined,
            reminder: defaultReminder({ due_date: p.due_date, due_time: p.due_time }) || undefined,
            pinned: p.pinned || undefined,
            recurring: p.recurring || undefined, recur_frequency: p.recur_frequency || undefined, recur_days: p.recur_days || undefined }
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
      const shouldPin = /\bpin\b/i.test(transcript)
      if (shouldPin) {
        content = transcript
          .replace(/\bpin this note[:;,\s-]*/i, '')
          .replace(/^pin[:;,\s-]+/i, '')
          .trim() || transcript.trim()
      }
      const note = await addNote(formatVoiceNote(content), shouldPin)
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden w-full max-w-full">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200/60 dark:border-slate-800/40 pt-safe">
        <div className="px-1 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
            <h1 className="text-[1.125rem] font-bold text-blue-600 dark:text-blue-400 tracking-tight whitespace-nowrap shrink-0">
              TaskMatrix
            </h1>

            {/* Quick-add input */}
            <div className="flex-1 relative max-w-[280px] sm:max-w-sm">
              <div className="flex items-center gap-1.5">
                <VoiceButton onTranscript={handleVoiceTask} onStatus={setVoiceTaskStatus} autoStart={voiceTaskQuickAction} />
                <div className="flex-1 relative">
                  <label htmlFor="quick-add-input" className="sr-only">Quick add task</label>
                  <input
                    id="quick-add-input"
                    ref={quickAddRef}
                    type="search"
                    value={quickAdd}
                    onChange={(e) => setQuickAdd(e.target.value)}
                    onKeyDown={handleQuickAddKeyDown}
                    aria-label="Quick add task"
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 
                      dark:border-slate-700 rounded-lg px-3 text-[1rem] text-slate-700 
                      dark:text-slate-300 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors h-11"
                  />
                  {!quickAdd && (
                    suggestion ? (
                      <div className="absolute -top-[3rem] left-0 right-0 sm:left-full sm:right-auto sm:top-0 sm:ml-2 sm:w-max z-10">
                        <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2 shadow-md animate-in slide-in-from-bottom-2 fade-in duration-200">
                          <span className="text-sm shrink-0">✨</span>
                          <span className="flex-1 text-[0.875rem] font-medium text-blue-800 dark:text-blue-200 truncate max-w-[200px]">{suggestion}</span>
                          {!suggestionIsError && (
                          <button
                            type="button"
                            onClick={() => { setQuickAdd(suggestion); setSuggestion('') }}
                            className="text-[0.75rem] font-semibold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 shrink-0 min-h-[36px]"
                          >
                            Do it
                          </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSuggestion('')}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0 min-h-[36px] px-0.5"
                            aria-label="Dismiss suggestion"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="absolute inset-y-0 left-3 flex items-center text-[1rem] text-slate-400 dark:text-slate-600 pointer-events-none truncate right-3" aria-hidden="true">
                        {voiceTaskStatus || 'Quick add task…'}
                      </span>
                    )
                  )}
              </div>
            </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
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
                <button onClick={() => setShowSettings(true)} className="text-[0.875rem] p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500" title="Settings" aria-label="Settings"><span aria-hidden="true">⚙️</span></button>
                {aiSettings.enabled ? (
                  <button onClick={handleSuggest} disabled={suggesting} className="text-[0.75rem] px-1.5 sm:px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all active:scale-90 min-h-[44px] disabled:opacity-50 shrink-0" title="AI suggests the best task to work on right now">
                    <span aria-hidden="true">🎯 What next?</span>
                  </button>
                ) : (
                  <button onClick={() => setShowSettings(true)} className="text-[0.75rem] px-1.5 sm:px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] shrink-0" title="Enable AI in Settings to use What's Next?">
                    <span aria-hidden="true">🎯 What next?</span>
                  </button>
                )}
                <button onClick={() => window.location.reload()} className="text-[0.875rem] p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500" title="Refresh" aria-label="Refresh"><span aria-hidden="true">↻</span></button>
                <button onClick={signOut} className="text-[0.875rem] p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500" title="Sign out" aria-label="Sign out"><span aria-hidden="true">⏻</span></button>
              </div>

              {/* Mobile: dropdown menu (below sm) */}
              <div className="sm:hidden relative shrink-0">
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }} className="text-[1.125rem] p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500" aria-label="Menu"><span aria-hidden="true">☰</span></button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 min-w-[160px]">
                      {aiSettings.enabled && (
                        <button onClick={() => { handleSuggest(); setShowMenu(false) }} disabled={suggesting} className="w-full text-left text-[0.875rem] px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2 min-h-[44px]">
                          <span aria-hidden="true">🎯 What next?</span>
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

        {/* Spacer — compensates for fixed header height */}
        <div className="h-[calc(env(safe-area-inset-top)+3.75rem)] sm:h-[calc(env(safe-area-inset-top)+4.25rem)]" />

      {/* Context switcher + body */}
      {/* Offline banner */}
      {!offlineQueue.online && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-3 sm:px-6 py-2 text-center">
          <span className="text-[0.75rem] font-medium text-amber-700 dark:text-amber-400">
            You're offline.{offlineQueue.pendingCount > 0 ? ` ${offlineQueue.pendingCount} change${offlineQueue.pendingCount !== 1 ? 's' : ''} pending.` : ''} Changes will sync when you reconnect.
          </span>
        </div>
      )}
      {/* Context switcher — single-select category filter.
          Canonical state: the `context` string (`'all'` or one category label);
          single-select is enforced by setContext replacing the value (App.tsx ~198/355/481).
          TODO (deferred: needs device — SPEC-category-ux.md "Visual implementation"):
          give each selected pill its category colour identity via CATEGORY_BADGE/CATEGORY_RING.
          Visual styling is eyeball-gated; not implemented here. */}
      <div className="px-3 sm:px-6 py-2 border-b border-slate-200/60 dark:border-slate-800/40 bg-white/60 dark:bg-slate-950/60">
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            key="all"
            aria-label="Show all categories"
            aria-pressed={context === 'all'}
            onClick={() => setContext('all')}
            className={`text-[0.75rem] px-3 py-2 rounded-full font-medium transition-all active:scale-95 motion-reduce:scale-100 active:opacity-80 min-h-[44px] min-w-[44px] inline-flex items-center justify-center
              ${context === 'all'
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                : 'bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
          >
            <span aria-hidden="true">All</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.label}
              aria-label={`Filter by ${cat.display}`}
              aria-pressed={context === cat.label}
              onClick={() => setContext(cat.label)}
              className={`text-[0.75rem] px-3 py-2 rounded-full font-medium transition-all active:scale-95 motion-reduce:scale-100 active:opacity-80 min-h-[44px] min-w-[44px] inline-flex items-center justify-center
                ${context === cat.label
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
            >
              <span aria-hidden="true">{cat.icon} {cat.display}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body: matrix + sticky notes side by side */}
      {/* pb clears the fixed bottom nav (+ home-indicator safe area) */}
      <div className="px-1 sm:px-6 pt-4 sm:pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <div className="flex flex-col lg:flex-row gap-5 lg:items-stretch w-full mb-6">

          {/* Matrix column */}
          <div className="flex-1 min-w-0 w-full flex flex-col">

            {/* Today strip */}
            <TodayStrip tasks={filteredTasks} onTaskClick={setSelectedTask} />

            <MatrixScreen
              tasks={filteredTasks}
              onMove={handleMove}
              onFlag={handleFlag}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
              onTaskClick={setSelectedTask}
              categories={categories}
            />

            {/* Progress heatmap */}
            <div className="mt-9 lg:w-3/4 xl:w-1/2 flex-1">
              <div className="lg:sticky lg:top-24 pb-4">
                <ProgressHeatmap tasks={filteredTasks} />
              </div>
            </div>

          </div>

          {/* Sticky notes sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            <StickyWall
              notes={pinnedNotes}
              onDelete={handleDeleteNote}
              onAdd={addNote}
              onEdit={setEditingNote}
              onShowAll={() => setShowNotesModal(true)}
              onShowDeleted={() => { setNotesInitialView('trash'); setShowNotesModal(true) }}
              onNewBlank={handleNewBlankNote}
              onReorder={reorderNote}
              sidebar
            />
          </div>
        </div>

        {/* Completed section */}
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
          onClose={() => { setShowNotesModal(false); setNotesInitialView('notes') }}
          onNewBlank={handleNewBlankNote}
          onEdit={(note) => {
            cameFromNotesModal.current = true
            setShowNotesModal(false)
            setEditingNote(note)
          }}
          onPin={(id, pinned) => updateNote(id, { pinned })}
          onDelete={handleDeleteNote}
          onFetchDeleted={fetchDeletedNotes}
          onRestore={restoreNote}
          onPurgeForever={permanentlyDeleteNote}
          initialView={notesInitialView}
        />
      )}

      {editingNote && (
        <NoteEditModal
          note={editingNote}
          onSave={updateNote}
          onDelete={handleDeleteNote}
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
          fontScale={fontScale}
          onFontScaleChange={setFontScale}
        />
      )}

      {/* Recurring stop confirm snackbar */}
      {showCalendar && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setShowCalendar(false)} />
          <div className="fixed inset-x-2 top-[2%] bottom-[2%] z-50 bg-white dark:bg-slate-950 rounded-2xl shadow-2xl flex flex-col max-w-2xl mx-auto overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h1 className="text-[1.0625rem] font-bold text-slate-800 dark:text-slate-100">Calendar</h1>
              <button
                onClick={() => setShowCalendar(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-500 dark:text-slate-400"
                aria-label="Close calendar"
              >
                ✕
              </button>
            </div>
            <CalendarView tasks={tasks} getTasksOnDate={getTasksOnDate} />
          </div>
        </>)}

      {recurringConfirm && (
        <div
          role="alertdialog"
          aria-label="Stop recurring task"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(8rem+env(safe-area-inset-bottom))] z-50
            flex items-center gap-1 bg-slate-800 dark:bg-slate-700 text-white
            rounded-xl shadow-lg pl-3 pr-1 py-1 max-w-[calc(100vw-2rem)]"
        >
          <span className="text-[0.8125rem] shrink-0">Stop recurring?</span>
          <button
            onClick={() => {
              if (recurringTimerRef.current) { clearTimeout(recurringTimerRef.current); recurringTimerRef.current = null }
              recurringResolveRef.current?.(true)
              setRecurringConfirm(null)
            }}
            className="text-[0.8125rem] font-semibold text-red-400 hover:text-red-300 px-3 rounded-lg min-h-[44px] shrink-0"
          >
            Stop
          </button>
          <button
            onClick={() => {
              if (recurringTimerRef.current) { clearTimeout(recurringTimerRef.current); recurringTimerRef.current = null }
              recurringResolveRef.current?.(false)
              setRecurringConfirm(null)
            }}
            className="text-[0.8125rem] font-semibold text-blue-300 hover:text-blue-200 px-3 rounded-lg min-h-[44px] shrink-0"
          >
            Keep
          </button>
        </div>
      )}

      {/* Undo snackbar — sits above the bottom nav */}
      {pendingUndo && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50
            flex items-center gap-1 bg-slate-800 dark:bg-slate-700 text-white
            rounded-xl shadow-lg pl-4 pr-1 py-1 max-w-[calc(100vw-2rem)]"
        >
          <span className="text-[0.875rem] truncate">{pendingUndo.message}</span>
          <button
            onClick={handleUndo}
            className="text-[0.875rem] font-semibold text-blue-300 hover:text-blue-200 px-3 rounded-lg min-h-[44px] shrink-0"
          >
            Undo
          </button>
        </div>
      )}

      {/* Mobile bottom action bar */}
      <nav role="presentation" className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-t border-slate-200/60 dark:border-slate-800/40 pb-[env(safe-area-inset-bottom)]">
        {/* Transient voice status floats above the bar so the icon row stays symmetric */}
        {voiceStatus && (
          <span
            className="absolute left-1/2 -translate-x-1/2 -top-6 text-[0.625rem] font-medium
              text-slate-500 dark:text-slate-400 whitespace-nowrap pointer-events-none"
            aria-hidden="true"
          >
            {voiceStatus}
          </span>
        )}
        <div className="flex items-center justify-evenly px-3 pt-2.5 pb-1">
          {/* Speech unsupported (e.g. WKWebView) → VoiceButton returns null; the slot drops out */}
          {speechSupported() && (
            <VoiceButton
              onTranscript={handleVoiceNote}
              onStatus={setVoiceStatus}
              autoStart={voiceNoteQuickAction}
              icon={<Mic size={26} strokeWidth={2} aria-hidden="true" />}
              className="w-12 h-12 p-0 bg-transparent border-none rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            />
          )}
          <button
            onClick={() => setShowPomodoro(v => !v)}
            className="flex items-center justify-center w-12 h-12 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all"
            aria-label="Pomodoro timer"
          >
            <Timer size={26} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            onClick={() => setShowCalendar(true)}
            className="flex items-center justify-center w-12 h-12 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all"
            aria-label="Calendar"
          >
            <CalendarDays size={26} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-12 h-12 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark
              ? <Sun size={26} strokeWidth={2} aria-hidden="true" />
              : <Moon size={26} strokeWidth={2} aria-hidden="true" />}
          </button>
          <button
            onClick={() => setShowNotesModal(true)}
            className="flex items-center justify-center w-12 h-12 rounded-lg text-slate-500 dark:text-slate-400 active:scale-90 motion-reduce:scale-100 transition-all"
            aria-label="View all notes"
          >
            <StickyNoteIcon size={26} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
    </ErrorBoundary>
  )
}
