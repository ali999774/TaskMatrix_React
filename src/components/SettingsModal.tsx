import { useState, useRef } from 'react'
import { AppLauncher } from '@capacitor/app-launcher'
import type { CategoryDef } from '../lib/categories'
import { CATEGORY_COLORS, CATEGORY_BADGE, CATEGORY_COLOR_HEX } from '../lib/categories'
import type { AISettings } from '../hooks/useAISettings'
import { FONT_SCALES } from '../hooks/useFontScale'

interface Props {
  categories: CategoryDef[]
  onSave: (categories: CategoryDef[]) => void
  onClose: () => void
  aiSettings: AISettings
  onAISettingsChange: (update: Partial<AISettings>) => void
  fontScale: number
  onFontScaleChange: (scale: number) => void
  gcalIsConnected: boolean
  gcalConnect: () => Promise<{ success: boolean; error?: string }>
  gcalDisconnect: () => void
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function SettingsModal({ categories, onSave, onClose, aiSettings, onAISettingsChange, fontScale, onFontScaleChange, gcalIsConnected, gcalConnect, gcalDisconnect }: Props) {
  const [items, setItems] = useState<CategoryDef[]>(() =>
    categories.map(c => ({ ...c }))
  )
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const draggedIdx = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const touchStart = useRef<{ y: number; timestamp: number } | null>(null)
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null)

  // Google Calendar connect state (local — resets on modal close)
  const [gcalConnecting, setGcalConnecting] = useState(false)
  const [gcalError, setGcalError] = useState<string | null>(null)

  const handleGcalConnect = async () => {
    setGcalConnecting(true)
    setGcalError(null)
    const result = await gcalConnect()
    setGcalConnecting(false)
    if (!result.success && result.error) {
      setGcalError(result.error)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow drag-to-dismiss from the header area, not the scrollable body
    const target = e.target as HTMLElement
    if (scrollerRef.current?.contains(target)) return
    touchStart.current = { y: e.touches[0].clientY, timestamp: Date.now() }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dy = e.touches[0].clientY - touchStart.current.y
    if (dy > 0) setDragY(dy)
  }

  const handleTouchEnd = () => {
    if (!touchStart.current) return
    const dt = Date.now() - touchStart.current.timestamp
    if (dragY > 100 || (dragY > 50 && dt < 200)) {
      onClose()
    }
    setDragY(0)
    touchStart.current = null
  }

  const add = () => {
    const newItem: CategoryDef = { label: '', display: '', color: 'blue', icon: '📌' }
    setItems([...items, newItem])
    setEditingIdx(items.length)
  }

  const remove = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
    if (editingIdx === idx) setEditingIdx(null)
    else if (editingIdx !== null && editingIdx > idx) setEditingIdx(editingIdx - 1)
  }

