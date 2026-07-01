# TaskMatrix — iOS App Store Submission Prep

Prepared 2026-07-01. Three deliverables: listing copy, guideline compliance pass,
and a privacy-label worksheet. Compliance findings are grounded in this repo's
actual code (edge functions, migrations, Info.plist), not just the app description —
several things the code does are more consequential than the brief suggested.

**The one-paragraph summary:** two hard blockers (no Sign in with Apple, no in-app
account deletion), one mechanical blocker (no privacy manifest file), and one issue
that is both an Apple disclosure requirement and the app's biggest real-world risk:
voice transcripts, task titles/notes, and Google Calendar event context are sent to
**DeepSeek by default** (OpenAI as fallback) via the `ai-parse` edge function. The
health-content angle Apple-side is low risk; the HIPAA angle is real but attaches to
the AI/Supabase data flows, not to App Review.

---

## Deliverable 1 — Listing copy

### App name (30-char limit)

| Option | Chars | Notes |
|---|---|---|
| `TaskMatrix: Priority Planner` | 28 | Recommended. "priority" + "planner" are indexed from the name (highest ASO weight). |
| `TaskMatrix — Eisenhower To-Do` | 29 | Puts the method term in the highest-weight field; "eisenhower" has low volume but very high intent. |
| `TaskMatrix: Do What Matters` | 27 | Benefit-led, weakest for search. |

### Subtitle (30-char limit)

| Option | Chars | Pairs with |
|---|---|---|
| `Eisenhower matrix to-do list` | 28 | Name option 1 (no keyword overlap) |
| `Urgent vs. important, sorted` | 28 | Name option 2 |
| `Prioritize. Focus. Finish.` | 26 | Either; weakest for search |

Recommended pairing: **name 1 + subtitle 1**. Together they index
`taskmatrix, priority, planner, eisenhower, matrix, to-do, list` — which frees the
keyword field entirely for other terms.

### Full description (~170 words, benefit-led)

> Some tasks are urgent. Some are important. The ones that matter most are both —
> and a flat to-do list can't tell the difference.
>
> TaskMatrix sorts your day on the classic Eisenhower matrix: four quadrants that
> show you, at a glance, what to do now, what to schedule, what to hand off, and
> what to let go. Speak a task out loud and it lands in the right quadrant with a
> due date already set. Jot passing thoughts on sticky notes before they slip away.
> When it's time to work, the built-in Pomodoro timer keeps you on one thing at a
> time.
>
> Everything syncs across your devices and works offline — capture on the train,
> and it's waiting at your desk.
>
> - Four-quadrant priority matrix
> - Voice capture that turns speech into scheduled tasks
> - Sticky notes for fast, unstructured capture
> - Pomodoro focus timer
> - Reminders, recurring tasks, and daily planning
> - Offline-first sync
>
> Stop reordering an endless list. Decide once what matters, and TaskMatrix keeps
> it in front of you.

(~170 words. Deliberately no clinical/medical framing — see compliance flag C4.)

### Keyword field (100-char limit)

Assuming the recommended name + subtitle pairing (never repeat words already in
name/subtitle — Apple indexes all three fields together and duplicates waste space):

```
urgent,important,pomodoro,focus,timer,productivity,organizer,daily,voice,notes,reminder,quadrant
```

96 characters. Rationale:

- **What comparable apps rank on:** direct Eisenhower-method competitors (Focus
  Matrix, Priority Matrix by Appfluence, "Eisenhower Matrix: Todo & Task", 4.Do)
  cluster around *task manager, to-do list, priority matrix, urgent-important,
  time management*. The generic head terms (`todo`, `task`) are unwinnable for a
  new solo app; the method terms (`eisenhower`, `quadrant`, `urgent`, `important`)
  are low-volume but high-intent and realistically rankable.
- **Deliberately excluded:** competitor brand names (Todoist, Things, TickTick,
  Trello) — Apple rejects metadata with third-party trademarks (Guideline 2.3.7),
  and **`gtd`** — "Getting Things Done" and "GTD" are registered trademarks of the
  David Allen Company; not worth the metadata-rejection risk for 3 characters.
