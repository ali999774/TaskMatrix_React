import { useState, useRef, useEffect, useCallback } from 'react'
import type { StickyNote } from '../types'
import { renderMarkdown, stripMarkdown } from '../lib/markdown'
import SwipeableRow from './SwipeableRow'
import type { SwipeAction } from './SwipeableRow'

const COLOR_ACCENT: Record<string, string> = {
  red: 'border-l-red-400 dark:border-l-red-400',
  amber: 'border-l-amber-400 dark:border-l-amber-400',
  blue: 'border-l-blue-400 dark:border-l-blue-400',
  green: 'border-l-green-400 dark:border-l-green-400',
}

// Filled pushpin, fill=currentColor so it inherits the white action-button text
// color — unlike the 📌 emoji, which renders in its native red and ignores CSS color.
const PinIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" aria-hidden="true">
    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
  </svg>
)

interface Props {
  notes: StickyNote[]
  onClose: () => void
  onEdit: (note: StickyNote) => void
  onPin?: (id: string, pinned: boolean) => void
  onDelete?: (id: string) => void
  onNewBlank?: () => void
  /** Lazily fetch soft-deleted notes for the Trash view. */
  onFetchDeleted?: () => Promise<StickyNote[]>
  /** Restore a soft-deleted note from Trash. */
  onRestore?: (note: StickyNote) => void
  /** Permanently delete a note from Trash (hard delete, no undo). */
  onPurgeForever?: (id: string) => void
  /** Open the modal directly on a specific view (default: 'notes'). */
  initialView?: 'notes' | 'trash'
}

