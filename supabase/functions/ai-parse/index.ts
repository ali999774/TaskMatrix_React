import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS = [
  'https://ali999774.github.io',
  'http://localhost:5173',
  'capacitor://localhost',
  'taskmatrix://localhost',
];

const ALLOWED_CATEGORIES = ['personal', 'dev', 'launch', 'clinic'];

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const apiKey = Deno.env.get('TASKMATRIX_DEEPSEEK_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured — missing API key' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { transcript, model, baseUrl, mode } = await req.json();
    const targetUrl = `${baseUrl || 'https://api.deepseek.com/v1'}/chat/completions`;
    const today = new Date().toISOString().split('T')[0];

    let systemPrompt: string;
    let responseFormat: object = { type: 'json_object' };

    if (mode === 'breakdown') {
      systemPrompt = `You are a task breakdown assistant. Given a task title (and optional notes), break it into 3-7 concrete, actionable subtasks.
Return ONLY valid JSON — no markdown, no code fences.

Format: {"subtasks": ["step 1", "step 2", ...]}

Rules:
- Each subtask should be a single action, 3-10 words
- Order them logically (dependencies first)
- Keep them concrete — "Call the dentist at 555-0123" not "Handle dental stuff"
- Include specific details from the notes when available
- 3 subtasks minimum, 7 maximum`;
    } else if (mode === 'suggest') {
      responseFormat = {}; // no json_object for suggest mode
      systemPrompt = `You are a productivity coach. Given a task list, suggest the single best task to work on right now. Reply with ONLY the task title — no explanation, no markdown, no punctuation.

Prioritize:
1. Urgent + important (high importance, high urgency, soon due)
2. Important but not urgent (high importance, low urgency)
3. Quick wins (low effort, high impact)

If nothing stands out, pick the first task. Reply with exactly one line.`;
    } else if (mode === 'classify') {
      responseFormat = {}; // plain text category, not JSON
      systemPrompt = `Classify this task into ONE category: personal, dev, launch, or clinic.
- personal: home, family, errands, health, personal admin
- dev: coding, software, development, debugging, technical
- launch: business, startup, marketing, product launch
- clinic: medical practice, patients, healthcare, clinical ops
Respond with ONLY the lowercase category name, no punctuation.`;
    } else if (mode === 'format') {
      responseFormat = {}; // plain text, not JSON
      systemPrompt = `You are a note formatter. Clean up voice-to-text transcripts into well-structured, readable notes.
Return ONLY the formatted text — no markdown fences, no explanations, no prefixes.

Rules:
- Remove filler words (um, uh, like, you know, I mean)
- Fix obvious speech-to-text errors
- Structure into clear sentences and paragraphs
- If the content is a list, use bullet points (• )
- Preserve ALL factual content — don't summarize or drop details
- Keep the speaker's voice and tone
- No markdown formatting (no **bold**, no # headers)
- Just clean, readable plain text`;
    } else {
      // parse mode (default)
      systemPrompt = `You are a task parser. Extract structured fields from voice transcripts.
Return ONLY valid JSON — no markdown, no code fences, no explanation.

Rules:
- title: the main task (required, concise, 1-8 words)
- due_date: YYYY-MM-DD if a date is mentioned. Today is ${today}. "tomorrow", "next Monday", "Friday" etc should be resolved relative to today.
- due_time: HH:MM (24h) if a specific time is mentioned
- category: infer from context. Suggest one of: Work, Personal, Health, Learning, Clinic, Dev, Finance, Errands, Home. Return null if unclear.
- importance: 1-5 (3 = normal). Higher if they say "urgent", "critical", "important", "priority". Lower if "whenever", "no rush", "low priority".
- urgency: 1-5 (3 = normal). Higher if deadline is soon or they sound pressed. Lower if no deadline mentioned.
- notes: any extra detail, context, or subtasks they mentioned. Return null if none.`;
    }

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (mode === 'suggest') {
      messages.push({ role: 'user', content: `Here is my task list:\n\n${transcript}\n\nWhat should I work on right now? Reply with exactly one task title.` });
    } else if (mode === 'format') {
      messages.push({ role: 'user', content: `Clean up this voice note transcript:\n\n${transcript}` });
    } else {
      messages.push({ role: 'user', content: transcript });
    }

    const body: Record<string, unknown> = {
      model: model || 'deepseek-v4-flash',
      messages,
      temperature: mode === 'classify' ? 0 : 0.1,
      max_tokens: mode === 'breakdown' ? 1024 : 512,
    };

    if (mode !== 'suggest' && mode !== 'format' && mode !== 'classify') {
      body.response_format = responseFormat;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      return new Response(JSON.stringify({ error: `API error: ${response.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: 'Empty response from LLM' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'suggest') {
      return new Response(JSON.stringify({ suggested: content.trim() }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
        },
      });
    }

    if (mode === 'classify') {
      const normalized = content.trim().toLowerCase().replace(/[.,!?;:]+$/, '').trim();
      const category = ALLOWED_CATEGORIES.includes(normalized) ? normalized : null;
      return new Response(JSON.stringify({ category }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
        },
      });
    }

    if (mode === 'format') {
      return new Response(JSON.stringify({ formatted: content.trim() }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
        },
      });
    }

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
      },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