- **Judgment call — `adhd`:** high-volume term that Eisenhower-style apps do rank
  for. Using it as a keyword only (no claims in copy) is common practice and
  generally survives review, but it edges the app toward health-condition
  targeting. Omitted from the default string; swap `quadrant` (8 chars) for
  `adhd` (4) + `plan` (4) if you want to test it.
- No spaces after commas; singular/plural are matched automatically.

### Promotional text (170-char limit, updatable without a new build)

> Your to-do list shouldn't be a flat list. TaskMatrix sorts every task by urgent
> and important, so the right thing is always on top. Speak it, sort it, done.

(157 chars.) Alternate for a later update once AI features are consented/shipped:

> New: a morning brief that plans your day. TaskMatrix reads your matrix and your
> calendar, then tells you what to tackle first. Prioritize less, finish more.

(156 chars.)

---

## Deliverable 2 — Guideline compliance pass

Ordered by severity. "Hard blocker" = App Review rejects on sight or App Store
Connect refuses the binary; "judgment call" = depends on reviewer or on how you
frame it.

### C1. No Sign in with Apple — Guideline 4.8 (Login Services) — HARD BLOCKER

The app's only sign-in is Google OAuth via Supabase (`App.tsx:161-183`,
`signInWithOAuth({ provider: 'google' })`). Guideline 4.8 requires that apps using
a third-party login service to authenticate the user's primary account **also**
offer a login option that limits data collection to name and email, lets users hide
their email, and doesn't collect interaction data for advertising. None of the 4.8
exemptions apply (this is not an education/enterprise app, not a client for a
specific third-party service, and Supabase-with-Google is not "your own account
system").

**Actual risk:** this is one of the most mechanically enforced rules in review —
reviewers see a Google button with no alternative and reject. Not a judgment call.

**Fix:** Supabase Auth supports `provider: 'apple'` natively; on iOS you can use the
native `SignInWithApple` capability plugin or the same OAuth redirect flow already
built for Google (`taskmatrix://auth/callback` deep-link handling in
`App.tsx:202-257` is provider-agnostic). Budget for one wrinkle: Apple only returns
the user's name/email on *first* authorization, so store it on first sign-in.

### C2. No in-app account deletion — Guideline 5.1.1(v) — HARD BLOCKER

The app supports account creation (first Google sign-in creates a Supabase user)
but the only account control in the UI is sign-out (`App.tsx:186-188`). Since June
2022, apps that support account creation must let users **initiate account deletion
inside the app**, and the deletion must remove the account record and associated
data — not just deactivate it.

**Actual risk:** enforced consistently; reviewers create an account, look in
settings for deletion, and reject if absent.

**Fix (all pieces needed):**
1. A "Delete account" action in `SettingsModal` with confirmation.
2. A Supabase edge function using the service-role key to call
   `auth.admin.deleteUser(uid)` (clients can't delete their own auth user).
3. Verify cascade behavior: `device_tokens` has `ON DELETE CASCADE` to
   `auth.users` (migration `20260621_device_tokens.sql`), but **check whether
   `tasks`, `sticky_notes`, and `user_settings` foreign-key to `auth.users` with
   CASCADE** — the migrations in this repo only show RLS policies, not the original
   table DDL. If they don't cascade, the edge function must delete those rows
   explicitly or you're deleting the login while orphaning the (potentially
   sensitive) content — which fails both the guideline and your own privacy policy.
4. Revoke the Google Calendar token on deletion (the disconnect path in
   `src/lib/gcal.ts:111-115` already does the revoke call — reuse it).

### C3. Third-party AI data sharing — Guideline 5.1.2(i) — HARD REQUIREMENT, and the app's biggest real risk

What the code actually does (`supabase/functions/ai-parse/index.ts`,
`src/lib/ai-parse.ts`): voice transcripts, task titles, notes, subtasks, and —
for the morning brief / day plan — **Google Calendar event titles and times**
(`calendarContext`, `ai-parse.ts:259-264`) are sent to **`api.deepseek.com` by
default**, or OpenAI if configured. The client can even pass an arbitrary
`baseUrl`.

Guideline 5.1.2(i) now explicitly requires that you "clearly disclose where personal
data is shared with third parties, **including third-party AI**, and obtain explicit
permission before sharing." So before submission you need: (a) an in-app consent
moment before the first AI feature use (not buried in a policy), (b) privacy-policy
disclosure naming the AI processing, and (c) the privacy label reflecting it (see
Deliverable 3).

**Beyond Apple — this is where the HIPAA concern actually lives.** The brief flags
that free-text fields could contain clinical content. The code makes this concrete:
`ALLOWED_CATEGORIES` includes `'clinic'`, the bundle ID is
`com.milestonepediatrics.taskmatrix`, and the near-term users are physicians. If a
colleague dictates "call back the mother of the 6yo with the abnormal CBC," that
transcript goes to DeepSeek — a PRC-based processor with no BAA available and API
data-retention terms you don't control. No privacy-policy wording fixes that flow.
Concrete mitigations, in order of effectiveness:
1. Drop DeepSeek as the default before distributing to colleagues. OpenAI offers
   zero-retention API options and will execute a BAA for the API; DeepSeek offers
   neither.
2. Make every AI feature opt-in (off by default) with a plain-language notice that
   content leaves the device — this simultaneously satisfies 5.1.2(i).
3. If colleagues will realistically use it for clinical workflow (the `clinic`
   category invites exactly that), the sync backend needs a BAA too: Supabase signs
   BAAs only on the Team plan with the HIPAA add-on — not on Free/Pro. Decide
   whether this app is "no PHI, and designed so that's plausible" or "PHI-capable,
   with a compliant stack." The current design is neither, and that's the gap.

Also note: sending Google Calendar data (a Google **sensitive scope**,
`calendar.events.readonly`) onward to another third party is restricted by Google's
API Services User Data Policy (Limited Use), independent of Apple. When the OAuth
consent screen goes through Google verification for external users, this transfer
must be disclosed and may not be permitted at all. Excluding calendar context from
AI payloads is the clean fix.

### C4. Health/medical-adjacent content — Guidelines 5.1.3 and 1.4.1 — LOW RISK Apple-side

Guideline 5.1.3's obligations attach to specific data sources: HealthKit, Clinical
Health Records API, Motion & Fitness, MovementDisorder APIs, and health-research
studies. TaskMatrix uses none of them. Free-text fields that *could* contain
clinical content do not trigger 5.1.3, and Guideline 1.4.1 (medical apps, greater
scrutiny, measurement claims) applies to apps that *claim* diagnostic/medical
function — TaskMatrix claims none.

**Verdict: no disclosure to Apple required for this; don't create the problem in
metadata.** Keep the listing copy free of clinical positioning (the description
above is), don't screenshot the `clinic` category prominently, and this stays a
non-issue in review. The genuine health-data risk is the C3 data-flow issue, not an
App Review issue.

One cosmetic note: if the developer account is enrolled as an organization named
after the pediatrics practice, the seller name frames the app as coming from a
medical practice. Not a guideline problem; just be aware it's the public seller
line under the app name.

### C5. Privacy manifest missing — HARD BLOCKER at upload (mechanical, easy)

There is no `PrivacyInfo.xcprivacy` anywhere under `ios/` (verified). Since
May 1, 2024, App Store Connect refuses binaries whose required-reason API usage
isn't declared, and since February 12, 2025, commonly-used third-party SDKs must
ship their own manifests. What this app needs:

- An app-level `ios/App/App/PrivacyInfo.xcprivacy` declaring:
  - `NSPrivacyCollectedDataTypes` mirroring the privacy label (Deliverable 3);
  - `NSPrivacyAccessedAPITypes` — at minimum `UserDefaults` (reason `CA92.1`;
    Capacitor Preferences and the Supabase session storage touch it) and file
    timestamp APIs (`C617.1`) which WebView/Capacitor file access hits;
  - `NSPrivacyTracking = false`, empty tracking-domains array.
- Capacitor 6+ plugins ship their own manifests inside their pods, and
  `supabase-js` is pure JS (no native manifest needed), so the SDK side should be
  covered — but confirm at archive time with Xcode's privacy report
  (Product → Archive → Generate Privacy Report), which aggregates all manifests and
  shows gaps before Apple does.

### C6. `NSAllowsArbitraryLoads = true` — JUDGMENT CALL, remove it anyway

`Info.plist` sets a blanket ATS exception. Every real endpoint this app talks to is
HTTPS (Supabase, Google, DeepSeek/OpenAI via edge function, APNs). App Review asks
for justification of arbitrary-loads exceptions and this one has none — it's also a
genuine transport-security downgrade for an app that may carry sensitive text. Not
an automatic rejection, but a needless review question with an empty answer. Delete
the key (Capacitor does not require it in production; it's a common leftover from
live-reload dev config).

### C7. Review logistics — Guideline 2.1 — easy to miss with OAuth-only login

App Review needs working demo credentials. With Google-OAuth-only sign-in you
can't hand Apple a Google account password (and doing so violates Google ToS).
Once Sign in with Apple is added (C1), the reviewer can use their own Apple ID —
this mostly solves itself — but fill in the review notes explaining sign-in, and
make sure the app is usable enough to evaluate without a populated account.

### C8. Low-risk items — checked, fine, move on

- **4.2 minimum functionality (web-wrapper scrutiny):** Capacitor apps get looked
  at, but TaskMatrix uses push, haptics, local notifications, speech recognition,
  deep links, and offline storage — comfortably past "repackaged website." Low risk.
- **Push notifications (4.5.4):** used for task reminders, not marketing; nothing
  in the code requires enabling push to use the app. Compliant as-is.
- **Social-credential handling (5.1.1):** Google Calendar disconnect exists in
  Settings with server-side token revocation (`gcal.ts:108-116`). Compliant. Note
  5.1.1's rule that social-network tokens may not be stored off-device — the
  Calendar access token appears to be held client-side only (GIS token client);
  verify Supabase isn't persisting the Google `provider_token` server-side beyond
  the session.
- **TestFlight aside:** for the actual near-term plan (3–5 colleagues), internal
  TestFlight distribution needs none of the above fixed (no Beta App Review for
  internal testers, up to 100). That buys time to fix C1–C3 properly before a real
  App Store submission — but C3's data-flow problem exists the moment a colleague
  dictates a patient-adjacent task, TestFlight or not.

---

## Deliverable 3 — Privacy Nutrition Label worksheet

Basis: Supabase schema in `supabase/migrations/` (tables: `tasks`, `sticky_notes`,
`user_settings`, `device_tokens`), auth via Google OAuth, `ai-parse` and
`push-send` edge functions, no analytics/crash SDK found anywhere in `src/`
(verified by search). Apple's definition of "collected": transmitted off-device and
retained longer than needed to service the request.

**Top-level answers:** Data IS collected. Everything collected is **Linked to You**
(all rows are keyed to `user_id` / the account email). **Nothing is used for
Tracking** (no ads, no data brokers, no cross-app identifiers — declare
`NSPrivacyTracking = false`).

| # | Apple data type | What it actually is | Linked? | Tracking? | Purpose | Certainty |
|---|---|---|---|---|---|---|
| 1 | Contact Info → **Email Address** | Google account email in `auth.users` | Yes | No | App Functionality | **Certain** |
| 2 | Contact Info → **Name** | Google OAuth returns `full_name`/`name` into `auth.users.raw_user_meta_data` by default | Yes | No | App Functionality | **Inferred — verify**: query `auth.users.raw_user_meta_data` for an existing user. If name is present, declare it even if the UI never shows it. |
| 3 | Identifiers → **User ID** | Supabase UUID keying every table | Yes | No | App Functionality | **Certain** |
| 4 | Identifiers → **Device ID** | APNs push token stored server-side in `device_tokens` | Yes | No | App Functionality | **Judgment call**: a push token is a device-scoped identifier stored on your server; the conservative (recommended) reading declares Device ID. Some apps don't. Declaring costs nothing. |
| 5 | User Content → **Other User Content** | Task titles/notes/subtasks, sticky notes, voice **transcripts**, reminder times; synced to Supabase and (for AI features) sent to DeepSeek/OpenAI | Yes | No | App Functionality | **Certain**. The third-party-AI transfer doesn't change the label fields (there's no "shared" axis), but it must appear in the privacy policy per 5.1.2(i), and the in-app consent from C3 must exist. |
| 6 | User Content → **Audio Data** | — | — | — | — | **Do NOT declare — with reasoning:** raw microphone audio is handled by iOS's speech-recognition service (`@capgo/capacitor-speech-recognition` → `SFSpeechRecognizer`); Apple may process audio on its servers, but *you* never receive or store audio — only the transcript, covered by row 5. If you ever ship audio to your own backend, this changes. |
| 7 | **Other Data** | Google Calendar event titles/times, currently forwarded to the AI provider as `calendarContext` | Yes | No | App Functionality | **Depends on C3 outcome**: if calendar context stays in AI payloads, the ephemeral-processing exemption is hard to claim (DeepSeek's retention isn't under your control) — declare Other Data. If you strip calendar data from AI calls (recommended; see C3's Google Limited Use note), calendar events never leave the device except direct Google→client fetches, and nothing needs declaring. |
| 8 | Usage Data / Diagnostics | — | — | — | — | **None — certain as of this code review.** No analytics or crash-reporting SDK exists in the project. Apple's own opt-in crash reports don't count as your collection. If you add Sentry/PostHog later, the label must be updated first. |
| 9 | Health & Fitness | — | — | — | — | **Do NOT declare — with reasoning:** the label describes data types the app collects *by design*. TaskMatrix solicits generic tasks/notes; the possibility that a user types clinical content into a free-text field does not make it Health data under Apple's taxonomy (that's row 5), same as Notes or Mail. Declaring Health here would be inaccurate and would invite 5.1.3 scrutiny that doesn't apply. |

