export type Quadrant = 1 | 2 | 3 | 4

export interface Task {
  id: string
  user_id: string
  title: string
  quadrant: Quadrant
  notes?: string
  due_date?: string | null
  completed?: boolean
  deleted_at?: string | null
  created_at?: string
}

export interface StickyNote {
  id: string
  user_id: string
  content: string
  color?: string
  position?: { x: number; y: number }
  created_at?: string
}

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  1: 'Do First',
  2: 'Schedule',
  3: 'Delegate',
  4: "Don't Do",
}

export const QUADRANT_DESCRIPTIONS: Record<Quadrant, string> = {
  1: 'Urgent & Important',
  2: 'Not Urgent & Important',
  3: 'Urgent & Not Important',
  4: 'Not Urgent & Not Important',
}
