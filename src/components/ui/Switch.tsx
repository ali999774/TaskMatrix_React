interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  /** Accessible label — the visible row label, since the track has no text. */
  'aria-label'?: string
}

/**
 * iOS-style toggle switch. Green-on / gray-off track with a sliding white knob.
 * Sized to the 51×31pt iOS control and meets the 44px touch target via padding
 * on the surrounding row, so the bare control stays visually compact.
 */
export default function Switch({ checked, onChange, disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest['aria-label']}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full
        transition-colors duration-200 ease-out disabled:opacity-40
        ${checked ? 'bg-[#34C759]' : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      <span
        className={`pointer-events-none inline-block h-[27px] w-[27px] rounded-full bg-white
          shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-out
          ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
      />
    </button>
  )
}
