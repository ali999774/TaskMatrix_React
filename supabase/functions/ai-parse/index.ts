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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version, prefer',
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
    const body = await req.json();
    const { transcript, model, baseUrl, mode, briefOutput } = body;
    const targetUrl = `${baseUrl || 'https://api.deepseek.com/v1'}/chat/completions`;

    // ── KEY SELECTION ───────────────────────────────────────────
    const isOpenAI = targetUrl.includes('api.openai.com');
    const secretName = isOpenAI ? 'TASKMATRIX_OPENAI_API_KEY' : 'TASKMATRIX_DEEPSEEK_API_KEY';
    const apiKey = Deno.env.get(secretName);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: `AI not configured — missing ${secretName}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
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
      systemPrompt = `You are a productivity coach. Given a task list, suggest the single best task to work on right now.

Return ONLY valid JSON — no markdown, no code fences:

{"id": "task-id", "suggested": "task title"}

Rules:
- id MUST be one of the task IDs from the provided list, copied exactly — never invent one
- suggested is that task's title, for display

Prioritize:
1. Urgent + important (high importance, high urgency, soon due)
2. Important but not urgent (high importance, low urgency)
3. Quick wins (low effort, high impact)

If nothing stands out, pick the first task.`;

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

    // ── MORNING BRIEF ────────────────────────────────────────────
    } else if (mode === 'morning-brief' || mode === 'morningbrief') {
      maxTokens = 1024;
      const userGoal = body.userGoal || '';
      systemPrompt = `You are the morning brief generator for a personal productivity app. You receive
the user's task list with priorities, due dates, and categories, and you produce a
short, scannable brief that orients them for the day.

You MUST return a single valid JSON object and nothing else — no preamble, no
markdown fences, no commentary. The JSON object has this exact shape:

{
  "title": "string — a short framing headline for the whole day (3-6 words)",
  "date_label": "string — human-readable date, e.g. 'Tuesday, June 30'",
  "cards": [
    {
      "headline": "string — the task or theme, kept short (2-6 words)",
      "support": "string — one sentence explaining why it matters or what to do",
      "kind": "one of: priority | protect | batch | quickwin | admin"
    }
  ]
}

RULES FOR THE CARDS:
- Produce 2-4 cards. This is a brief, not the full task list — surface only what
  deserves the user's attention first.
- The FIRST card is always the single most important thing today (kind: "priority").
  If a task is both urgent and important, it leads.
- Use "protect" for something important but not urgent that will slip if a block
  isn't defended for it.
- Use "batch" when several small tasks can be combined into one trip or session —
  name the items in the support line.
- Use "quickwin" for a fast, momentum-building task worth doing early.
- Use "admin" for routine obligations (payments, calls) that need to happen but
  aren't the day's focus.

RULES FOR THE SUPPORT LINE:
- One sentence. Concrete. Tell the user why this matters or what the move is.
- Do not restate the headline. The support line adds information, it doesn't echo.
- No filler ("Don't forget to..."). Lead with the substance.

TONE: Direct, calm, competent. You are orienting a capable person, not managing them.

USER CONTEXT (user-provided; may be empty):
${userGoal || '(empty — judge by conventional signals only)'}

EXAMPLES:

INPUT (tasks): ECHO Autism case presentation [urgent, important, due today];
MHMD outreach email [important, not urgent]; buy fertilizer, tomatoes, mangoes,
milk [errands]
OUTPUT:
{
  "title": "Focus on high-impact tasks",
  "date_label": "Tuesday, June 30",
  "cards": [
    {
      "headline": "ECHO Autism case presentation",
      "support": "Urgent + important — your top block today.",
      "kind": "priority"
    },
    {
      "headline": "MHMD communication",
      "support": "Important, not urgent — protect a block before it slips.",
      "kind": "protect"
    },
    {
      "headline": "4 errands → one trip",
      "support": "Fertilizer, tomatoes, mangoes, milk — same store run.",
      "kind": "batch"
    }
  ]
}

INPUT (tasks): finish resident evaluation [due today]; cable TV payment [due
tomorrow]; call doctor's office [due tomorrow]
OUTPUT:
{
  "title": "Clear the deck",
  "date_label": "Wednesday, July 1",
  "cards": [
    {
      "headline": "Resident evaluation",
      "support": "Due today — finish it before the day fills up.",
      "kind": "priority"
    },
    {
      "headline": "Two quick calls",
      "support": "Cable payment and the doctor's office — both five-minute tasks.",
      "kind": "admin"
    }
  ]
}`;

    // ── DAY PLAN ────────────────────────────────────────────────
    } else if (mode === 'day-plan' || mode === 'dayplan') {
      maxTokens = 1536;
      const briefContext = briefOutput
        ? `\nBRIEF CONCLUSION (the priority call already made — honor it):\n${briefOutput}\nThe most consequential task identified in the brief MUST get a protected, well-placed block. Do not bury it beneath low-stakes tasks just because they are older or overdue.\n`
        : '';

      systemPrompt = `You are the day-sequencing intelligence inside TaskMatrix. The user has already received a morning brief that identified their priorities. Your job is to turn today's tasks into an ORDERED execution sequence that respects that triage — not to re-rank from scratch.
