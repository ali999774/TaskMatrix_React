// AI-powered voice transcript → structured task parser.
// Uses DeepSeek API (OpenAI-compatible) to extract task fields from
// natural language voice transcripts.

interface ParsedTask {
  title: string
  due_date?: string | null  // YYYY-MM-DD
  due_time?: string | null  // HH:MM
  category?: string | null   // matched to existing categories if possible
  importance?: number        // 1-5
  urgency?: number           // 1-5
  notes?: string | null      // any extra context not fitting the fields above
}

const SYSTEM_PROMPT = `You are a task parser. Extract structured fields from voice transcripts.
Return ONLY valid JSON — no markdown, no code fences, no explanation.

Rules:
- title: the main task (required, concise, 1-8 words)
- due_date: YYYY-MM-DD if a date is mentioned. Today is ${new Date().toISOString().split('T')[0]}. "tomorrow", "next Monday", "Friday" etc should be resolved relative to today.
- due_time: HH:MM (24h) if a specific time is mentioned
- category: infer from context. Suggest one of: Work, Personal, Health, Learning, Clinic, Dev, Finance, Errands, Home. Return null if unclear.
- importance: 1-5 (3 = normal). Higher if they say "urgent", "critical", "important", "priority". Lower if "whenever", "no rush", "low priority".
- urgency: 1-5 (3 = normal). Higher if deadline is soon or they sound pressed. Lower if no deadline mentioned.
- notes: any extra detail, context, or subtasks they mentioned. Return null if none.

Examples:
"follow up with the Smiths about the vaccination schedule next Tuesday morning" →
{"title":"Follow up with Smiths re: vaccination","due_date":"<next Tuesday's date>","due_time":"09:00","category":"Clinic","importance":3,"urgency":4,"notes":"Vaccination schedule discussion"}

"remind me to buy groceries tomorrow evening, high priority" →
{"title":"Buy groceries","due_date":"<tomorrow's date>","due_time":"18:00","category":"Personal","importance":5,"urgency":4,"notes":null}

"submit quarterly report by Friday" →
{"title":"Submit quarterly report","due_date":"<next Friday's date>","due_time":null,"category":"Work","importance":4,"urgency":3,"notes":null}`

export async function parseVoiceTranscript(
  transcript: string,
  apiKey: string,
  model: string = 'deepseek-chat',
  baseUrl: string = 'https://api.deepseek.com/v1'
): Promise<ParsedTask | null> {
  if (!transcript.trim() || !apiKey.trim()) return null

  // Update the system prompt with today's date for relative date resolution
  const today = new Date().toISOString().split('T')[0]
  const prompt = SYSTEM_PROMPT.replace(/\$\{new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]\}/g, today)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[AI Parse] API error:', response.status, err)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      console.error('[AI Parse] Empty response')
      return null
    }

    // Parse and validate
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
