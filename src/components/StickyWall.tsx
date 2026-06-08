import { useState } from 'react'
import type { StickyNote } from '../types'
import { renderMarkdown } from '../lib/markdown'
import VoiceButton from './VoiceButton'

interface Props {
  notes: StickyNote[]
  onDelete: (id: string) => void
  onAdd?: (content: string) => void
  onEdit?: (note: StickyNote) => void
  onShowAll?: () => void
  sidebar?: boolean
  onReorder?: (id: string, newIndex: number) => void
}

const COLOR_MAP: Record<string, string> = {
  yellow: 'bg-yellow-100 dark:bg-yellow-400/20 border-yellow-300 dark:border-yellow-400/40 text-yellow-800 dark:text-yellow-100',
  green: 'bg-green-100 dark:bg-green-400/20 border-green-300 dark:border-green-400/40 text-green-800 dark:text-green-100',
  blue: 'bg-blue-100 dark:bg-blue-400/20 border-blue-300 dark:border-blue-400/40 text-blue-800 dark:text-blue-100',
  pink: 'bg-pink-100 dark:bg-pink-400/20 border-pink-300 dark:border-pink-400/40 text-pink-800 dark:text-pink-100',
  purple: 'bg-purple-100 dark:bg-purple-400/20 border-purple-300 dark:border-purple-400/40 text-purple-800 dark:text-purple-100',
  orange: 'bg-orange-100 dark:bg-orange-400/20 border-orange-300 dark:border-orange-400/40 text-orange-800 dark:text-orange-100',
}

export default function StickyWall({ notes, onDelete, onAdd, onEdit, onShowAll, sidebar, onReorder }: Props) {
  const [input, setInput] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('tm-pinned-collapsed') === 'true'
  })

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('tm-pinned-collapsed', String(next))
      return next
    })
  }

  const handleAdd = () => {
    if (input.trim() && onAdd) {
      onAdd(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const dragged = e.dataTransfer.getData('text/plain')
    if (!dragged || !onReorder || dragged === targetId) return

    const from = notes.findIndex(n => n.id === dragged)
    const to = notes.findIndex(n => n.id === targetId)
    if (from === -1 || to === -1) return

    onReorder(dragged, to)
    setDraggedId(null)
  }

  const handleDragEnd = () => setDraggedId(null)

  if (sidebar) {
    return (
      <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 w-full mb-20 lg:mb-0">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">📌 Pinned</h2>
          <span className="text-sm text-slate-400">{notes.length}</span>
          <button
            onClick={toggleCollapsed}
            className="text-xs opacity-50 hover:opacity-100 transition-all active:scale-75 ml-auto p-0.5"
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand pinned notes' : 'Collapse pinned notes'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        </div>

        {!collapsed && (
          <>
            {onAdd && (
              <div className="flex gap-1.5 mb-3">
                <VoiceButton onTranscript={setInput} />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="+ Quick note..."
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
                />
                <button onClick={handleAdd} className="text-sm px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all active:scale-90">+</button>
              </div>
            )}

            {notes.length === 0 ? (
              <p className="text-sm text-slate-300 dark:text-slate-600 italic text-center py-4">No pinned notes</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[calc(100vh-14rem)] overflow-y-auto mb-3 scrollbar-hide">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, note.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, note.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onEdit?.(note)}
                    style={{ userSelect: 'none' }}
                    className={`group p-3 rounded-lg border text-sm cursor-grab active:cursor-grabbing transition-all ${COLOR_MAP[note.color ?? 'yellow'] || COLOR_MAP.yellow} ${draggedId === note.id ? 'opacity-50 scale-[0.98]' : ''}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {note.title && (
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 truncate">
                            {note.title}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }} />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
                        className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded hover:bg-black/10 transition min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                        aria-label="Delete note"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {onShowAll && (
              <button onClick={onShowAll} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition w-full text-center">
                View all notes →
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return null
}