${briefContext}
INPUT: today's tasks with title, due/overdue status, category.

SEQUENCING PRINCIPLES (in priority order):
1. SIGNIFICANCE OVER AGE. An overdue errand does not outrank a significant task due soon. Do not front-load the sequence with trivial overdue items. This is the most common sequencing mistake — avoid it.
2. PROTECT ONE DEEP BLOCK. The single most important task gets a focused block placed when energy is typically highest (mid-morning unless context says otherwise). Guard it from fragmentation.
3. BATCH THE TRIVIAL. Group errands, calls, and quick personal tasks into single batched slots ("one shopping trip," "a batch of quick calls"). Do not give each trivial task its own numbered step with its own rationale.
4. MOMENTUM, BRIEFLY. You may open with ONE genuine quick win to build momentum, but only one, and only if it's real. Do not pad the front of the day with busywork disguised as a warm-up.

HARD RULES:
- Only estimate durations where the estimate informs a real decision (e.g. "block ~2h"). Do not assign invented minute-counts to every item. Never estimate non-tasks.
- Silently drop items that are not real tasks (e.g. "leave computer on"). Do not feature, estimate, or sequence them.
- Each step's rationale must say something specific to THAT task's place in the day, not a generic label. "Group with other calls" is acceptable only if there are other calls.
- The full plan should be scannable in under 30 seconds. Prefer fewer, meaningful steps over an exhaustive list. Batched items count as one step.

TONE: A sharp chief of staff laying out the day. Decisive, brief, respects the user's time and intelligence.

Return ONLY valid JSON — no markdown, no code fences:

{
  "plan": [
    {
      "id": "task-id",
      "title": "task title",
      "rationale": "why this order — specific to this task's place in the day",
      "suggested_duration": "only when it informs a real decision, e.g. 'block ~2h'",
      "batch_hint": "optional: group with other similar tasks"
    }
  ],
  "pacing": "1 sentence about how to pace the day",
  "total_estimated": "total time estimate, e.g. ~3.5h",
  "energy_tip": "one specific, lightly wry observation about today's actual shape"
}`;

    // ── NEW: WHAT-NEXT V2 ────────────────────────────────────────
    } else if (mode === 'what-next' || mode === 'whatnext') {
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
- lead_days: integer number of days BEFORE the due date the user wants to start seeing / be reminded of this task. Extract ONLY when explicitly stated, e.g. "remind me three days before" → 3, "a week ahead" → 7, "the day before" → 1. Do NOT infer or guess a lead time from the task's content or type. If the user says nothing about lead/advance notice, return null. Never default to 0.
- notes: any extra detail, context, or subtasks they mentioned. Return null if none.`;
    }

    // ── BUILD MESSAGES ───────────────────────────────────────────

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (mode === 'suggest') {
      messages.push({ role: 'user', content: `Here is my task list:\n\n${transcript}\n\nWhat should I work on right now?` });
    } else if (mode === 'format') {
      messages.push({ role: 'user', content: `Clean up this voice note transcript:\n\n${transcript}` });
    } else {
      messages.push({ role: 'user', content: transcript });
    }

    const llmBody: Record<string, unknown> = {
      model: model || 'deepseek-v4-flash',
      messages,
      temperature: (mode === 'classify' || mode === 'what-next' || mode === 'whatnext' || mode === 'suggest') ? 0 : 0.1,
      max_tokens: maxTokens,
    };

    const wantsJson = mode !== 'format' && mode !== 'classify' && mode !== 'what-next';
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
      console.error(`${isOpenAI ? 'OpenAI' : 'DeepSeek'} API error:`, response.status, errText);
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
      try {
        const parsed = JSON.parse(content);
        const suggested = typeof parsed.suggested === 'string' ? parsed.suggested : 'No suggestion';
        const id = typeof parsed.id === 'string' ? parsed.id : null;
        return new Response(JSON.stringify({ suggested, id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch {
        // Fallback: treat as plain text suggestion with no resolvable task id
        return new Response(JSON.stringify({ suggested: content.trim(), id: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
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
    if (mode === 'morning-brief' || mode === 'morningbrief') {
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

    if (mode === 'day-plan' || mode === 'dayplan') {
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

    if (mode === 'what-next' || mode === 'whatnext') {
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
