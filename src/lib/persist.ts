// Online-write-with-fallback helper (SECURITY-AUDIT #4).
//
// Supabase JS does NOT throw on RLS / constraint / 4xx failures — it resolves
// with `{ error }`. Code that `await`s a write but ignores the result therefore
// shows optimistic success while silently losing the change. This helper checks
// the result and, on failure, routes the mutation into the offline queue so it
// is retried on reconnect (and surfaced via the pending-count indicator) rather
// than dropped.

type Table = 'tasks' | 'sticky_notes' | 'user_settings'
type Op = 'create' | 'update' | 'delete'

interface OfflineQueueLike {
  enqueue: (
    table: Table,
    op: Op,
    id: string,
    payload?: Record<string, unknown>,
    conflictKey?: string,
  ) => Promise<void>
  online: boolean
}

/** Anything resolving to a Supabase-style `{ error }` result. */
type WriteResult = { error: unknown }

/**
 * Run an online Supabase write. If it returns an error (or throws), enqueue the
 * equivalent mutation for retry instead of silently dropping it.
 *
 * `payload` / `conflictKey` must describe the SAME mutation as `runOnline` so the
 * queued retry reproduces it (e.g. a soft-delete is an 'update' with deleted_at,
 * not a hard 'delete').
 *
 * @returns `{ ok: true }` if the write landed; `{ ok: false }` if it was queued
 *          (or failed with no queue available).
 */
export async function persistOrQueue(
  offlineQueue: OfflineQueueLike | undefined,
  table: Table,
  op: Op,
  id: string,
  runOnline: () => PromiseLike<WriteResult>,
  payload?: Record<string, unknown>,
  conflictKey?: string,
): Promise<{ ok: boolean }> {
  try {
    const { error } = await runOnline()
    if (!error) return { ok: true }
    const msg = (error as { message?: string })?.message ?? String(error)
    console.warn(`[persist] online ${op} ${table}:${id} failed (${msg}) — queued for retry`)
  } catch (err) {
    console.warn(`[persist] online ${op} ${table}:${id} threw — queued for retry`, err)
  }

  if (offlineQueue) {
    try {
      await offlineQueue.enqueue(table, op, id, payload, conflictKey)
    } catch (e) {
      console.error(`[persist] failed to queue ${op} ${table}:${id}`, e)
    }
  }
  return { ok: false }
}
