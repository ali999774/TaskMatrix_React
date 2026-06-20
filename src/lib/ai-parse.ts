// AI-powered voice transcript → structured task parser.
// Routes through a Supabase Edge Function (server-side API key).

interface ParsedTask {
  title: string
  due_date?: string | null
  due_time?: string | null
  category?: string | null
  importance?: number
  urgency?: number
  notes?: string | null
}

export interface ParseError {
  error: string
}

const EDGE_FN = 'https://xulnxwwwjpvgsaqnsllo.supabase.co/functions/v1/ai-parse'

export async function parseVoiceTranscript(
  transcript: string,
  model: string = 'deepseek-v4-flash',
  baseUrl: string = 'https://api.deepseek.com/v1'
): Promise<{ parsed: ParsedTask } | { error: string }> {
  if (!transcript.trim()) return { error: 'empty transcript' }

  try {
    const response = await fetch(EDGE_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, model, baseUrl }),
    })

    const body = await response.text()

    if (!response.ok) {
      try {
        const errData = JSON.parse(body)
        console.error('[AI Parse] Edge function error:', response.status, errData)
        return { error: errData?.error || `API error ${response.status}` }
      } catch {
        console.error('[AI Parse] Edge function error:', response.status, body)
        return { error: `API error ${response.status}` }
      }
    }

    if (!body) {
      console.error('[AI Parse] Empty response from edge function')
      return { error: 'empty response' }
    }

    const parsed = JSON.parse(body)

    if (parsed.error) {
      console.error('[AI Parse] LLM error:', parsed.error)
      return { error: 'LLM error' }
    }

    return {
      parsed: {
        title: parsed.title?.trim() || transcript.trim().slice(0, 60),
        due_date: parsed.due_date || null,
        due_time: parsed.due_time || null,
        category: parsed.category || null,
        importance: typeof parsed.importance === 'number' ? Math.min(5, Math.max(1, parsed.importance)) : 3,
        urgency: typeof parsed.urgency === 'number' ? Math.min(5, Math.max(1, parsed.urgency)) : 3,
        notes: parsed.notes || null,
      },
    }
  } catch (err) {
    console.error('[AI Parse] Failed:', err)
    return { error: 'network error' }
  }
}
