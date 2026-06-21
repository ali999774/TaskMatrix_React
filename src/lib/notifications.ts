import { Capacitor } from '@capacitor/core'
import { LocalNotifications, type ScheduleOptions } from '@capacitor/local-notifications'
import type { ActionPerformed } from '@capacitor/local-notifications'
import type { Task } from '../types'

/**
 * Reminder offset presets — how long BEFORE the due date/time to fire.
 * null = no reminder.
 */
export type ReminderPreset =
  | null
  | 'at_time'  // at the due time (or 9 AM if date-only)
  | '5min'
  | '15min'
  | '30min'
  | '1hour'
  | '1day'
  | '2day'

export const REMINDER_OPTIONS: { value: ReminderPreset; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'at_time', label: 'At due time' },
  { value: '5min', label: '5 minutes before' },
  { value: '15min', label: '15 minutes before' },
  { value: '30min', label: '30 minutes before' },
  { value: '1hour', label: '1 hour before' },
  { value: '1day', label: '1 day before (9 AM)' },
  { value: '2day', label: '2 days before (9 AM)' },
]

/** Map preset → milliseconds before due */
function presetToMs(preset: ReminderPreset): number {
  switch (preset) {
    case 'at_time': return 0
    case '5min': return 5 * 60_000
    case '15min': return 15 * 60_000
    case '30min': return 30 * 60_000
    case '1hour': return 60 * 60_000
    case '1day': return 24 * 60 * 60_000
    case '2day': return 48 * 60 * 60_000
    default: return 0
  }
}

/**
 * Build the fire timestamp for a task's reminder.
 * date-only tasks → 9 AM local on due date, minus preset offset.
 * tasks with time → that specific time, minus preset offset.
 */
function getFireTime(task: Task, preset: ReminderPreset): Date | null {
  if (!task.due_date) return null

  const [year, month, day] = task.due_date.split('-').map(Number)
  if (!year || !month || !day) return null

  const hours = task.due_time
    ? parseInt(task.due_time.split(':')[0], 10) || 9
    : 9
  const minutes = task.due_time
    ? parseInt(task.due_time.split(':')[1], 10) || 0
    : 0

  const due = new Date(year, month - 1, day, hours, minutes, 0, 0)
  const offset = presetToMs(preset)
  return new Date(due.getTime() - offset)
}

/**
 * Pick the default reminder preset for a newly created task.
 * Time set → 'at_time' (remind at that exact moment).
 * Date-only → 'at_time' (remind at 9 AM on the due date).
 * No due date → null (can't remind without a date).
 */
export function defaultReminder(task: Pick<Task, 'due_date' | 'due_time'>): ReminderPreset {
  if (!task.due_date) return null
  return 'at_time'
}

/**
 * Schedule a local notification for a task reminder.
 * Skips if: not on native, no due date, or preset is null.
 * Uses task.id as the notification ID so it auto-replaces on re-schedule.
 */
export async function scheduleTaskReminder(task: Task): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const preset = task.reminder as ReminderPreset | undefined
  if (!preset) {
    await cancelTaskReminder(task.id)
    return
  }

  const fireAt = getFireTime(task, preset)
  if (!fireAt || fireAt.getTime() <= Date.now()) return // already passed

  const notificationId = hashTaskId(task.id)

  const options: ScheduleOptions = {
    notifications: [{
      id: notificationId,
      title: '⏰ Reminder',
      body: task.title,
      schedule: { at: fireAt },
      extra: { task_id: task.id, type: 'reminder' },
      sound: 'default',
    }],
  }

  await LocalNotifications.schedule(options)
}

/**
 * Cancel a previously scheduled reminder for a given task.
 */
export async function cancelTaskReminder(taskId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const notificationId = hashTaskId(taskId)
  await LocalNotifications.cancel({ notifications: [{ id: notificationId }] })
}

/**
 * Cancel all pending local notifications (e.g. on sign-out).
 */
export async function cancelAllReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [] })
}

/**
 * Stable numeric ID from a UUID string (Capacitor local notifications use int IDs).
 */
function hashTaskId(uuid: string): number {
  let hash = 0
  for (let i = 0; i < uuid.length; i++) {
    hash = ((hash << 5) - hash + uuid.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 2_147_483_647 // stay within int32 range
}

/**
 * Handle a local notification tap — dispatched via 'localNotificationActionPerformed'.
 * Same contract as push notifications: fires 'tm:open-task' CustomEvent.
 */
export function listenForReminderTaps(): void {
  if (!Capacitor.isNativePlatform()) return

  LocalNotifications.addListener('localNotificationActionPerformed', (action: ActionPerformed) => {
    const taskId = action.notification.extra?.task_id
    if (taskId) {
      window.dispatchEvent(new CustomEvent('tm:open-task', { detail: { task_id: taskId } }))
    }
  })
}
