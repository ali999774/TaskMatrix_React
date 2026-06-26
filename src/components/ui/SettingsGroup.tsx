import { Children, type ReactNode } from 'react'

/**
 * One inset grouped-list section: an optional uppercase gray header floating
 * above a rounded Card, and an optional gray helper caption below it.
 *
 *   DATE & TIME            ← header
 *   ┌─────────────────┐
 *   │ row             │    ← Card (rounded surface, hairlines between rows)
 *   │ row             │
 *   └─────────────────┘
 *   Helper caption text.   ← footer
 */
interface SectionProps {
  header?: string
  footer?: ReactNode
  children: ReactNode
}

export function Section({ header, footer, children }: SectionProps) {
  return (
    <section>
      {header && (
        <h3 className="px-4 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {header}
        </h3>
      )}
      <Card>{children}</Card>
      {footer && (
        <p className="px-4 pt-1.5 text-[0.75rem] leading-snug text-slate-400 dark:text-slate-500">
          {footer}
        </p>
      )}
    </section>
  )
}

/**
 * A rounded surface that clusters rows. Hairline dividers are inserted BETWEEN
 * children but never at the card's outer edges, and are inset from the left to
 * align past the row padding (the iOS grouped-list look).
 */
export function Card({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean)
  return (
    <div className="overflow-hidden rounded-[15px] bg-white dark:bg-slate-900">
      {items.map((child, i) => (
        <div key={i}>
          {i > 0 && <div className="ml-4 h-px bg-slate-200/80 dark:bg-slate-700/70" />}
          {child}
        </div>
      ))}
    </div>
  )
}
