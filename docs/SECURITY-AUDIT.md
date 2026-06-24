# Security & Quality Audit — TaskMatrix_React

**Date:** 2026-06-24
**Scope:** Full client (`src/`), edge function (`supabase/functions/push-send`), migrations,
service worker (`public/sw.js`), Capacitor config. Rapid audit — not a penetration test.
**Method:** static review of all 41 source files + config.

Severity scale: **Critical** (exploitable now, real impact) · **High** (exploitable with
conditions / high impact) · **Medium** (defense-in-depth / data-loss / hardening) · **Low**
(quality, edge cases, info hygiene).

---

## Summary

| # | Finding | Severity | Area | Status |
|---|---------|----------|------|--------|
| 1 | `push-send` auth accepts any `Bearer eyJ…` token → push spoofing to any user | **High** | Edge function | ✅ Fixed in code (deploy pending) |
| 2 | `push-send` `body.token` direct-send bypasses all ownership checks | **High** | Edge function | ✅ Fixed in code (deploy pending) |
| 3 | RLS policies for `tasks` / `sticky_notes` / `user_settings` not version-controlled | **High** | RLS / IaC | ✅ Migration added (apply pending) |
| 4 | Optimistic writes swallow Supabase `{ error }` results → silent data loss | **Medium** | Error handling | Open |
| 5 | No Content-Security-Policy (two `dangerouslySetInnerHTML` sinks) | **Medium** | XSS defense-in-depth | Open |
| 6 | Auth deep-link token exchange errors silently swallowed | **Medium** | Auth | Open |
| 7 | `markdown.ts` HTML sink is safe **only** by invariant — fragile | **Medium** | XSS | Open (safe today) |
| 8 | Edge function leaks raw APNs error reasons to caller | **Low** | Info disclosure | ✅ Fixed in code |
| 9 | Service worker caches opaque cross-origin responses cache-first, unbounded | **Low** | SW / cache | Open |
| 10 | No length/size limits on task/note input | **Low** | DoS / storage | Open |
| 11 | `hashTaskId` UUID→int32 collisions can drop a reminder | **Low** | Quality | Open |
| 12 | `.env.example` documents `service_role` key for Playwright | **Low** | Secret hygiene | Open |

No hardcoded secrets found in `src/` (the Supabase **anon** key is injected via `VITE_*` env and
is public by design). `.env` is correctly git-ignored. No `eval`, `new Function`, `.innerHTML`, or
`window.open` usage. The markdown renderer emits no URLs/attributes (no `javascript:` vector today).

---

## Critical / High

### 1. `push-send` authorization is trivially bypassable — **High**
`supabase/functions/push-send/index.ts:148-156`
```ts
const isServiceRole = authHeader?.startsWith("Bearer eyJ"); // JWT token
if (!isAllowed && !isServiceRole) { /* 403 */ }
```
The "service role" check is a **string prefix match**, not a signature/role verification. The
Supabase **anon key is a JWT beginning with `eyJ` and is shipped in the public client bundle**, so
any attacker can present it (or any well-formed JWT) and pass as `isServiceRole`. Combined with a
caller-supplied `user_id`, this lets anyone **send arbitrary push notifications to any user** of
the app (spam, phishing, fake "reminder" deep-links that open arbitrary `task_id`s).

**Fix:** verify the bearer token for real — call `supabase.auth.getUser(jwt)` (or validate the
service-role JWT signature server-side) and **derive `user_id` from the verified token**, never
trust the request body's `user_id`. Reject anon-key callers from the broadcast path.

### 2. `body.token` direct-send bypasses ownership entirely — **High**
`push-send/index.ts:191-202`
```ts
if (body.token) { tokens = [body.token]; }   // skips the device_tokens DB lookup
```
A caller who passes a raw APNs `token` skips the `device_tokens` lookup completely, so there is no
check that the token belongs to the caller. Together with #1 this is a full push-to-arbitrary-device
primitive.

**Fix:** remove the `body.token` shortcut from the public path, or gate it behind a genuinely
authenticated service-role identity. Only resolve tokens from `device_tokens` scoped to the
**verified** user.

### 3. Core-table RLS policies are not in the repo — **High (unverifiable)**
Only `supabase/migrations/20260621_device_tokens.sql` defines an RLS policy. There is **no
migration** creating or enabling RLS for `tasks`, `sticky_notes`, or `user_settings`. The entire
client security model assumes these tables are RLS-scoped to `auth.uid() = user_id` (the client
also filters `.eq('user_id', userId)` as defense-in-depth), but that cannot be audited from the
repo and could silently regress.

**Fix:** commit migrations that `ENABLE ROW LEVEL SECURITY` and define
`USING (auth.uid() = user_id)` policies for all three tables. Add a `get_advisors`/lint check in CI.

---

## Medium

