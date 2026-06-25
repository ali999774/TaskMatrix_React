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
}

async function callEdgeFn(body: Record<string, unknown>): Promise<{ data: Record<string, unknown> } | { error: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-parse', { body })

    if (error) {
      console.error('[AI] Edge function error:', error)
      return { error: error.message || 'API error' }
    }

    if (!data) return { error: 'empty response' }
    if (data.error) return { error: data.error as string }

    return { data: data as Record<string, unknown> }
  } catch (err) {
    console.error('[AI] Failed:', err)
    return { error: 'network error' }
  }
}

export async function parseVoiceTranscript(
  transcript: string,
  model: string = 'deepseek-v4-flash',
  baseUrl: string = 'https://api.deepseek.com/v1'
): Promise<{ parsed: ParsedTask } | { error: string }> {
  if (!transcript.trim()) return { error: 'empty transcript' }

  const result = await callEdgeFn({ transcript, model, baseUrl })
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
