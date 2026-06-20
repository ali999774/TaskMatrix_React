// AI-powered voice transcript → structured task parser.
// Routes through a Supabase Edge Function to avoid CORS issues with
// calling LLM APIs directly from the browser.

interface ParsedTask {
  title: string
  due_date?: string | null
  due_time?: string | null
  category?: string | null
  importance?: number
  urgency?: number
  notes?: string | null
}

const EDGE_FN = 'https://xulnxwwwjpvgsaqnsllo.supabase.co/functions/v1/ai-parse'

export async function parseVoiceTranscript(
  transcript: string,
  apiKey: string,
  model: string = 'deepseek-chat',
  baseUrl: string = 'https://api.deepseek.com/v1'
): Promise<ParsedTask | null> {
  if (!transcript.trim() || !apiKey.trim()) return null

  try {
    const response = await fetch(EDGE_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, apiKey, model, baseUrl }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[AI Parse] Edge function error:', response.status, err)
      return null
    }

    const content = await response.text()
    if (!content) {
      console.error('[AI Parse] Empty response from edge function')
      return null
    }

    // Edge function returns the raw JSON from the LLM
    const parsed = JSON.parse(content)

    return {
      title: parsed.title?.trim() || transcript.trim().slice(0, 60),
      due_date: parsed.due_date || null,
      due_time: parsed.due_time || null,
      category: parsed.category || null,
      importance: typeof parsed.importance === 'number' ? Math.min(5, Math.max(1, parsed.importance)) : 3,
      urgency: typeof parsed.urgency === 'number' ? Math.min(5, Math.max(1, parsed.urgency)) : 3,
      notes: parsed.notes || null,
    }
  } catch (err) {
    console.error('[AI Parse] Failed:', err)
    return null
  }
}
