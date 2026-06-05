export type Quadrant = 1 | 2 | 3 | 4

export interface Task {
  id: string
  user_id: string
  title: string
  notes?: string | null
  category?: string | null
  importance: number
  urgency: number
  status: string
  due_date?: string | null
  due_time?: string | null
  estimated_duration?: number | null
  recurring?: boolean
  tags?: string[]
  subtasks?: { title: string; done: boolean }[]
  pinned?: boolean
  position?: number
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export interface StickyNote {
  id: string
  user_id: string
  content: string
  title?: string | null
  color?: string
  position_x?: number
  position_y?: number
  pinned?: boolean
  created_at?: string
  updated_at?: string
}

export function importanceUrgencyToQuadrant(importance: number, urgency: number): Quadrant {
  const highImportance = importance >= 3
  const highUrgency = urgency >= 3
  if (highUrgency && highImportance) return 1
  if (!highUrgency && highImportance) return 2
  if (highUrgency && !highImportance) return 3
  return 4
}

export const QUADRANT_DEFAULTS: Record<Quadrant, { importance: number; urgency: number }> = {
  1: { importance: 5, urgency: 5 },
  2: { importance: 5, urgency: 2 },
  3: { importance: 2, urgency: 5 },
  4: { importance: 2, urgency: 2 },
}

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  1: 'Do First',
  2: 'Schedule',
  3: 'Delegate',
  4: "Don't Do",
}

export const QUADRANT_ICONS: Record<Quadrant, string> = {
  1: '🔥',
  2: '📅',
  3: '🤝',
  4: '🗑️',
}

export const QUADRANT_DESCRIPTIONS: Record<Quadrant, string> = {
  1: 'Urgent & Important',
  2: 'Important, Not Urgent',
  3: 'Urgent, Not Important',
  4: 'Neither Urgent Nor Important',
}
