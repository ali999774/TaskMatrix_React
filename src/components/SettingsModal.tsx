import { useState, useRef } from 'react'
import type { CategoryDef } from '../lib/categories'
import { CATEGORY_COLORS, CATEGORY_BADGE, CATEGORY_COLOR_HEX } from '../lib/categories'
import type { AISettings } from '../hooks/useAISettings'

interface Props {
  categories: CategoryDef[]
  onSave: (categories: CategoryDef[]) => void
  onClose: () => void
  aiSettings: AISettings
  onAISettingsChange: (update: Partial<AISettings>) => void
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function SettingsModal({ categories, onSave, onClose, aiSettings, onAISettingsChange }: Props) {
  const [items, setItems] = useState<CategoryDef[]>(() =>
    categories.map(c => ({ ...c }))
  )
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const draggedIdx = useRef<number | null>(null)

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[max(10vh,env(safe-area-inset-top))]
        bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl 
        border border-slate-200 dark:border-slate-700 overflow-hidden animate-in motion-reduce:animate-none">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <h2 className="flex-1 text-[1.125rem] font-semibold text-slate-800 dark:text-white">
            ⚙️ Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 
              text-[1.25rem] leading-none p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* AI Settings */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-2">
              🤖 AI Task Parsing
            </label>
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 mb-3">
              When enabled, voice transcripts are parsed by an LLM to create structured
              tasks with dates, categories, and priority. Your API key is stored locally.
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
                    <label className="block text-[0.75rem] text-slate-400 dark:text-slate-500 mb-1">API Key</label>
                    <input
                      type="password"
                      value={aiSettings.apiKey}
                      onChange={(e) => onAISettingsChange({ apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[0.75rem] text-slate-400 dark:text-slate-500 mb-1">Model</label>
                    <input
                      type="text"
                      value={aiSettings.model}
                      onChange={(e) => onAISettingsChange({ model: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400 transition-colors"
                    />
                  </div>
                </>
              )}
            </div>
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
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all
                      ${idx === editingIdx
                        ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                  >
                    {/* Drag handle */}
                    <span className="text-slate-300 dark:text-slate-600 text-[0.875rem] shrink-0">⋮⋮</span>

                    {/* Icon + display */}
                    <span className="text-[1rem] shrink-0">{cat.icon || '📌'}</span>
                    <span className="flex-1 text-[0.875rem] text-slate-700 dark:text-slate-300 truncate">
                      {cat.display || '(new category)'}
                    </span>

                    {/* Color dot */}
                    <span className={`w-3 h-3 rounded-full shrink-0 ${CATEGORY_BADGE[cat.color]?.split(' ')[0] || 'bg-blue-100'}`} />

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(idx) }}
                      className="text-[0.75rem] text-slate-300 dark:text-slate-600 hover:text-red-500 p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                      aria-label={`Delete category ${cat.display || 'new'}`}
                    >
                      ✕
                    </button>
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
