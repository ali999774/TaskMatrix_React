import { createElement, type FC } from 'react'
import {
  User, Monitor, Terminal, Rocket, Stethoscope, Heart, Ellipsis, Plus,
  BriefcaseBusiness, GraduationCap, BellRing, Car, ShoppingCart, PiggyBank,
  Home, Coffee, Dumbbell, Plane, BookOpen, Music, Film, Camera, Globe,
  type LucideIcon,
} from 'lucide-react'

export interface CategoryDef {
  label: string   // stored on task.category (e.g., "clinic")
  display: string // shown in UI (e.g., "Clinic")
  color: string   // tailwind color key (e.g., "red")
  icon: string    // Lucide icon name (e.g., "stethoscope") or emoji fallback
}

export const MAX_CATEGORIES = 7

// Available Lucide icons for category selection
export const CATEGORY_ICON_NAMES = [
  'briefcase-business', 'user', 'monitor', 'terminal', 'rocket',
  'stethoscope', 'heart', 'bell-ring', 'car', 'shopping-cart',
  'piggy-bank', 'home', 'coffee', 'dumbbell', 'plane',
  'book-open', 'music', 'film', 'camera', 'globe',
  'graduation-cap', 'ellipsis', 'plus',
] as const

export type CategoryIconName = typeof CATEGORY_ICON_NAMES[number]

const ICON_COMPONENTS: Record<CategoryIconName, LucideIcon> = {
  'briefcase-business': BriefcaseBusiness,
  'user': User,
  'monitor': Monitor,
  'terminal': Terminal,
  'rocket': Rocket,
  'stethoscope': Stethoscope,
  'heart': Heart,
  'bell-ring': BellRing,
  'car': Car,
  'shopping-cart': ShoppingCart,
  'piggy-bank': PiggyBank,
  'home': Home,
  'coffee': Coffee,
  'dumbbell': Dumbbell,
  'plane': Plane,
  'book-open': BookOpen,
  'music': Music,
  'film': Film,
  'camera': Camera,
  'globe': Globe,
  'graduation-cap': GraduationCap,
  'ellipsis': Ellipsis,
  'plus': Plus,
}

/** Render a category icon — Lucide icon if recognized, emoji/symbol as fallback */
export function renderCategoryIcon(icon: string, className = 'w-4 h-4'): React.ReactNode {
  const name = icon as CategoryIconName
  if (name in ICON_COMPONENTS) {
    return createElement(ICON_COMPONENTS[name], { className })
  }
  // Emoji or custom string — render as-is
  return createElement('span', { className }, icon)
}

/** Icon component for use in JSX — Lucide if recognized, emoji fallback */
export const CategoryIcon: FC<{ icon: string; className?: string }> = ({ icon, className = 'w-4 h-4' }) => {
  return renderCategoryIcon(icon, className) as React.ReactElement
}

export const CATEGORY_DEFAULTS: CategoryDef[] = [
  { label: 'personal', display: 'Personal', color: 'emerald', icon: 'user' },
  { label: 'work', display: 'Work', color: 'blue', icon: 'briefcase-business' },
  { label: 'health', display: 'Health', color: 'red', icon: 'heart' },
  { label: 'learning', display: 'Learning', color: 'purple', icon: 'graduation-cap' },
]

export const DEFAULT_CATEGORIES = CATEGORY_DEFAULTS

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
  if (!label) return undefined
  return categories.find(c => c.label.toLowerCase() === label.toLowerCase())
}

export function categoryDisplay(categories: CategoryDef[], label: string | null | undefined): string {
  const def = getCategoryDef(categories, label)
  return def ? def.display : (label || 'None')
}
