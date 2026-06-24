import { useState, useRef } from 'react'
import type { StickyNote } from '../types'
import { renderMarkdown } from '../lib/markdown'
import { formatVoiceNote } from '../lib/speech'
import VoiceButton from './VoiceButton'
import { useHaptics } from '../hooks/useHaptics'

interface Props {
  notes: StickyNote[]
  onDelete: (id: string) => void
  onAdd?: (content: string) => void
  onEdit?: (note: StickyNote) => void
  onShowAll?: () => void
  sidebar?: boolean
  onReorder?: (id: string, newIndex: number) => void
  onNewBlank?: () => void
}

const LEFT_ACCENT: Record<string, string> = {
  yellow: 'border-l-yellow-500 dark:border-l-yellow-400',
  green: 'border-l-green-500 dark:border-l-green-400',
  blue: 'border-l-blue-500 dark:border-l-blue-400',
  red: 'border-l-red-500 dark:border-l-red-400',
  orange: 'border-l-orange-500 dark:border-l-orange-400',
}

export default function StickyWall({ notes, onDelete, onAdd, onEdit, onShowAll, sidebar, onReorder, onNewBlank }: Props) {
  const [input, setInput] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dropAbove, setDropAbove] = useState(true) // true = insert above target, false = below
  const haptics = useHaptics()
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('tm-pinned-collapsed') === 'true'
  })
  const dragCounterRef = useRef(0)

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('tm-pinned-collapsed', String(next))
      return next
    })
  }

  const handleAddOrNew = () => {
    if (input.trim()) {
      if (onAdd) { onAdd(input.trim()); setInput('') }
    } else {
      onNewBlank?.()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddOrNew()
  }

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    dragCounterRef.current++
    if (draggedId === id) return
    setDragOverId(id)
    // Detect above/below midpoint
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDropAbove(e.clientY < rect.top + rect.height / 2)
  }

  const handleDragLeave = () => {
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setDragOverId(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOverId(null)
    setDraggedId(null)

    const dragged = e.dataTransfer.getData('text/plain')
    if (!dragged || !onReorder || dragged === targetId) return

    const from = notes.findIndex(n => n.id === dragged)
    const to = notes.findIndex(n => n.id === targetId)
    if (from === -1 || to === -1) return

    // Insert above or below based on cursor position relative to midpoint
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const insertAbove = e.clientY < rect.top + rect.height / 2
    let targetIndex = insertAbove ? to : to + 1
    // If dragging from above the target, adjust for the removed item
    if (from < targetIndex && insertAbove) targetIndex--
    if (from < targetIndex && !insertAbove) targetIndex--

    onReorder(dragged, Math.max(0, targetIndex))
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
    dragCounterRef.current = 0
  }

  if (sidebar) {
    return (
      <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 w-full mb-20 lg:mb-0">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[0.875rem] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">📌 Pinned</h2>
          <span className="text-[0.875rem] text-slate-400">{notes.length}</span>
          <button
            onClick={toggleCollapsed}
            className="text-[0.75rem] opacity-50 hover:opacity-100 transition-all active:scale-75 motion-reduce:scale-100 ml-auto p-0.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
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
                <VoiceButton onTranscript={(t) => setInput(formatVoiceNote(t))} />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="+ Quick note..."
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
                />
                <button onClick={handleAddOrNew} className="text-[0.875rem] px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"><span aria-hidden="true">+</span></button>
              </div>
            )}

            {notes.length === 0 ? (
              <p className="text-[0.875rem] text-slate-300 dark:text-slate-600 italic text-center py-4">No pinned notes</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[calc(100vh-14rem)] overflow-y-auto mb-3 scrollbar-hide">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, note.id)}
                    onDragEnter={(e) => handleDragEnter(e, note.id)}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, note.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onEdit?.(note)}
                    style={{ userSelect: 'none' }}
                    className={`group p-3 rounded-lg border text-[0.875rem] cursor-grab active:cursor-grabbing transition-all
                      bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700
                      border-l-[4px] ${LEFT_ACCENT[note.color ?? 'yellow'] || LEFT_ACCENT.yellow}
                      ${draggedId === note.id ? 'opacity-40 scale-[0.97]' : ''}
                      ${dragOverId === note.id
                        ? dropAbove
                          ? 'ring-2 ring-blue-400 border-t-2 border-t-blue-500'
                          : 'ring-2 ring-blue-400 border-b-2 border-b-blue-500'
                        : ''
                      }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {note.title && (
                          <div className="text-[0.75rem] font-semibold text-slate-700 dark:text-slate-200 mb-1 truncate" aria-hidden="true">
                            {note.title}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }} />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); haptics('medium'); onDelete(note.id) }}
                        className="text-[0.75rem] px-1.5 py-0.5 rounded hover:bg-black/10 transition min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500"
                        aria-label="Delete note"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {onShowAll && (
              <button onClick={onShowAll} aria-label="View all notes" className="text-[0.75rem] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition w-full text-center min-h-[44px]"><span aria-hidden="true">View all notes →</span></button>
            )}
          </>
        )}
      </div>
    )
  }

  return null
}
