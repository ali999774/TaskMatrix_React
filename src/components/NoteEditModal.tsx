import { useState, useEffect, useRef } from 'react'
import type { StickyNote } from '../types'
import { useHaptics } from '../hooks/useHaptics'

const COLORS = ['red', 'amber', 'blue', 'green'] as const

const COLOR_BG: Record<string, string> = {
  red: 'bg-red-400',
  amber: 'bg-amber-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
}

interface Props {
  note: StickyNote
  onSave: (id: string, updates: Partial<StickyNote>) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function insertFormatting(
  textarea: HTMLTextAreaElement,
  wrapper: string,
  setter: (v: string) => void,
) {
  const { selectionStart, selectionEnd, value } = textarea
  const hasSelection = selectionStart !== selectionEnd
  const selected = value.slice(selectionStart, selectionEnd)

  // List prefixes: insert at line start instead of wrapping selection
  const isListPrefix = wrapper.endsWith(' ')
  if (isListPrefix) {
    const before = value.slice(0, selectionStart)
    const lineStart = before.lastIndexOf('\n', selectionStart - 1) + 1
    const inserted = value.slice(0, lineStart) + wrapper + value.slice(lineStart)
    setter(inserted)
    // Restore cursor after the prefix
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd =
        lineStart + wrapper.length + (hasSelection ? selected.length : 0)
    })
    return
  }

  const inserted =
    value.slice(0, selectionStart) +
    wrapper +
    (hasSelection ? selected : 'text') +
    wrapper +
    value.slice(selectionEnd)
  setter(inserted)

  // Select the placeholder "text" or restore selection range
  requestAnimationFrame(() => {
    if (hasSelection) {
      textarea.selectionStart = selectionStart
      textarea.selectionEnd = selectionEnd + wrapper.length * 2
    } else {
      const cursor = selectionStart + wrapper.length
      textarea.selectionStart = cursor
      textarea.selectionEnd = cursor + 4 // "text"
    }
  })
}

export default function NoteEditModal({ note, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(note.title || '')
  const [content, setContent] = useState(note.content || '')
  const [color, setColor] = useState(note.color || 'red')
  const [pinned, setPinned] = useState(!!note.pinned)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const haptics = useHaptics()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hasChangesRef = useRef(false)
  const noteRef = useRef(note)

  // Track latest note to avoid stale closures in debounce timer
  useEffect(() => { noteRef.current = note }, [note])

  // Autosave on any change (600ms debounce)
  useEffect(() => {
    // Skip initial mount — props haven't changed yet
    if (!hasChangesRef.current) {
      hasChangesRef.current = true
      return
    }
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (!title.trim() && !content.trim()) return
      onSave(noteRef.current.id, {
        title: title.trim() || null,
        content: content.trim(),
        color,
        pinned,
      })
    }, 600)
    return () => clearTimeout(saveTimerRef.current)
  }, [title, content, color, pinned])

  const [dragY, setDragY] = useState(0)
  const touchStart = useRef<{ y: number; timestamp: number } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const handleClose = () => {
    onClose()
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing form fields from prop
    setTitle(note.title || '')
    setContent(note.content || '')
    setColor(note.color || 'red')
    setPinned(!!note.pinned)
  }, [note])

  const handleDelete = () => {
    haptics('medium')
    onDelete(note.id)
    handleClose()
  }

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose()
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
      handleClose()
    }
    setDragY(0)
    touchStart.current = null
  }

  const fmt = (wrapper: string) => {
    const ta = textareaRef.current
    if (ta) insertFormatting(ta, wrapper, setContent)
  }

  // Auto-advance lists on Enter (numbered + bullet)
  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return
    const ta = e.currentTarget
    const { selectionStart, value } = ta
    const before = value.slice(0, selectionStart)
    const lineStart = before.lastIndexOf('\n', selectionStart - 1) + 1
    const currentLine = value.slice(lineStart, selectionStart)

    const numMatch = currentLine.match(/^(\d+)\.\s(.*)/)
    const bulletMatch = currentLine.match(/^([-*])\s(.*)/)

    if (!numMatch && !bulletMatch) return

    e.preventDefault()
    const text = (numMatch || bulletMatch)![2]

    // If line is empty after prefix, cancel the list
    if (!text.trim()) {
      const beforeLine = value.slice(0, lineStart)
      const afterCursor = value.slice(selectionStart)
      const after = afterCursor.startsWith('\n') ? afterCursor.slice(1) : afterCursor
      setContent(beforeLine + after)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = lineStart
      })
      return
    }

    // Insert next prefix
    const after = value.slice(selectionStart)
    let nextPrefix: string
    if (numMatch) {
      const num = parseInt(numMatch[1], 10)
      nextPrefix = (num + 1) + '. '
    } else {
      nextPrefix = bulletMatch![1] + ' '
    }
    setContent(before + '\n' + nextPrefix + after)
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = selectionStart + nextPrefix.length + 1
    })
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center
        p-4 max-sm:items-end max-sm:p-0 animate-modal-backdrop"
      onClick={handleOverlay}
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-xl
          max-sm:rounded-b-none max-sm:max-h-[95dvh] overflow-y-auto max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:animate-modal-sheet
          transition-transform duration-200"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-0 max-sm:block hidden">
          <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-[1.125rem] font-bold text-slate-800 dark:text-white">
            {note.id ? 'Edit Note' : 'New Note'}
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close note editor"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[1.125rem] px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="📌 Note title (with emoji)..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-[1rem] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
          />

          {/* Formatting toolbar */}
          <div className="flex gap-0.5">
            {[
              { label: 'B', title: 'Bold (**text**)', wrapper: '**' },
              { label: 'S̶', title: 'Strikethrough (~~text~~)', wrapper: '~~' },
              { label: '•', title: 'Bullet list', wrapper: '- ' },
              { label: '1.', title: 'Numbered list', wrapper: '1. ' },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => fmt(btn.wrapper)}
                title={btn.title}
                className="px-2.5 py-2 text-[0.75rem] font-medium rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
              >
                {btn.label}
              </button>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleContentKeyDown}
            placeholder={`Write your note here...

**bold** ~~strikethrough~~
- bullet
1. numbered`}
            rows={6}
            autoFocus
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-[1rem] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors resize-none font-mono"
          />

          {/* Color picker */}
          <div>
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 mb-2">Color</p>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full ${COLOR_BG[c]} transition-transform border-2
                    ${color === c ? 'scale-110 border-slate-800 dark:border-white' : 'border-transparent hover:scale-110'} min-h-[44px] min-w-[44px]`}
                />
              ))}
            </div>
          </div>

          {/* Pin toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 cursor-pointer"
            />
            <span className="text-[0.875rem] text-slate-600 dark:text-slate-300">📌 Pin to dashboard</span>
          </label>

          {/* Dates */}
          <div className="text-[0.75rem] text-slate-400 dark:text-slate-500 space-y-0.5">
            {note.created_at && (
              <p>Created: {new Date(note.created_at).toLocaleString()}</p>
            )}
            {note.updated_at && (
              <p>Last edited: {new Date(note.updated_at).toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Footer — Delete only (iOS swipe-style red button) */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
          <button
            onClick={handleDelete}
            aria-label="Delete note"
            className="bg-[#FF3B30] text-white w-11 h-11 rounded-full shadow-md flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all min-h-[44px] min-w-[44px]"
          >
            <span aria-hidden="true" className="text-[1.25rem] leading-none">✕</span>
          </button>
        </div>
      </div>
    </div>
  )
}