export default function NotesModal({ notes, onClose, onEdit, onPin, onDelete, onNewBlank, onFetchDeleted, onRestore, onPurgeForever, initialView = 'notes' }: Props) {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'notes' | 'trash'>(initialView)
  const [deleted, setDeleted] = useState<StickyNote[]>([])
  const [trashLoading, setTrashLoading] = useState(false)
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null)

  const loadTrash = useCallback(async () => {
    if (!onFetchDeleted) return
    setTrashLoading(true)
    const rows = await onFetchDeleted()
    setDeleted(rows)
    setTrashLoading(false)
  }, [onFetchDeleted])

  // Fetch (or refetch) the Trash list whenever the user opens that view.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state before async fetch
    if (view === 'trash') loadTrash()
  }, [view, loadTrash])

  const handleRestore = (note: StickyNote) => {
    onRestore?.(note)
    setDeleted((prev) => prev.filter((n) => n.id !== note.id))
  }

  const handlePurge = (id: string) => {
    onPurgeForever?.(id)
    setDeleted((prev) => prev.filter((n) => n.id !== id))
    setConfirmPurgeId(null)
  }
  const [dragY, setDragY] = useState(0)
  const touchStart = useRef<{ y: number; timestamp: number } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const filtered = search
    ? notes.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(search.toLowerCase()) ||
          stripMarkdown(n.content).toLowerCase().includes(search.toLowerCase())
      )
    : notes

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow drag-to-dismiss from the header area, not the scrollable grid
    const target = e.target as HTMLElement
    if (scrollerRef.current?.contains(target)) return
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
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex max-sm:items-start items-center justify-center
        max-sm:pt-[env(safe-area-inset-top)] max-sm:p-0 animate-modal-backdrop"
      onClick={handleOverlay}
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden
          max-sm:rounded-b-none max-sm:max-h-[95dvh] max-sm:animate-modal-sheet
          transition-transform duration-200"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-0 max-sm:block hidden shrink-0">
          <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0 relative z-10 bg-white dark:bg-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              aria-label="Back"
              className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
            >
              <span aria-hidden="true" className="text-[1rem]">←</span>
            </button>
            <h2 className="text-[1.25rem] font-bold text-slate-800 dark:text-white">
              {view === 'trash' ? 'Recently Deleted' : 'Notes'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {view === 'notes' && (
              <button
                onClick={() => setSearch(search ? '' : '_')}
                aria-label={search ? 'Clear search' : 'Search notes'}
                className={`text-[1rem] p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all min-h-[44px] min-w-[44px] inline-flex items-center justify-center ${search ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}
              >
                <span aria-hidden="true">🔍</span>
              </button>
            )}
            {onFetchDeleted && (
              <button
                onClick={() => { setSearch(''); setView((v) => (v === 'trash' ? 'notes' : 'trash')) }}
                aria-label={view === 'trash' ? 'Back to notes' : 'Recently deleted'}
                className={`text-[1rem] p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all min-h-[44px] min-w-[44px] inline-flex items-center justify-center ${view === 'trash' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}
              >
                <span aria-hidden="true">🗑</span>
              </button>
            )}
            <span className="text-[0.875rem] text-slate-400">
              {view === 'trash' ? `${deleted.length} deleted` : `${notes.length} total`}
            </span>
          </div>
        </div>

        {/* Search bar — toggled by search icon; non-scrolling flex sibling below the header */}
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

        {/* Grid — single scroller below the header; clipping (not z-index) keeps motion layers under the header */}
        <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto isolate p-6 pb-20 max-sm:pb-[calc(5rem+env(safe-area-inset-bottom))]">
          {view === 'trash' ? (
            trashLoading ? (
              <p className="text-center text-slate-300 dark:text-slate-600 italic py-12">Loading…</p>
            ) : deleted.length === 0 ? (
              <p className="text-center text-slate-300 dark:text-slate-600 italic py-12">
                Trash is empty
              </p>
            ) : (
              <>
                <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 mb-4">
                  Deleted notes are kept for 30 days, then removed automatically.
                </p>
                <div className="space-y-2">
                  {deleted.map((note) => (
                    <div
                      key={note.id}
                      className={`flex items-start gap-2 p-3 rounded-lg border bg-white dark:bg-slate-800
                        border-slate-200 dark:border-slate-700 border-l-[3px] ${COLOR_ACCENT[note.color ?? 'red'] || COLOR_ACCENT.red}`}
                    >
                      <div className="flex-1 min-w-0">
                        {note.title && (
                          <p className="font-semibold text-[0.8125rem] sm:text-[0.875rem] mb-1 opacity-80 text-slate-800 dark:text-slate-100 truncate">{note.title}</p>
                        )}
                        <p className="text-[0.8125rem] sm:text-[0.875rem] line-clamp-2 text-slate-600 dark:text-slate-400">
                          {stripMarkdown(note.content || 'Empty note')}
                        </p>
                        {note.deleted_at && (
                          <p className="text-[0.6875rem] text-slate-400 dark:text-slate-500 mt-1">
                            Deleted {new Date(note.deleted_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {onRestore && (
                          <button
                            onClick={() => handleRestore(note)}
                            className="text-[0.75rem] px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors min-h-[44px] inline-flex items-center justify-center gap-1"
                            aria-label={`Restore note ${note.title || ''}`}
                          >
                            <span aria-hidden="true">↩</span> Restore
                          </button>
                        )}
                        {onPurgeForever && (
                          confirmPurgeId === note.id ? (
                            <button
                              onClick={() => handlePurge(note.id)}
                              className="text-[0.75rem] px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors min-h-[44px] inline-flex items-center justify-center"
                              aria-label="Confirm permanent delete"
                            >
                              Delete?
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmPurgeId(note.id)}
                              className="text-[0.75rem] px-3 py-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[44px] inline-flex items-center justify-center"
                              aria-label={`Delete note forever ${note.title || ''}`}
                            >
                              <span aria-hidden="true">✕</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-300 dark:text-slate-600 italic py-12">
              {search ? 'No notes match your search' : 'No notes yet — add one above'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((note) => {
                const actions: SwipeAction[] = []
                if (onEdit) {
                  actions.push({
                    label: 'Edit',
                    icon: 'i',
                    className: 'bg-[#8E8E93]',
                    onAction: () => onEdit(note),
                  })
                }
                if (onPin) {
                  actions.push({
                    label: note.pinned ? 'Unpin' : 'Pin',
                    icon: PinIcon,
                    className: 'bg-[#FF9500]',
                    onAction: () => onPin(note.id, !note.pinned),
                  })
                }
                if (onDelete) {
                  actions.push({
                    label: 'Delete',
                    icon: '✕',
                    className: 'bg-[#FF3B30]',
                    onAction: () => onDelete(note.id),
                  })
                }

                return (
                  <SwipeableRow
                    key={note.id}
                    actions={actions}
                    onTap={() => onEdit(note)}
                    aria-label={note.title || stripMarkdown(note.content || 'Empty note')}
                    className="bg-white dark:bg-slate-800"
                    showLabels={false}
                  >
                    <div
                      aria-hidden="true"
                      className={`p-4 border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5
                        bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 border-l-[3px]
                        ${COLOR_ACCENT[note.color ?? 'red'] || COLOR_ACCENT.red}`}
                    >
                      {note.title && (
                        <p className="font-semibold text-[0.8125rem] sm:text-[0.875rem] mb-1 opacity-80 text-slate-800 dark:text-slate-100">{note.title}</p>
                      )}
                      <p
                        className="text-[0.8125rem] sm:text-[0.875rem] whitespace-pre-wrap leading-relaxed line-clamp-4 text-slate-700 dark:text-slate-300"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content || 'Empty note') }}
                      />
                      <div className="flex items-center gap-2 mt-2 text-[0.75rem] opacity-60">
                        {note.pinned && <span>📌</span>}
                        {note.created_at && (
                          <span>{new Date(note.created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </SwipeableRow>
                )
              })}
            </div>
          )}
        </div>

        {/* Floating new note button */}
        {view === 'notes' && onNewBlank && (
          <button
            onClick={onNewBlank}
            aria-label="New note"
            className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center min-h-[44px] min-w-[44px] z-20"
          >
            <span aria-hidden="true" className="text-[1.5rem] leading-none">+</span>
          </button>
        )}
      </div>
    </div>
  )
}
