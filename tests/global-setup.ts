/**
 * Playwright global setup — runs once before all tests.
 *
 * With SUPABASE_SERVICE_ROLE_KEY set:
 *   - Creates/updates test user (email_confirm: true, bypasses email flow)
 *   - Seeds two pinned notes for the reorder test
 *
 * Without the key (local dev where user was pre-provisioned via Supabase MCP):
 *   - Skips provisioning, signs in directly, writes storageState
 *
 * Either way the output is tests/.auth/user.json — a Playwright storageState
 * with a live Supabase session that every test loads automatically.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://xulnxwwwjpvgsaqnsllo.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_PHuC0kENMdy-Qdfd3iAKnQ_AKpnpwo4'
const SUPABASE_PROJECT_REF = 'xulnxwwwjpvgsaqnsllo'

const TEST_EMAIL = 'playwright-test@taskmatrix.dev'
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD ?? 'PwT3st!2024'

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json')
const BASE_URL = 'http://localhost:4173'

const NOTE_ALPHA_ID = '00000000-e2e0-0000-0000-000000000001'
const NOTE_BETA_ID = '00000000-e2e0-0000-0000-000000000002'

export default async function globalSetup() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (serviceRoleKey) {
    // Full provisioning path — CI or first-time local setup
    const admin = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: createErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (createErr && !createErr.message.includes('already been registered')) {
      throw new Error(`[global-setup] createUser failed: ${createErr.message}`)
    }

    const { data: { user } } = await admin.auth.admin.getUserByEmail(TEST_EMAIL)
    if (user) {
      await admin.from('sticky_notes').upsert([
        { id: NOTE_ALPHA_ID, user_id: user.id, content: 'Note Alpha', pinned: true, position: 0, color: 'yellow' },
        { id: NOTE_BETA_ID, user_id: user.id, content: 'Note Beta',  pinned: true, position: 1, color: 'blue' },
      ], { onConflict: 'id' })
    }
  } else {
    console.log('[global-setup] No SUPABASE_SERVICE_ROLE_KEY — skipping provisioning (user must already exist).')
  }

  // Sign in to get a fresh session regardless of which path we took
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error: signInErr } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })
  if (signInErr || !data.session) {
    throw new Error(
      `[global-setup] signIn failed: ${signInErr?.message ?? 'no session returned'}.\n` +
      'Provision the user first: SUPABASE_SERVICE_ROLE_KEY=<key> npm run test:e2e'
    )
  }

  // ── Clean up stale test data so each run starts from a known state ────────
  // Use the authenticated anon client — RLS allows the test user to CRUD their own rows.
  const userId = data.session.user.id
  const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  })

  // Hard-delete all tasks (avoids stale completed tasks showing in CompletedSection)
  await authed.from('tasks').delete().eq('user_id', userId)

  // Re-seed pinned notes at their initial positions (resets any position drift from prior runs)
  await authed.from('sticky_notes').upsert([
    { id: NOTE_ALPHA_ID, user_id: userId, content: 'Note Alpha', pinned: true, position: 0, color: 'yellow' },
    { id: NOTE_BETA_ID, user_id: userId, content: 'Note Beta',  pinned: true, position: 1, color: 'blue' },
  ], { onConflict: 'id' })

  // Reset categories to default so the 'Work' → 'E2E-Work' rename starts fresh
  const DEFAULT_CATEGORIES = [
    { label: 'work',     display: 'Work',     color: 'blue',    icon: '💼' },
    { label: 'personal', display: 'Personal', color: 'emerald', icon: '👤' },
    { label: 'health',   display: 'Health',   color: 'green',   icon: '❤️' },
    { label: 'learning', display: 'Learning', color: 'purple',  icon: '📚' },
  ]
  await authed.from('user_settings').upsert(
    { user_id: userId, categories: DEFAULT_CATEGORIES },
    { onConflict: 'user_id' }
  )

  console.log('[global-setup] test data reset for', TEST_EMAIL)
  // ─────────────────────────────────────────────────────────────────────────

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify({
    cookies: [],
    origins: [{
      origin: BASE_URL,
      localStorage: [{
        name: `sb-${SUPABASE_PROJECT_REF}-auth-token`,
        value: JSON.stringify(data.session),
      }],
    }],
  }))

  console.log('[global-setup] storageState written for', TEST_EMAIL)
}
