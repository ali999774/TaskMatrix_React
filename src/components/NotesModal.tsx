import { useState, useRef } from 'react'
import type { StickyNote } from '../types'
import { renderMarkdown, stripMarkdown } from '../lib/markdown'

const COLOR_MAP: Record<string, string> = {
  yellow: 'bg-yellow-50 dark:bg-yellow-400/10 border-yellow-200 dark:border-yellow-400/20 text-yellow-800 dark:text-yellow-100',
  green: 'bg-green-50 dark:bg-green-400/10 border-green-200 dark:border-green-400/20 text-green-800 dark:text-green-100',
  blue: 'bg-blue-50 dark:bg-blue-400/10 border-blue-200 dark:border-blue-400/20 text-blue-800 dark:text-blue-100',
  pink: 'bg-pink-50 dark:bg-pink-400/10 border-pink-200 dark:border-pink-400/20 text-pink-800 dark:text-pink-100',
  purple: 'bg-purple-50 dark:bg-purple-400/10 border-purple-200 dark:border-purple-400/20 text-purple-800 dark:text-purple-100',
  orange: 'bg-orange-50 dark:bg-orange-400/10 border-orange-200 dark:border-orange-400/20 text-orange-800 dark:text-orange-100',
}

interface Props {
  notes: StickyNote[]
  onClose: () => void
  onAdd: (content: string) => void
  onEdit: (note: StickyNote) => void
  onNewBlank?: () => void
}

export default function NotesModal({ notes, onClose, onAdd, onEdit, onNewBlank }: Props) {
  const [search, setSearch] = useState('')
  const [input, setInput] = useState('')
  const [dragY, setDragY] = useState(0)
  const touchStart = useRef<{ y: number; timestamp: number } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const filtered = search
    ? notes.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(search.toLowerCase()) ||
          stripMarkdown(n.content).toLowerCase().includes(search.toLowerCase())
      )
    : notes

  const handleAdd = () => {
    if (input.trim()) {
      onAdd(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { y: e.touches[0].clientY, timestamp: Date.now() }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dy = e.touches[0].clientY - touchStart.current.y
    if (dy > 0) setDragY(dy) // only track downward swipes
  }

  const handleTouchEnd = () => {
    if (!touchStart.current) return
    const dt = Date.now() - touchStart.current.timestamp
    // Dismiss if dragged >100px or flicked fast >50px in <200ms
    if (dragY > 100 || (dragY > 50 && dt < 200)) {
      onClose()
    }
    setDragY(0)
    touchStart.current = null
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center
        p-4 max-sm:items-end max-sm:p-0 animate-modal-backdrop"
      onClick={handleOverlay}
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto
          shadow-xl max-sm:rounded-b-none max-sm:max-h-[85vh] max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:animate-modal-sheet
          transition-transform duration-200"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-0 max-sm:block hidden">
          <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl z-10">
          <h2 className="text-[1.25rem] font-bold text-slate-800 dark:text-white">📝 Notes</h2>
          <div className="flex items-center gap-3">
            {onNewBlank && (
              <button
                onClick={onNewBlank}
                aria-label="New blank note"
                className="text-[0.875rem] px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center font-bold"
              >
                +
              </button>
            )}
            <span className="text-[0.875rem] text-slate-400">{notes.length} total</span>
            <button
              onClick={onClose}
              aria-label="Close notes"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[1.125rem] px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Add + Search */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="+ Quick note..."
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[1rem] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-800 text-[0.875rem] font-medium hover:opacity-90 transition-opacity min-h-[44px]"
            >
              Add
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search notes..."
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[1rem] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
          />
        </div>

        {/* Grid */}
        <div className="p-6">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-300 dark:text-slate-600 italic py-12">
              {search ? 'No notes match your search' : 'No notes yet — add one above'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((note) => (
                <div
                  key={note.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEdit(note)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(note) } }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5
                    ${COLOR_MAP[note.color || 'yellow'] || COLOR_MAP.yellow}`}
                >
                  {note.title && (
                    <p className="font-semibold text-[0.875rem] mb-1 opacity-80">{note.title}</p>
                  )}
                  <p
                    className="text-[0.875rem] whitespace-pre-wrap leading-relaxed line-clamp-4"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content || 'Empty note') }}
                  />
                  <div className="flex items-center gap-2 mt-2 text-[0.75rem] opacity-60">
                    {note.pinned && <span>📌</span>}
                    {note.created_at && (
                      <span>{new Date(note.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