  const update = (idx: number, partial: Partial<CategoryDef>) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, ...partial }
      // Auto-derive label from display if label is empty or matches old display slug
      if (partial.display !== undefined) {
        updated.label = slugify(updated.display)
      }
      return updated
    }))
  }

  const handleSave = () => {
    // Filter out empty entries
    const valid = items.filter(c => c.display.trim() && c.label.trim())
    if (valid.length === 0) return
    onSave(valid)
    onClose()
  }

  // Keyboard reorder for category rows
  const moveItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= items.length) return
    const updated = [...items]
    const [moved] = updated.splice(fromIdx, 1)
    updated.splice(toIdx, 0, moved)
    setItems(updated)
  }

  const handleCategoryKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const target = e.key === 'ArrowUp' ? idx - 1 : idx + 1
      moveItem(idx, target)
      // Re-focus the moved row after React re-render
      requestAnimationFrame(() => {
        const rows = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="button"][tabindex="0"]')
        rows?.[Math.max(0, Math.min(target, rows.length - 1))]?.focus()
      })
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setEditingIdx(idx === editingIdx ? null : idx)
    }
  }

  // Drag reorder
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    draggedIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    const from = draggedIdx.current
    if (from === null || from === targetIdx) return

    const updated = [...items]
    const [moved] = updated.splice(from, 1)
    updated.splice(targetIdx, 0, moved)
    setItems(updated)
    draggedIdx.current = null
  }

  const isValid = items.some(c => c.display.trim() && c.label.trim())

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center
        bg-black/50 backdrop-blur-sm p-4 max-sm:items-end max-sm:p-0 animate-modal-backdrop"
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl 
          border border-slate-200 dark:border-slate-700 overflow-hidden
          max-sm:rounded-b-none max-sm:max-h-[85vh] max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:animate-modal-sheet
          transition-transform duration-200"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-0 max-sm:block hidden">
          <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <span aria-hidden="true" className="text-[1rem]">←</span>
          </button>
          <h2 className="flex-1 text-[1.125rem] font-semibold text-slate-800 dark:text-white">
            ⚙️ Settings
          </h2>
        </div>

        {/* Body */}
        <div ref={scrollerRef} className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto max-sm:pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {/* Text size */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-2">
              Text size
            </label>
            <div
              role="radiogroup"
              aria-label="Text size"
              className="flex gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              {FONT_SCALES.map((opt) => {
                const selected = Math.abs(fontScale - opt.size) < 0.001
                return (
                  <button
                    key={opt.key}
                    role="radio"
                    aria-checked={selected}
                    aria-label={opt.aria}
                    onClick={() => onFontScaleChange(opt.size)}
                    className={`flex-1 min-h-[44px] rounded-lg font-semibold leading-none transition-all active:scale-95 motion-reduce:scale-100
                      ${selected
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    style={{ fontSize: `${0.75 + (opt.size - 0.9) * 1.4}rem` }}
                  >
                    A
                  </button>
                )
              })}
            </div>
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 mt-2">
              Scales all text across the app. Applies instantly.
            </p>
          </div>

          {/* Divider */}
          <hr className="border-slate-200 dark:border-slate-700" />

          {/* AI Settings */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-2">
              🤖 AI Task Parsing
            </label>
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 mb-3">
              When enabled, voice transcripts are parsed by AI to create structured
              tasks with dates, categories, and priority.
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiSettings.enabled}
                  onChange={(e) => onAISettingsChange({ enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[0.875rem] text-slate-700 dark:text-slate-300">Enable AI parsing</span>
              </label>

              {aiSettings.enabled && (
                <>
                  <div>
                    <label className="block text-[0.75rem] text-slate-400 dark:text-slate-500 mb-1">Provider</label>
                    <select
                      value={aiSettings.provider}
                      onChange={(e) => onAISettingsChange({ provider: e.target.value as 'deepseek' | 'openai' })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="deepseek">DeepSeek</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[0.75rem] text-slate-400 dark:text-slate-500 mb-1">Model</label>
                    <select
                      value={aiSettings.model}
                      onChange={(e) => onAISettingsChange({ model: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400 transition-colors appearance-none
                        bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.22%208.22a.75.75%200%200%201%201.06%200L10%2011.94l3.72-3.72a.75.75%200%201%201%201.06%201.06l-4.25%204.25a.75.75%200%200%201-1.06%200L5.22%209.28a.75.75%200%200%201%200-1.06Z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] 
                        bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
                    >
                      <option value="deepseek-v4-flash">deepseek-v4-flash (fastest)</option>
                      <option value="deepseek-v4-pro">deepseek-v4-pro (reasoning)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (OpenAI)</option>
                      <option value="gpt-4o">gpt-4o (OpenAI)</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Google Calendar */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-2">
              📅 Google Calendar
            </label>
            {gcalIsConnected ? (
              <>
                <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 mb-3">
                  Connected. Today's events appear on the home screen.
                </p>
                <button
                  onClick={gcalDisconnect}
                  className="w-full px-4 py-2.5 text-[0.875rem] font-medium rounded-lg
                    border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400
                    hover:bg-red-50 dark:hover:bg-red-950/20 transition-all
                    active:scale-[0.98] min-h-[44px]"
                >
                  Disconnect Google Calendar
                </button>
              </>
            ) : (
              <>
                <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 mb-3">
                  Connect to see today's events on the home screen.
                </p>
                <button
                  onClick={handleGcalConnect}
                  disabled={gcalConnecting}
                  className="w-full px-4 py-2.5 text-[0.875rem] font-medium rounded-lg
                    bg-blue-600 text-white hover:bg-blue-700 transition-all
                    active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2
                    disabled:opacity-50"
                >
                  {gcalConnecting ? 'Connecting…' : 'Connect Google Calendar'}
                </button>
                {gcalError && (
                  <p className="text-[0.75rem] text-red-500 mt-2">{gcalError}</p>
                )}
              </>
            )}
          </div>

          {/* Divider */}
          <hr className="border-slate-200 dark:border-slate-700" />
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-2">
              Categories
            </label>
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 mb-3">
              Drag to reorder. Tap a category to edit its name, color, or icon.
            </p>

            <div className="space-y-1.5">
              {items.map((cat, idx) => (
                <div key={idx}>
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    onClick={() => setEditingIdx(idx === editingIdx ? null : idx)}
                    onKeyDown={(e) => handleCategoryKeyDown(e, idx)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Category: ${cat.display || 'new category'}`}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all
                      ${idx === editingIdx
                        ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                  >
                    {/* Drag handle */}
                    <span className="text-slate-400 dark:text-slate-500 text-[0.875rem] shrink-0">⋮⋮</span>

                    {/* Up/down arrows for touch reorder */}
                    <div className="flex flex-col gap-0 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (idx > 0) { const copy = [...items]; [copy[idx], copy[idx-1]] = [copy[idx-1], copy[idx]]; setItems(copy) } }}
                        disabled={idx === 0}
                        className="text-[0.5rem] text-slate-400 dark:text-slate-400 hover:text-slate-500 disabled:opacity-20 leading-none px-0.5 min-h-[22px] min-w-[22px] inline-flex items-center justify-center"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (idx < items.length - 1) { const copy = [...items]; [copy[idx], copy[idx+1]] = [copy[idx+1], copy[idx]]; setItems(copy) } }}
                        disabled={idx === items.length - 1}
                        className="text-[0.5rem] text-slate-400 dark:text-slate-400 hover:text-slate-500 disabled:opacity-20 leading-none px-0.5 min-h-[22px] min-w-[22px] inline-flex items-center justify-center"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Icon + display */}
                    <span className="text-[1rem] shrink-0">{cat.icon || '📌'}</span>
                    <span className="flex-1 text-[0.875rem] text-slate-700 dark:text-slate-300 truncate">
                      {cat.display || '(new category)'}
                    </span>

                    {/* Color dot */}
                    <span className={`w-3 h-3 rounded-full shrink-0 ${CATEGORY_BADGE[cat.color]?.split(' ')[0] || 'bg-blue-100'}`} />

                    {/* Delete */}
                    {confirmDeleteIdx === idx ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[0.6875rem] text-red-500">Delete?</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); remove(idx); setConfirmDeleteIdx(null) }}
                          className="text-[0.75rem] text-red-500 font-semibold px-2 min-h-[44px]"
                          aria-label="Confirm delete"
                        >
                          Yes
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteIdx(null) }}
                          className="text-[0.75rem] text-slate-400 px-2 min-h-[44px]"
                          aria-label="Cancel delete"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteIdx(idx) }}
                        className="text-[0.75rem] text-slate-400 dark:text-slate-400 hover:text-red-500 p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                        aria-label={`Delete category ${cat.display || 'new'}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Edit panel */}
                  {editingIdx === idx && (
                    <div className="mt-1.5 ml-8 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-2.5">
                      <input
                        type="text"
                        value={cat.display}
                        onChange={(e) => update(idx, { display: e.target.value })}
                        placeholder="Category name"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 
                          dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 
                          dark:text-slate-300 outline-none focus:border-blue-400 transition-colors"
                      />
                      <div>
                        <label className="block text-[0.75rem] text-slate-400 dark:text-slate-500 mb-1">Color</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {CATEGORY_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => update(idx, { color })}
                              className={`w-8 h-8 rounded-full border-2 transition-all active:scale-90 motion-reduce:scale-100
                                ${cat.color === color
                                  ? 'border-slate-800 dark:border-white scale-110'
                                  : 'border-transparent hover:scale-105'
                                }`}
                              style={{ backgroundColor: CATEGORY_COLOR_HEX[color] || "#94a3b8" }}
                              aria-label={`Color: ${color}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[0.75rem] text-slate-400 dark:text-slate-500 mb-1">Icon (emoji)</label>
                        <input
                          type="text"
                          value={cat.icon}
                          onChange={(e) => update(idx, { icon: e.target.value || '📌' })}
                          maxLength={4}
                          className="w-16 bg-white dark:bg-slate-800 border border-slate-200 
                            dark:border-slate-700 rounded-lg px-3 py-2 text-[1.25rem] text-center
                            outline-none focus:border-blue-400 transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={add}
              className="mt-3 w-full text-[0.875rem] text-blue-500 hover:text-blue-600 dark:text-blue-400 
                font-medium py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600
                hover:border-blue-400 dark:hover:border-blue-500 transition-all active:scale-[0.98] min-h-[44px]"
            >
              + Add category
            </button>
          </div>

          {/* Siri Shortcut */}
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-[0.75rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Siri Shortcut
            </p>
            <p className="text-[0.8125rem] text-slate-500 dark:text-slate-400 mb-3">
              Add the shortcut, then say "Hey Siri, Add Task" to dictate a task — works even when locked.
            </p>
            <button
              onClick={async () => {
                try {
                  await AppLauncher.openUrl({ url: 'https://www.icloud.com/shortcuts/00a60107b3ef4dd78ad957a27d0affdb' })
                } catch {
                  // no-op — don't crash the modal
                }
              }}
              className="w-full px-4 py-2.5 text-[0.875rem] font-medium rounded-lg
                bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
                hover:bg-slate-200 dark:hover:bg-slate-700 transition-all
                active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2"
              aria-label="Add to Siri Shortcut"
            >
              <span aria-hidden="true" className="text-[1.25rem]">🎙️</span>
              Add to Siri Shortcut
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[0.875rem] text-slate-500 dark:text-slate-400 
              hover:text-slate-700 dark:hover:text-slate-200 transition min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`px-4 py-2 text-[0.875rem] font-medium rounded-lg transition-all min-h-[44px]
              ${isValid
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
