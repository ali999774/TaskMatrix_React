export interface CategoryDef {
  label: string   // stored on task.category (e.g., "clinic")
  display: string // shown in UI (e.g., "Clinic")
  color: string   // tailwind color key (e.g., "red")
  icon: string    // emoji (e.g., "🏥")
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { label: 'work', display: 'Work', color: 'blue', icon: '💼' },
  { label: 'personal', display: 'Personal', color: 'emerald', icon: '👤' },
  { label: 'health', display: 'Health', color: 'green', icon: '❤️' },
  { label: 'learning', display: 'Learning', color: 'purple', icon: '📚' },
]

export const CATEGORY_COLORS = ['slate', 'red', 'amber', 'emerald', 'blue', 'purple', 'pink'] as const

export const CATEGORY_COLOR_HEX: Record<string, string> = {
  slate: '#94a3b8',
  red: '#f87171',
  amber: '#fbbf24',
  emerald: '#34d399',
  blue: '#60a5fa',
  purple: '#c084fc',
  pink: '#f472b6',
}

export const CATEGORY_BORDER: Record<string, string> = {
  slate: 'border-l-slate-400 dark:border-l-slate-400',
  red: 'border-l-red-400 dark:border-l-red-400',
  amber: 'border-l-amber-400 dark:border-l-amber-400',
  emerald: 'border-l-emerald-400 dark:border-l-emerald-400',
  blue: 'border-l-blue-400 dark:border-l-blue-400',
  purple: 'border-l-purple-400 dark:border-l-purple-400',
  pink: 'border-l-pink-400 dark:border-l-pink-400',
}

export const CATEGORY_BADGE: Record<string, string> = {
  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  red: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
  pink: 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400',
}

export const CATEGORY_RING: Record<string, string> = {
  slate: 'ring-slate-400',
  red: 'ring-red-400',
  amber: 'ring-amber-400',
  emerald: 'ring-emerald-400',
  blue: 'ring-blue-400',
  purple: 'ring-purple-400',
  pink: 'ring-pink-400',
}

export function getCategoryDef(categories: CategoryDef[], label: string | null | undefined): CategoryDef | undefined {
  return categories.find(c => c.label === label)
}

export function categoryDisplay(categories: CategoryDef[], label: string | null | undefined): string {
  const def = getCategoryDef(categories, label)
  return def ? `${def.icon} ${def.display}` : (label || 'None')
}