**Before submitting, verify against the live project** (the migrations in-repo are
partial — they reference `tasks`/`user_settings` columns whose original DDL isn't
in this repo):

1. `auth.users.raw_user_meta_data` contents for a real user (name? `avatar_url`? —
   if Google's avatar URL is stored, it's technically a collected photo URL; nobody
   reasonably declares "Photos" for an unused OAuth avatar URL, but know it's there
   and consider stripping it).
2. Whether `tasks` / `sticky_notes` / `user_settings` FK to `auth.users` with
   `ON DELETE CASCADE` (matters for C2's deletion completeness).
3. Whether Supabase is configured to persist Google `provider_token` /
   `provider_refresh_token` server-side (Settings → Auth). If yes, that's a stored
   social credential — see C8 and consider disabling.
4. Supabase's own infrastructure logs (request IPs, auth logs) exist on any hosted
   backend; Apple's label convention treats standard server logs as out of scope
   unless used beyond operations. No action, just noted.

---

## Suggested order of operations

1. Ship C5 (privacy manifest) and C6 (drop ATS exception) — under an hour combined.
2. Build C1 (Sign in with Apple) and C2 (account deletion edge function + UI) —
   these are the two review-blocking features.
3. Decide the C3 posture (AI default provider, opt-in consent, calendar exclusion)
   **before** TestFlighting to colleagues, not before App Store submission — the
   data flow is the risk, not the review.
4. Then metadata (Deliverable 1), privacy label (Deliverable 3), privacy policy
   URL, and submit.

## Sources

- [App Review Guidelines — Apple Developer](https://developer.apple.com/app-store/review/guidelines/) (sections 1.4.1, 2.3.7, 4.2, 4.8, 5.1.1, 5.1.2, 5.1.3)
- [Privacy manifest files — Apple Developer Documentation](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Adding a privacy manifest to your app or third-party SDK — Apple Developer](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk)
- [Updated App Review Guidelines (news) — Apple Developer](https://developer.apple.com/news/?id=7j1f99yf)
- Competitor listings surveyed for keyword landscape: [Focus Matrix](https://apps.apple.com/us/app/focus-matrix-task-manager/id1107872631), [Eisenhower Matrix: Todo & Task](https://apps.apple.com/us/app/eisenhower-matrix-todo-task/id6473735916), [Priority Matrix](https://appfluence.com/eisenhower-matrix-app/), [Matrix Manager](https://apps.apple.com/us/app/matrix-manager-task-manager/id6739463021)
