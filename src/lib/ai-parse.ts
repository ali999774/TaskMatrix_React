// AI-powered voice transcript → structured task parser.
// Routes through a Supabase Edge Function (server-side API key).
// Uses supabase.functions.invoke() so the anon key is auto-injected.
// Supports four modes: parse (task parsing), breakdown (subtask generation), suggest (next task), format (note cleanup).

import { supabase } from './supabase'

interface ParsedTask {
  title: string
  due_date?: string | null
  due_time?: string | null
  category?: string | null
  importance?: number
  urgency?: number
  notes?: string | null
  pinned?: boolean
  recurring?: boolean
  recur_frequency?: string | null
  recur_days?: number[] | null
}

async function callEdgeFn(body: Record<string, unknown>, attempt = 1): Promise<{ data: Record<string, unknown> } | { error: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-parse', { body })

    if (error) {
      console.error('[AI] Edge function error:', error)
      // FunctionsFetchError = network/fetch failure (client never reached edge fn)
      // FunctionsHttpError  = edge fn returned non-2xx (e.g. 503 relay, 502 API)
      // FunctionsRelayError = Supabase relay issue
      const isFetchError = error.name === 'FunctionsFetchError'
      const originalErr = (error as { context?: { name?: string } }).context

      // Retry once on transient fetch failures (network blip, DNS, TLS)
      if (isFetchError && attempt < 2) {
        console.warn('[AI] Retrying after fetch error...')
        await new Promise(r => setTimeout(r, 800))
        return callEdgeFn(body, attempt + 1)
      }

      if (isFetchError) {
        const detail = originalErr?.name ? ` (${originalErr.name})` : ''
        return { error: `Can't reach AI — check connection${detail}` }
      }
      if (error.name === 'FunctionsHttpError') {
        return { error: `AI service error — try again later` }
      }
      return { error: error.message || 'API error' }
    }

    if (!data) return { error: 'empty response' }
    if (data.error) return { error: data.error as string }

    return { data: data as Record<string, unknown> }
  } catch (err) {
    console.error('[AI] Unexpected:', err)
    return { error: 'network error' }
  }
}

export async function parseVoiceTranscript(
  transcript: string,
  model: string = 'deepseek-v4-flash',
  baseUrl: string = 'https://api.deepseek.com/v1',
  categories?: string[]
): Promise<{ parsed: ParsedTask } | { error: string }> {
  if (!transcript.trim()) return { error: 'empty transcript' }

  const body: Record<string, unknown> = { transcript, model, baseUrl }
  if (categories && categories.length > 0) body.categories = categories
  const result = await callEdgeFn(body)
  if ('error' in result) return result

  const d = result.data
  return {
    parsed: {
      title: d.title as string || transcript.trim().slice(0, 60),
      due_date: (d.due_date as string) || null,
      due_time: (d.due_time as string) || null,
      category: (d.category as string) || null,
      importance: typeof d.importance === 'number' ? Math.min(5, Math.max(1, d.importance)) : 3,
      urgency: typeof d.urgency === 'number' ? Math.min(5, Math.max(1, d.urgency)) : 3,
      notes: (d.notes as string) || null,
      pinned: d.pinned === true,
      recurring: d.recurring === true,
      recur_frequency: (d.recur_frequency as string) || null,
      recur_days: Array.isArray(d.recur_days) ? (d.recur_days as number[]) : null,
    },
  }
}

export async function breakDownTask(
  title: string,
  notes?: string
): Promise<{ subtasks: string[] } | { error: string }> {
  if (!title.trim()) return { error: 'empty title' }
  const transcript = notes ? `${title}\nNotes: ${notes}` : title
  const result = await callEdgeFn({ transcript, mode: 'breakdown' })
  if ('error' in result) return result
  const subtasks = Array.isArray(result.data.subtasks) ? result.data.subtasks as string[] : []
  return { subtasks }
}

export async function suggestNextTask(
  taskList: string
): Promise<{ suggested: string } | { error: string }> {
  if (!taskList.trim()) return { error: 'empty task list' }
  const result = await callEdgeFn({ transcript: taskList, mode: 'suggest' })
  if ('error' in result) return result
  return { suggested: (result.data.suggested as string) || 'No suggestion' }
}

export async function formatNoteContent(
  transcript: string,
  model: string = 'deepseek-v4-flash',
  baseUrl: string = 'https://api.deepseek.com/v1'
): Promise<{ formatted: string } | { error: string }> {
  if (!transcript.trim()) return { error: 'empty transcript' }
  const result = await callEdgeFn({ transcript, model, baseUrl, mode: 'format' })
  if ('error' in result) return result
  return { formatted: (result.data.formatted as string) || transcript.trim() }
}

export async function suggestCategory(
  taskTitle: string
): Promise<{ category: string } | { error: string }> {
  if (!taskTitle.trim()) return { error: 'empty title' }

  const result = await callEdgeFn({ transcript: taskTitle, mode: 'classify' })
  if ('error' in result) return result

  const raw = (result.data.category as string)?.trim().toLowerCase()
  const valid = ['personal', 'dev', 'launch', 'clinic']
  const category = valid.find(c => raw === c) || valid.find(c => raw?.includes(c))

  return category ? { category } : { error: `unknown category: ${raw}` }
}

// ── AI BRIEF TYPES ──────────────────────────────────────────────

