import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, Pin, Trash2 } from 'lucide-react'
import type { StickyNote } from '../types'
import { renderMarkdown, stripMarkdown } from '../lib/markdown'
import SwipeableRow from './SwipeableRow'
import type { SwipeAction } from './SwipeableRow'

interface Props {
  notes: StickyNote[]
  onClose: () => void
  onEdit: (note: StickyNote) => void
  onDelete: (id: string) => void
  onPurge: (id: string) => void
  onNewBlank?: () => void
}

export default function NotesModal({ notes, onClose, onEdit, onDelete, onPurge, onNewBlank }: Props) {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'notes' | 'trash'>('notes')
  const [deleted, setDeleted] = useState<StickyNote[]>([])
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState(0)
  const touchStart = useRef<{ y: number; timestamp: number } | null>(null)

  const loadTrash = useCallback(() => {
    try {
      const raw = localStorage.getItem('tm-deleted-notes')
      if (raw) setDeleted(JSON.parse(raw))
    } catch {}
  }, [])

  const purgeForever = useCallback((id: string) => {
    const next = deleted.filter(d => d.id !== id)
    setDeleted(next)
    setConfirmPurgeId(null)
    try { localStorage.setItem('tm-deleted-notes', JSON.stringify(next)) } catch {}
    onPurge(id)
  }, [deleted, onPurge])

  useEffect(() => {
    loadTrash()
  }, [loadTrash])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
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

  const term = search === '_' ? '' : search
  const filtered = term
    ? notes.filter(n =>
        (n.title || '').toLowerCase().includes(term.toLowerCase()) ||
        (n.content || '').toLowerCase().includes(term.toLowerCase())
      )
    : notes

  const swipeActions = (note: StickyNote): SwipeAction[] => [
    {
      label: 'Delete',
      icon: <X size={20} />,
      className: 'bg-[#FF3B30]',
      onAction: () => onDelete(note.id),
    },
  ]

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex max-sm:items-start items-center justify-center
        bg-black/50 backdrop-blur-sm max-sm:pt-[env(safe-area-inset-top)] max-sm:p-0 animate-modal-backdrop"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl
          border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col
          max-sm:rounded-b-none max-sm:max-h-[95dvh] max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:animate-modal-sheet
          transition-transform duration-200"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-2 pb-0 max-sm:block hidden touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0"
          >
            <span aria-hidden="true" className="text-[1rem]">←</span>
          </button>
          <h2 className="flex-1 text-[1.125rem] font-semibold text-slate-800 dark:text-white">
            {view === 'trash' ? 'Recently Deleted' : 'Notes'}
          </h2>
          <div className="flex items-center gap-2">
            {view === 'notes' && (
              <button
                onClick={() => setSearch(search ? '' : '_')}
                aria-label={search ? 'Clear search' : 'Search notes'}
                className={`text-[1rem] p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all min-h-[44px] min-w-[44px] inline-flex items-center justify-center ${search ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}
              >
                <Search size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
            <span className="text-[0.875rem] text-slate-400">
              {view === 'trash' ? `${deleted.length} deleted` : `${notes.length} total`}
            </span>
          </div>
        </div>

        {/* Search bar */}
        {view === 'notes' && search && (
          <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
            <input
              type="text"
              value={search === '_' ? '' : search}
              onChange={(e) => setSearch(e.target.value || '_')}
              placeholder="Search notes..."
              autoFocus
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[1rem] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
            />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
          {view === 'trash' ? (
            deleted.length === 0 ? (
              <p className="text-center text-slate-300 dark:text-slate-600 italic py-12">
                No recently deleted notes
              </p>
            ) : (
              <div className="px-4 py-3 space-y-2">
                {deleted.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-70"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {note.title && (
                          <p className="font-semibold text-[0.8125rem] sm:text-[0.875rem] mb-1 text-slate-500 dark:text-slate-400 truncate">
                            {note.title}
                          </p>
                        )}
                        <p className="text-[0.8125rem] sm:text-[0.875rem] text-slate-400 dark:text-slate-500 line-clamp-2">
                          {stripMarkdown(note.content || 'Empty note')}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {confirmPurgeId === note.id ? (
                          <>
                            <button
                              onClick={() => purgeForever(note.id)}
                              className="text-[0.75rem] px-2 py-1 rounded bg-red-500 text-white font-medium min-h-[36px]"
                            >
                              Delete forever
                            </button>
                            <button
                              onClick={() => setConfirmPurgeId(null)}
                              className="text-[0.75rem] px-2 py-1 ml-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 min-h-[36px]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmPurgeId(note.id)}
                            className="text-[0.75rem] px-3 py-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[44px] inline-flex items-center justify-center"
                            aria-label={`Delete note forever ${note.title || ''}`}
                          >
                            <X size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-300 dark:text-slate-600 italic py-12">
              {search ? 'No notes match your search' : 'No notes yet — add one above'}
            </p>
          ) : (
            <div className="px-4 py-3 space-y-2">
              {filtered.map((note) => (
                <SwipeableRow
                  key={note.id}
                  actions={swipeActions(note)}
                  onTap={() => onEdit(note)}
                  className={`p-4 border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5
                    bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 border-l-[3px]
                    border-l-yellow-300 dark:border-l-yellow-400/80`}
                >
                  {note.title && (
                    <p className="font-semibold text-[0.8125rem] sm:text-[0.875rem] mb-1 opacity-80 text-slate-800 dark:text-slate-100">{note.title}</p>
                  )}
                  <p
                    className="text-[0.8125rem] sm:text-[0.875rem] whitespace-pre-wrap leading-relaxed line-clamp-4 text-slate-700 dark:text-slate-300"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content || 'Empty note') }}
                  />
                  <div className="flex items-center gap-2 mt-2 text-[0.75rem] opacity-60">
                    {note.pinned && <Pin size={14} strokeWidth={2} aria-hidden="true" />}
                    {note.created_at && (
                      <span>{new Date(note.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </SwipeableRow>
              ))}
            </div>
          )}
        </div>

        {/* Footer — Recently Deleted button */}
        {view === 'notes' && (
          <button
            onClick={() => { setSearch(''); setView('trash'); loadTrash() }}
            className="mt-4 w-full flex items-center justify-between px-4 py-3 rounded-xl
              bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50
              transition-colors min-h-[44px]"
            aria-label="Recently deleted"
          >
            <span className="flex items-center gap-2 text-[0.875rem] text-slate-600 dark:text-slate-400">
              <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
              Recently Deleted
            </span>
            <span className="text-[0.8125rem] text-slate-400">{deleted.length}</span>
          </button>
        )}

        {/* Floating new note button */}
        {view === 'notes' && onNewBlank && (
          <button
            onClick={onNewBlank}
            aria-label="New note"
            className="absolute bottom-16 right-4 w-12 h-12 rounded-full bg-blue-500 text-white shadow-lg
              hover:bg-blue-600 transition-all active:scale-90 flex items-center justify-center"
          >
            <span className="text-[1.5rem]">+</span>
          </button>
        )}
      </div>
    </div>
  )
}
