import { useState } from 'react'
import type { StickyNote } from '../types'
import { renderMarkdown, stripMarkdown } from '../lib/markdown'

const COLOR_MAP: Record<string, string> = {
  yellow: 'bg-yellow-100 dark:bg-yellow-400/20 border-yellow-300 dark:border-yellow-400/40 text-yellow-800 dark:text-yellow-100',
  green: 'bg-green-100 dark:bg-green-400/20 border-green-300 dark:border-green-400/40 text-green-800 dark:text-green-100',
  blue: 'bg-blue-100 dark:bg-blue-400/20 border-blue-300 dark:border-blue-400/40 text-blue-800 dark:text-blue-100',
  pink: 'bg-pink-100 dark:bg-pink-400/20 border-pink-300 dark:border-pink-400/40 text-pink-800 dark:text-pink-100',
  purple: 'bg-purple-100 dark:bg-purple-400/20 border-purple-300 dark:border-purple-400/40 text-purple-800 dark:text-purple-100',
  orange: 'bg-orange-100 dark:bg-orange-400/20 border-orange-300 dark:border-orange-400/40 text-orange-800 dark:text-orange-100',
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center
        p-4 max-sm:items-end max-sm:p-0"
      onClick={handleOverlay}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto
          shadow-xl max-sm:rounded-b-none max-sm:max-h-[85vh] max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
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
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
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
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
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