### 4. Optimistic writes swallow Supabase errors → silent data loss — **Medium**
`useTasks.ts` (`addTask:215`, `updateStatus:267`, `updateTask:89`, `deleteTask`, `clearCompleted`),
`useStickyNotes.ts`, `useUserSettings.ts`. Supabase JS **does not throw** on RLS/constraint/4xx —
it returns `{ data, error }`. These calls are `await`ed but the result is discarded, so an online
write that fails RLS, a constraint, or a 4xx leaves the optimistic UI showing success while the
change is **lost** (the offline queue only covers `!online`, not online failures).

**Fix:** capture `{ error }` on each write; on error, roll back local state or enqueue to the
offline queue and surface a toast. At minimum log + reconcile via `reload()`.

### 5. No Content-Security-Policy — **Medium**
`index.html` ships no CSP (meta or header) and there are two `dangerouslySetInnerHTML` sinks
(`StickyWall.tsx:184`, `NotesModal.tsx:180`). A CSP (`default-src 'self'`, explicit
`connect-src` for `*.supabase.co` + AI/APNs, no inline script) would contain any future HTML-sink
regression and block exfiltration.

**Fix:** add a strict CSP (served as a header on GitHub Pages via meta tag, and verify it doesn't
break the Supabase WebSocket / edge-function origins).

### 6. Auth deep-link token exchange errors swallowed — **Medium**
`App.tsx:163-178` — `setSession({ access_token, refresh_token })` and `exchangeCodeForSession(code)`
are awaited but their errors are ignored. A failed native OAuth callback leaves the user on a blank
authed-but-not state with no feedback, and a malformed `taskmatrix://` URL is processed without
validation.

**Fix:** check the returned `{ error }`, surface `authError`, and validate the callback URL shape
before extracting tokens.

### 7. `markdown.ts` is safe only by invariant — **Medium**
`lib/markdown.ts` escapes `&<>` **before** substituting `**`/`~~` and emits only attribute-free,
URL-free tags (`<strong> <del> <ul> <ol> <li> <p>`). This is XSS-safe **today**, but the safety
depends entirely on never emitting a URL/attribute. The load-bearing SECURITY INVARIANT comment is
correct; the risk is a future edit adding link/image syntax without `javascript:`-scheme blocking.

**Fix:** keep the invariant; if links are ever added, validate URL schemes (allow only
`http/https/mailto`) and consider routing through `DOMPurify` instead of hand-rolled escaping.
Note `escapeHtml` does not escape quotes — fine now (no attributes), would not be if attributes are added.

---

## Low

### 8. Edge function leaks APNs error detail — **Low**
`push-send/index.ts:264` returns `errors: failed.map(f => f.reason)` (raw APNs response bodies) to
the caller — minor information disclosure about device/token state. Return a generic status; log
detail server-side only.

### 9. Service worker caches opaque responses cache-first, unbounded — **Low**
`public/sw.js` "everything else" branch caches `type === 'opaque'` cross-origin responses and serves
**cache-first forever** with no size cap or TTL. Low risk (no auth'd cross-origin assets here) but
can serve stale third-party content and grow unbounded. The `TODO(pwa)` already flags migrating to
Workbox/`vite-plugin-pwa` for durable versioning — do that; restrict the cache-first branch to
same-origin static assets.

### 10. No input length limits — **Low**
Task titles/notes and note content have no max length client-side (and presumably none server-side).
Large payloads bloat storage/realtime frames. Add reasonable `maxLength` and a DB `CHECK`/length
constraint.

### 11. `hashTaskId` collisions — **Low**
`lib/notifications.ts:132` maps a UUID to `int32` via a simple rolling hash mod 2^31. Two tasks can
collide and clobber each other's scheduled local notification. Acceptable at small scale; if it
matters, maintain a persisted UUID→id map.

### 12. `.env.example` references `service_role` for Playwright — **Low**
`.env.example` documents pulling the **service_role** key for E2E test-user provisioning. `.env` is
git-ignored (good), but the service-role key bypasses RLS entirely — ensure it lives only in CI
secrets, is never bundled, and the Playwright `global-setup` never runs in a context that could leak
it. Prefer a dedicated limited test project.

---

## What's already done well

- Anon key sourced from env, not hardcoded; `supabase.ts` fails fast if missing.
- Client filters every query by `user_id` (defense-in-depth on top of RLS).
- AI keys kept server-side — all LLM calls route through the `ai-parse` edge function; no provider
  key in the bundle, no browser→provider CORS hole.
- Markdown HTML sink is escape-first and attribute/URL-free (no live XSS).
- Soft-delete (`deleted_at`) instead of hard delete; offline queue caps size and discards stale
  (>24h) mutations.
- Capacitor native APIs correctly gated on `isNativePlatform()`; OAuth uses native-vs-web branch.
- `push-send` prunes 410/"Unregistered" stale tokens.

## Recommended remediation order
1. **#1 + #2** — rewrite `push-send` auth to verify the token and derive `user_id` server-side.
2. **#3** — commit and enforce RLS migrations for the three core tables.
3. **#4** — handle write errors (rollback / re-queue / surface).
4. **#5, #6, #7** — CSP, auth-callback error handling, keep the markdown invariant.
5. Low items as cleanup.
</content>
