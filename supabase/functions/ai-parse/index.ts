import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS = [
  'https://ali999774.github.io',
  'http://localhost:5173',
  'capacitor://localhost',
  'taskmatrix://localhost',
];

const ALLOWED_CATEGORIES = ['personal', 'dev', 'launch', 'clinic'];

interface TaskRecord {
  id: string;
  title: string;
  quadrant: number;
  importance: number;
  urgency: number;
  status: string;
  due_date: string | null;
  due_time: string | null;
  category: string | null;
  notes: string | null;
  estimated_duration: number | null;
  pinned: boolean;
  subtasks: { title: string; done: boolean }[];
}

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

  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
  };

  try {
    const apiKey = Deno.env.get('TASKMATRIX_DEEPSEEK_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured — missing API key' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await req.json();
    const { transcript, model, baseUrl, mode } = body;
    const targetUrl = `${baseUrl || 'https://api.deepseek.com/v1'}/chat/completions`;
    const today = new Date().toISOString().split('T')[0];

    let systemPrompt: string;
    let responseFormat: object = { type: 'json_object' };
    let maxTokens = 512;

    // ── MODE ROUTING ──────────────────────────────────────────────

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
      maxTokens = 1024;

    } else if (mode === 'suggest') {
      responseFormat = {};
      systemPrompt = `You are a productivity coach. Given a task list, suggest the single best task to work on right now. Reply with ONLY the task title — no explanation, no markdown, no punctuation.

Prioritize:
1. Urgent + important (high importance, high urgency, soon due)
2. Important but not urgent (high importance, low urgency)
3. Quick wins (low effort, high impact)

If nothing stands out, pick the first task. Reply with exactly one line.`;

    } else if (mode === 'classify') {
      responseFormat = {};
      systemPrompt = `Classify this task into ONE category: personal, dev, launch, or clinic.
- personal: home, family, errands, health, personal admin
- dev: coding, software, development, debugging, technical
- launch: business, startup, marketing, product launch
- clinic: medical practice, patients, healthcare, clinical ops
Respond with ONLY the lowercase category name, no punctuation.`;

    } else if (mode === 'format') {
      responseFormat = {};
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

    // ── NEW: MORNING BRIEF ───────────────────────────────────────
    } else if (mode === 'morning-brief') {
      maxTokens = 1024;
      systemPrompt = `You are a supportive daily planning assistant. Given the user's active tasks, produce a brief morning orientation.

Today is ${today}.

Return ONLY valid JSON — no markdown, no code fences:

{
  "greeting": "short warm greeting (1 sentence)",
  "summary": "2-3 sentence overview of the day ahead: how many due today, any overdue, what's looking good",
  "overdue": [{"title": "task title", "id": "task-id", "days": number}],
  "due_today": [{"title": "task title", "id": "task-id"}],
  "focus_areas": ["1-3 themes for the day based on task clusters"],
  "momentum": "1 sentence about recent progress — positive and encouraging",
  "tip": "1 brief productivity tip relevant to their current load"
}

Rules:
- overdue: only tasks with due_date before today. Include days overdue.
- due_today: tasks due today OR created yesterday and still active
- focus_areas: group tasks thematically (e.g. "admin catch-up", "patient follow-ups")
- momentum: acknowledge recent completions if provided. Be encouraging, not mechanical.
- tip: make it practical and specific to their task mix. Not generic.
- If there are no tasks at all, make the greeting welcoming and suggest capturing the first thing on their mind.`;

    // ── NEW: DAY PLAN ────────────────────────────────────────────
    } else if (mode === 'day-plan') {
      maxTokens = 1536;
      systemPrompt = `You are a strategic day planner. Given the user's active tasks, produce a sequenced action plan.

Today is ${today}.

Return ONLY valid JSON — no markdown, no code fences:

{
  "plan": [
    {
      "id": "task-id",
      "title": "task title",
      "rationale": "why this order — 1 sentence max",
      "suggested_duration": "e.g. 20 min, 45 min, 2h",
      "batch_hint": "optional: what other tasks to group with this one"
    }
  ],
  "pacing": "1 sentence about how to pace the day",
  "total_estimated": "total time estimate, e.g. ~3.5h",
  "energy_tip": "when to tackle the hardest thing vs when to coast"
}

Rules:
- Order by: overdue first → due today → important non-urgent → quick wins
- rationale: be specific about WHY this order. Not "it's important" but "this is blocking the patient follow-up calls scheduled for 2pm"
- batch_hint: group similar tasks (calls together, admin together, clinical together)
- Only include active tasks (status is todo or in_progress, not completed/archived)
- 5-12 tasks in the plan. Quality over quantity.
- If 0 tasks: return empty plan array with a gentle nudge to capture something.`;

    // ── NEW: WHAT-NEXT V2 ────────────────────────────────────────
    } else if (mode === 'what-next') {
      responseFormat = {};
      systemPrompt = `You are a mid-session productivity coach. Given the full task list plus what's been completed today, suggest the single best next task.

Return ONLY valid JSON — no markdown, no code fences:

{"title": "task title", "id": "task-id", "why": "1 sentence rationale", "break_suggestion": "optional: suggest a break if they've been grinding"}

Rules:
- Consider what's been DONE today — skip tasks in the same category if they've been doing it for a while
- Prioritize overdue > due today > important > quick wins
- If they just completed a heavy task, suggest something lighter
- If they've been working for 90+ minutes straight, suggest a pomodoro break
- Don't suggest a task already completed today
- If no tasks: say so honestly with a suggestion to capture something new.`;

    // ── NEW: WEEKLY REVIEW ───────────────────────────────────────
    } else if (mode === 'weekly-review') {
      maxTokens = 1536;
      systemPrompt = `You are a thoughtful weekly review coach. Given a week of task stats, produce insights and gentle guidance.

Return ONLY valid JSON — no markdown, no code fences:

{
  "summary": "2-3 sentence overview of the week",
  "stats": {
    "completed": number,
    "completion_rate": number,
    "best_day": "e.g. Wednesday",
    "most_productive_category": "category name or null"
  },
  "wins": ["1-3 specific things the user should feel good about"],
  "patterns": ["1-2 patterns you notice — e.g. 'admin tasks tend to pile up in Delegated'"],
  "suggestions": ["1-2 actionable suggestions for next week"],
  "stale_tasks": [{"title": "task title", "id": "task-id", "days_stale": number}],
  "mood": "encouraging 1-sentence closer"
}

Rules:
- wins: celebrate progress, not just raw numbers. "Closed 12 tasks" is fine, "Cleared Do First by Wednesday" is better
- patterns: be observant but not critical. Frame as observation, not failure
- suggestions: concrete and specific to their data. Not generic productivity advice
- stale_tasks: tasks untouched for 5+ days, especially in active quadrants
- mood: warm closing. They showed up and did work — honor that.`;

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

    // ── BUILD MESSAGES ───────────────────────────────────────────

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

    const llmBody: Record<string, unknown> = {
      model: model || 'deepseek-v4-flash',
      messages,
      temperature: (mode === 'classify' || mode === 'what-next') ? 0 : 0.1,
      max_tokens: maxTokens,
    };

    const wantsJson = mode !== 'suggest' && mode !== 'format' && mode !== 'classify' && mode !== 'what-next';
    if (wantsJson) {
      llmBody.response_format = responseFormat;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(llmBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      return new Response(JSON.stringify({ error: `API error: ${response.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: 'Empty response from LLM' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── RESPONSE HANDLERS ────────────────────────────────────────

    if (mode === 'suggest') {
      return new Response(JSON.stringify({ suggested: content.trim() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (mode === 'classify') {
      const normalized = content.trim().toLowerCase().replace(/[.,!?;:]+$/, '').trim();
      const category = ALLOWED_CATEGORIES.includes(normalized) ? normalized : null;
      return new Response(JSON.stringify({ category }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (mode === 'format') {
      return new Response(JSON.stringify({ formatted: content.trim() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // New modes — parse JSON and return
    if (mode === 'morning-brief') {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON from model', raw: content }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (mode === 'day-plan') {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON from model', raw: content }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (mode === 'what-next') {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch {
        // Fallback: treat as plain text suggestion
        return new Response(JSON.stringify({ title: content.trim(), id: null, why: null, break_suggestion: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (mode === 'weekly-review') {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON from model', raw: content }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // default: parse mode — return raw JSON content
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