export interface MorningBrief {
  greeting: string
  summary: string
  overdue: { title: string; id: string; days: number }[]
  due_today: { title: string; id: string }[]
  focus_areas: string[]
  momentum: string
  tip: string
}

export interface DayPlanItem {
  id: string
  title: string
  rationale: string
  suggested_duration: string
  batch_hint?: string
}

export interface DayPlan {
  plan: DayPlanItem[]
  pacing: string
  total_estimated: string
  energy_tip: string
}

export interface WhatNext {
  title: string
  id: string | null
  why: string | null
  break_suggestion?: string | null
}

export interface WeeklyReview {
  summary: string
  stats: {
    completed: number
    completion_rate: number
    best_day: string
    most_productive_category: string | null
  }
  wins: string[]
  patterns: string[]
  suggestions: string[]
  stale_tasks: { title: string; id: string; days_stale: number }[]
  mood: string
}

// ── AI BRIEF API FUNCTIONS ──────────────────────────────────────

function formatTaskList(tasks: Array<{
  id: string
  title: string
  quadrant?: number
  importance?: number
  urgency?: number
  status?: string
  due_date?: string | null
  due_time?: string | null
  category?: string | null
  notes?: string | null
  estimated_duration?: number | null
  pinned?: boolean
  subtasks?: { title: string; done: boolean }[]
  updated_at?: string | null
}>): string {
  if (tasks.length === 0) return 'No active tasks.'

  const lines: string[] = []
  const qLabel = (q?: number) => {
    if (q === 1) return 'Do First'
    if (q === 2) return 'Schedule'
    if (q === 3) return 'Delegate'
    if (q === 4) return "Don't Do"
    return 'No quadrant'
  }

  for (const t of tasks) {
    const parts: string[] = [
      `[${t.id}] "${t.title}"`,
      `quadrant: ${qLabel(t.quadrant)}`,
      `importance: ${t.importance ?? '?'}/5`,
      `urgency: ${t.urgency ?? '?'}/5`,
      `status: ${t.status || 'todo'}`,
    ]
    if (t.due_date) parts.push(`due: ${t.due_date}`)
    if (t.due_time) parts.push(`at ${t.due_time}`)
    if (t.category) parts.push(`#${t.category}`)
    if (t.estimated_duration) parts.push(`est: ${t.estimated_duration}min`)
    if (t.notes) parts.push(`notes: ${t.notes.slice(0, 100)}`)
    if (t.subtasks && t.subtasks.length > 0) {
      const done = t.subtasks.filter(s => s.done).length
      parts.push(`subtasks: ${done}/${t.subtasks.length} done`)
    }
    lines.push(parts.join(' | '))
  }

  return lines.join('\n')
}

export async function getMorningBrief(
  tasks: Array<{
    id: string; title: string; quadrant?: number; importance?: number
    urgency?: number; status?: string; due_date?: string | null
    due_time?: string | null; category?: string | null; notes?: string | null
    estimated_duration?: number | null
    subtasks?: { title: string; done: boolean }[]
  }>,
  recentCompletions?: number
): Promise<MorningBrief | { error: string }> {
  const taskList = formatTaskList(tasks)
  const extra = recentCompletions != null
    ? `\n\nRecently completed today: ${recentCompletions} tasks.`
    : ''

  const result = await callEdgeFn({
    transcript: taskList + extra,
    mode: 'morning-brief',
  })

  if ('error' in result) return result
  return result.data as unknown as MorningBrief
}

export async function getDayPlan(
  tasks: Array<{
    id: string; title: string; quadrant?: number; importance?: number
    urgency?: number; status?: string; due_date?: string | null
    due_time?: string | null; category?: string | null; notes?: string | null
    estimated_duration?: number | null
    subtasks?: { title: string; done: boolean }[]
  }>
): Promise<DayPlan | { error: string }> {
  const result = await callEdgeFn({
    transcript: formatTaskList(tasks),
    mode: 'day-plan',
  })

  if ('error' in result) return result
  return result.data as unknown as DayPlan
}

export async function getWhatNext(
  tasks: Array<{
    id: string; title: string; quadrant?: number; importance?: number
    urgency?: number; status?: string; due_date?: string | null
    due_time?: string | null; category?: string | null; notes?: string | null
    subtasks?: { title: string; done: boolean }[]
  }>,
  todayCompletions: string[],
  minutesWorking?: number
): Promise<WhatNext | { error: string }> {
  const taskList = formatTaskList(tasks)
  const ctx = [
    taskList,
    todayCompletions.length > 0
      ? `\n\nCompleted today: ${todayCompletions.join(', ')}`
      : '\n\nNothing completed yet today.',
    minutesWorking != null
      ? `\n\nWorking for ~${minutesWorking} minutes so far.`
      : '',
  ].join('')

  const result = await callEdgeFn({
    transcript: ctx,
    mode: 'what-next',
  })

  if ('error' in result) return result
  return result.data as unknown as WhatNext
}

export async function getWeeklyReview(
  weekStats: {
    completed: number
    total: number
    best_day: string
    most_productive_category: string | null
    stale_tasks: { title: string; id: string; days_stale: number }[]
    completion_by_day: { day: string; count: number }[]
  }
): Promise<WeeklyReview | { error: string }> {
  const transcript = JSON.stringify(weekStats, null, 2)
  const result = await callEdgeFn({
    transcript,
    mode: 'weekly-review',
  })

  if ('error' in result) return result
  return result.data as unknown as WeeklyReview
}
