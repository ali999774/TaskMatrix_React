import type { ReactNode } from 'react'
import { ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import Switch from './Switch'

/**
 * The trailing affordance determines how a row behaves and what sits on its
 * right edge:
 *   - 'toggle'      → iOS switch.                         (pairs with `toggle`/`onToggle`)
 *   - 'value'       → plain gray value text, no chevron.  (pairs with `value`)
 *   - 'stepper'     → value flanked by ∧/∨ chevrons for inline ± adjustment.
 *                                                         (pairs with `value`/`onStep`)
 *   - 'disclosure'  → optional gray value + ">" chevron; the whole row pushes a
 *                     subscreen.                          (pairs with `value`/`onPress`)
 *   - 'none'        → no trailing control (label-only, or a fully custom `children`).
 */
export type Affordance = 'toggle' | 'value' | 'stepper' | 'disclosure' | 'none'

export interface RowProps {
  /** Leading icon (e.g. a Lucide glyph). Optional — omit for text-only rows. */
  icon?: ReactNode
  label: string
  /** Secondary line under the label. Tone 'accent' renders it iOS-blue. */
  subtitle?: ReactNode
  subtitleTone?: 'muted' | 'accent'

  affordance?: Affordance
  /** Trailing value text for 'value' / 'stepper' / 'disclosure'. */
  value?: ReactNode

  // toggle
  toggle?: boolean
  onToggle?: (next: boolean) => void

  // stepper
  onStep?: (dir: -1 | 1) => void

  // disclosure / pressable value
  onPress?: () => void

  disabled?: boolean
  /**
   * Inline content revealed beneath the row's main line (still inside the same
   * cell) — e.g. a native picker exposed when a toggle is on. Kept on the row so
   * it sits above the next hairline rather than reading as a separate row.
   */
  children?: ReactNode
}

export default function Row({
  icon,
  label,
  subtitle,
  subtitleTone = 'muted',
  affordance = 'none',
  value,
  toggle = false,
  onToggle,
  onStep,
  onPress,
  disabled,
  children,
}: RowProps) {
  // Button-wrap only when there's a real press handler. A disclosure row with
  // no onPress is a visual host for an overlaid native control (e.g. a
  // transparent <select> positioned over it), so it stays non-interactive here.
  const pressable = !!onPress && (affordance === 'disclosure' || affordance === 'value')

  const main = (
    <div className="flex items-center gap-3 px-4 min-h-[44px] py-2.5">
      {icon != null && (
        <span className="shrink-0 text-slate-500 dark:text-slate-400 [&>svg]:h-[20px] [&>svg]:w-[20px]">
          {icon}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="text-[1.0625rem] leading-tight text-slate-800 dark:text-slate-100">
          {label}
        </div>
        {subtitle != null && subtitle !== '' && (
          <div
            className={`mt-0.5 text-[0.8125rem] leading-tight ${
              subtitleTone === 'accent'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Trailing affordance */}
      {affordance === 'toggle' && (
        <Switch
          checked={toggle}
          onChange={(v) => onToggle?.(v)}
          disabled={disabled}
          aria-label={label}
        />
      )}

      {affordance === 'value' && value != null && (
        <span className="shrink-0 text-[1.0625rem] text-slate-400 dark:text-slate-500">
          {value}
        </span>
      )}

      {affordance === 'stepper' && (
        <span className="flex shrink-0 items-center gap-2">
          {value != null && (
            <span className="text-[1.0625rem] text-slate-400 dark:text-slate-500">{value}</span>
          )}
          <span className="flex flex-col">
            <button
              type="button"
              aria-label={`Increase ${label}`}
              disabled={disabled}
              onClick={() => onStep?.(1)}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 disabled:opacity-40"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              aria-label={`Decrease ${label}`}
              disabled={disabled}
              onClick={() => onStep?.(-1)}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 disabled:opacity-40"
            >
              <ChevronDown size={16} />
            </button>
          </span>
        </span>
      )}

      {affordance === 'disclosure' && (
        <span className="flex shrink-0 items-center gap-1.5">
          {value != null && (
            <span className="text-[1.0625rem] text-slate-400 dark:text-slate-500">{value}</span>
          )}
          <ChevronRight size={18} className="text-slate-300 dark:text-slate-600" />
        </span>
      )}
    </div>
  )

  return (
    <div>
      {pressable ? (
        <button
          type="button"
          onClick={onPress}
          disabled={disabled}
          className="block w-full text-left active:bg-slate-100 dark:active:bg-slate-800 disabled:opacity-50"
        >
          {main}
        </button>
      ) : (
        main
      )}
      {children != null && <div className="px-4 pb-3 -mt-1">{children}</div>}
    </div>
  )
}
