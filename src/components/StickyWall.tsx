import { useState } from 'react'
import type { StickyNote } from '../types'
import VoiceButton from './VoiceButton'

interface Props {
  notes: StickyNote[]
  onDelete: (id: string) => void
  onAdd?: (content: string) => void
  onEdit?: (note: StickyNote) => void
  onShowAll?: () => void
  sidebar?: boolean
}

const COLOR_MAP: Record<string, string> = {
  yellow: 'bg-yellow-100 dark:bg-yellow-400/20 border-yellow-300 dark:border-yellow-400/40 text-yellow-800 dark:text-yellow-100',
  green: 'bg-green-100 dark:bg-green-400/20 border-green-300 dark:border-green-400/40 text-green-800 dark:text-green-100',
  blue: 'bg-blue-100 dark:bg-blue-400/20 border-blue-300 dark:border-blue-400/40 text-blue-800 dark:text-blue-100',
  pink: 'bg-pink-100 dark:bg-pink-400/20 border-pink-300 dark:border-pink-400/40 text-pink-800 dark:text-pink-100',
  purple: 'bg-purple-100 dark:bg-purple-400/20 border-purple-300 dark:border-purple-400/40 text-purple-800 dark:text-purple-100',
  orange: 'bg-orange-100 dark:bg-orange-400/20 border-orange-300 dark:border-orange-400/40 text-orange-800 dark:text-orange-100',
}

export default function StickyWall({ notes, onDelete, onAdd, onEdit, onShowAll, sidebar }: Props) {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    if (input.trim() && onAdd) {
      onAdd(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  // Sidebar mode: show only pinned notes, with add input + All Notes button
  if (sidebar) {
    return (
      <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 
        dark:border-slate-700 p-4 w-full">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            📌 Pinned
          </h2>
          <span className="text-sm text-slate-400">{notes.length}</span>
        </div>

        {/* Add note input */}
        {onAdd && (
          <div className="flex gap-1.5 mb-3">
            <VoiceButton onTranscript={setInput} />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="+ Quick note..."
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 
                dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 
                dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 
                outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
            />
            <button
              onClick={handleAdd}
              className="text-sm px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 
                border border-slate-200 dark:border-slate-700 text-slate-500 
                hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              +
            </button>
          </div>
        )}

        {notes.length === 0 ? (
          <p className="text-sm text-slate-300 dark:text-slate-600 italic text-center py-4">
            No pinned notes
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[calc(100vh-14rem)] overflow-y-auto mb-3">
            {notes.map((note) => (
              <div
                key={note.id}
                onClick={() => onEdit?.(note)}
                className={`relative p-3 rounded-lg border text-sm cursor-pointer
                  ${COLOR_MAP[note.color || 'yellow'] || COLOR_MAP.yellow}
                  transition-all hover:scale-[1.02] hover:z-10 group shadow-sm`}
                style={{
                  transform: `translate(${note.position_x || 0}px, ${note.position_y || 0}px) rotate(${(note.position_x || 0) * 0.03}deg)`,
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 
                    text-slate-400 hover:text-red-500 transition-all text-xs"
                >
                  ✕
                </button>
                {note.title && (
                  <p className="font-semibold mb-0.5 opacity-80">{note.title}</p>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{note.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* All Notes button */}
        {onShowAll && (
          <button
            onClick={onShowAll}
            className="w-full text-sm py-2 rounded-lg border border-dashed border-slate-300 
              dark:border-slate-600 text-slate-400 dark:text-slate-500 
              hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-400 
              dark:hover:border-slate-400 transition-colors"
          >
            📝 All Notes
          </button>
        )}
      </div>
    )
  }

  // Original full-width mode (non-sidebar) — kept for potential standalone use
  if (notes.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-400 mb-3">📌 Pinned Notes</h2>
      <div className="flex flex-wrap gap-3">
        {notes.map((note) => (
          <div
            key={note.id}
            onClick={() => onEdit?.(note)}
            className={`relative w-48 min-h-[100px] p-3 rounded-lg border cursor-pointer
              ${COLOR_MAP[note.color || 'yellow'] || COLOR_MAP.yellow}
              transition-transform hover:scale-[1.02] group shadow-sm`}
            style={{
              transform: `translate(${note.position_x || 0}px, ${note.position_y || 0}px) rotate(${(note.position_x || 0) * 0.02}deg)`,
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 
                text-slate-400 hover:text-red-500 transition-all text-xs"
            >
              ✕
            </button>
            {note.title && (
              <p className="text-xs font-semibold mb-1 opacity-80">{note.title}</p>
            )}
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
