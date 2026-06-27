/**
 * Note soft-delete verification — exercises the "Recently Deleted" feature
 * end-to-end against the real UI + Supabase, on the RLS-isolated test user.
 *
 * Covers the acceptance criteria:
 *   1. Delete removes the note from the active wall and SOFT-deletes it
 *      (deleted_at set) — it survives the undo toast disappearing.
 *   2. Undo (toast) and Restore (Trash) both return the note with its ORIGINAL
 *      id intact — verified at the DB level (same id, no duplicate INSERT).
 *   3. "Delete Permanently" is the only hard DELETE, gated behind a confirm tap.
 *   4. An offline delete→restore round-trip replays through the Dexie queue and
 *      lands the note active again (last-action-wins).
 *
 * Notes are seeded directly via Supabase (authed as the test user, so RLS
 * applies) using a content prefix that beforeEach cleans up — this never
 * collides with the offline-round-trip spec's Alpha/Beta notes.
 */
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://xulnxwwwjpvgsaqnsllo.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_PHuC0kENMdy-Qdfd3iAKnQ_AKpnpwo4'
const AUTH_FILE = path.join(__dirname, '.auth', 'user.json')

const CONTENT_PREFIX = 'e2e-softdelete-'

interface StoredSession {
  access_token: string
  user: { id: string }
}
interface StorageState {
  origins: { localStorage: { name: string; value: string }[] }[]
}

/** Build a Supabase client authed as the Playwright test user (RLS in force). */
function authed(): { client: SupabaseClient; userId: string } {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8')) as StorageState
  const entry = state.origins[0].localStorage.find((e) => e.name.endsWith('-auth-token'))
  if (!entry) throw new Error('[note-soft-delete] no auth token in storageState')
  const session = JSON.parse(entry.value) as StoredSession
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  })
  return { client, userId: session.user.id }
}

async function seedActiveNote(client: SupabaseClient, userId: string, id: string, content: string) {
  await client.from('sticky_notes').upsert(
    { id, user_id: userId, content, pinned: true, position: 10, color: 'yellow', deleted_at: null },
    { onConflict: 'id' },
  )
}

async function deletedAt(client: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await client.from('sticky_notes').select('deleted_at').eq('id', id).maybeSingle()
  return (data?.deleted_at as string | null) ?? null
}

async function rowsWithContent(client: SupabaseClient, userId: string, content: string) {
  const { data } = await client.from('sticky_notes').select('id').eq('user_id', userId).eq('content', content)
  return data ?? []
}

test.beforeEach(async ({ page }) => {
  // Unregister any lingering service worker (mirrors offline-round-trip spec).
  await page.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
    }
  })
  // Idempotent start: hard-remove this spec's notes (active or soft-deleted).
  const { client, userId } = authed()
  await client.from('sticky_notes').delete().eq('user_id', userId).like('content', `${CONTENT_PREFIX}%`)
})

test('undo toast restores the same row; soft-delete survives the toast', async ({ page }) => {
  const { client, userId } = authed()
  const id = '00000000-e2e0-0000-0000-0000000000a1'
  const content = `${CONTENT_PREFIX}undo`
  await seedActiveNote(client, userId, id, content)

  await page.goto('/')
  const row = page.locator('div[draggable]').filter({ hasText: content })
  await expect(row).toBeVisible({ timeout: 20_000 })

  // Delete from the sidebar — leaves the active wall immediately.
  await row.locator('button[aria-label="Delete note"]').click()
  await expect(row).toHaveCount(0)

  // It is a SOFT delete — the row still exists with deleted_at set, so it
  // survives the undo toast clearing.
  await expect.poll(() => deletedAt(client, id), { timeout: 10_000 }).not.toBeNull()

  // Undo → inverse UPDATE; note returns with its original id, no duplicate.
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('div[draggable]').filter({ hasText: content })).toBeVisible()
  await expect.poll(() => deletedAt(client, id), { timeout: 10_000 }).toBeNull()

  const rows = await rowsWithContent(client, userId, content)
  expect(rows).toHaveLength(1)
  expect(rows[0].id).toBe(id)
})

test('Trash view restores the note, and Delete Permanently is the only hard delete', async ({ page }) => {
  const { client, userId } = authed()
  const id = '00000000-e2e0-0000-0000-0000000000a2'
  const content = `${CONTENT_PREFIX}trash`
  await seedActiveNote(client, userId, id, content)

  await page.goto('/')
  const row = page.locator('div[draggable]').filter({ hasText: content })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.locator('button[aria-label="Delete note"]').click()
  await expect(row).toHaveCount(0)
  await expect.poll(() => deletedAt(client, id), { timeout: 10_000 }).not.toBeNull()

  // Open Notes modal → Recently Deleted view.
  await page.getByRole('button', { name: 'View all notes' }).first().click()
  await page.getByRole('button', { name: 'Recently deleted' }).click()
  await expect(page.getByRole('heading', { name: 'Recently Deleted' })).toBeVisible()
  await expect(page.getByText(content, { exact: true })).toBeVisible()

  // Restore from Trash → same row, now active.
  await page.getByRole('button', { name: /Restore note/ }).click()
  await expect.poll(() => deletedAt(client, id), { timeout: 10_000 }).toBeNull()
  expect(await rowsWithContent(client, userId, content)).toHaveLength(1)

  // Soft-delete again (DB) and refresh the Trash view to test permanent delete.
  await client.from('sticky_notes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  await page.getByRole('button', { name: 'Back to notes' }).click()
  await page.getByRole('button', { name: 'Recently deleted' }).click()
  await expect(page.getByText(content, { exact: true })).toBeVisible({ timeout: 10_000 })

  // Delete Permanently — two taps (reveal confirm, then confirm). The ONLY hard DELETE.
  await page.getByRole('button', { name: /Delete note forever/ }).click()
  await page.getByRole('button', { name: 'Confirm permanent delete' }).click()
  await expect.poll(() => rowsWithContent(client, userId, content).then((r) => r.length), { timeout: 10_000 }).toBe(0)
})

test('offline delete→restore replays through the queue and lands active (last-action-wins)', async ({ page, context }) => {
  const { client, userId } = authed()
  const id = '00000000-e2e0-0000-0000-0000000000a3'
  const content = `${CONTENT_PREFIX}offline`
  await seedActiveNote(client, userId, id, content)

  await page.goto('/')
  const row = page.locator('div[draggable]').filter({ hasText: content })
  await expect(row).toBeVisible({ timeout: 20_000 })

  // Go offline — mutations now queue to IndexedDB (Dexie).
  await context.setOffline(true)
  await expect(page.locator('[role="status"]')).toContainText('Offline', { timeout: 5_000 })

  // Delete (queued: update{deleted_at}), then Undo (queued: update{deleted_at:null}).
  await row.locator('button[aria-label="Delete note"]').click()
  await expect(row).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('div[draggable]').filter({ hasText: content })).toBeVisible()

  // Reconnect → queue flushes in timestamp order. delete then restore → active.
  await context.setOffline(false)
  await expect(page.locator('span[role="status"]')).not.toBeVisible({ timeout: 20_000 })

  await page.reload()
  await expect(page.locator('div[draggable]').filter({ hasText: content })).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => deletedAt(client, id), { timeout: 10_000 }).toBeNull()
})
