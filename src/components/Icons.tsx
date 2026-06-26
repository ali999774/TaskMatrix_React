/**
 * Icons.tsx
 * TaskMatrix icon component set.
 *
 * All icons render clean inline SVG with `currentColor` so they inherit
 * the parent text color and respond correctly to dark mode without any
 * hardcoded hex values.
 *
 * Props:
 *   size   — pixel size of the square viewport (default: 24)
 *   color  — CSS color string; overrides currentColor when provided
 *   className — forwarded to the <svg> element
 *   aria-label — pass for standalone icon buttons; omit for decorative icons
 */

import type { SVGProps } from 'react'

interface IconProps extends SVGProps<SVGSVGElement> {
  /** Square dimension in px. Defaults to 24. */
  size?: number
}

function base(size: number, rest: SVGProps<SVGSVGElement>) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': rest['aria-label'] ? undefined : true,
    ...rest,
  }
}

/* ── Q1 — Do First ────────────────────────────────────────────────────────── */
/** Flame glyph — represents "Do First" (urgent + important). */
export function IconFlame({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      {/* outer flame body */}
      <path d="M12 2c0 0-6 5.686-6 10a6 6 0 0 0 12 0c0-3-1.5-5-3-6.5 0 2-1 3-3 3-.5-1.5-0-5 0-6.5Z" />
      {/* inner flicker */}
      <path d="M12 14.5c0 0-2-1.5-2-3 .8.5 1.8.5 2 0 .2.5 1.2.5 2 0 0 1.5-2 3-2 3Z" />
    </svg>
  )
}

/* ── Q2 — Invest ──────────────────────────────────────────────────────────── */
/** Calendar glyph — represents "Invest" (important, not urgent). */
export function IconCalendar({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M3 9h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/* ── Q3 — Delegate ────────────────────────────────────────────────────────── */
/** People/group glyph — represents "Delegate" (urgent, not important). */
export function IconPeople({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      {/* left person */}
      <circle cx="7.5" cy="7.5" r="2.5" />
      <path d="M3 19c0-3 2-4.5 4.5-4.5" />
      {/* right person */}
      <circle cx="16.5" cy="7.5" r="2.5" />
      <path d="M21 19c0-3-2-4.5-4.5-4.5" />
      {/* center / shared */}
      <circle cx="12" cy="8" r="2.5" />
      <path d="M7.5 19c0-3 2-4.5 4.5-4.5s4.5 1.5 4.5 4.5" />
    </svg>
  )
}

/* ── Q4 — Don't Do ────────────────────────────────────────────────────────── */
/** Circle-X glyph — represents "Don't Do" (neither urgent nor important). */
export function IconCircleX({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}

/* ── Navigation ───────────────────────────────────────────────────────────── */
/** 2×2 grid glyph — matrix / home view. */
export function IconGrid({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  )
}

/** Target/bullseye glyph — focus / AI suggest. */
export function IconTarget({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Sticky note glyph — notes view. */
export function IconNote({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8" />
      <path d="M14 2v6h6" />
      <path d="M14 8h6l0 10-6 6v-6" />
      <path d="M8 10h5" />
      <path d="M8 14h4" />
    </svg>
  )
}

/** Gear/settings glyph — tab bar settings. */
export function IconGear({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

/** Microphone glyph — voice input. */
export function IconMic({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v5" />
      <path d="M9 22h6" />
    </svg>
  )
}

/** Plus / add glyph — create new task or note. */
export function IconPlus({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

