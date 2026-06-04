import type { StickyNote } from '../types'

interface Props {
  notes: StickyNote[]
  onDelete: (id: string) => void
}

const COLOR_MAP: Record<string, string> = {
  yellow: 'bg-yellow-400/20 border-yellow-400/40 text-yellow-100',
  green: 'bg-green-400/20 border-green-400/40 text-green-100',
  blue: 'bg-blue-400/20 border-blue-400/40 text-blue-100',
  pink: 'bg-pink-400/20 border-pink-400/40 text-pink-100',
  purple: 'bg-purple-400/20 border-purple-400/40 text-purple-100',
  orange: 'bg-orange-400/20 border-orange-400/40 text-orange-100',
}

export default function StickyWall({ notes, onDelete }: Props) {
  if (notes.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-slate-400 mb-3">📌 Sticky Notes</h2>
      <div className="flex flex-wrap gap-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`relative w-48 min-h-[100px] p-3 rounded-lg border 
              ${COLOR_MAP[note.color || 'yellow'] || COLOR_MAP.yellow}
              transition-transform hover:scale-[1.02] group`}
            style={{
              transform: `translate(${note.position_x || 0}px, ${note.position_y || 0}px) rotate(${(note.position_x || 0) * 0.02}deg)`,
            }}
          >
            <button
              onClick={() => onDelete(note.id)}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 
                text-slate-400 hover:text-red-400 transition-all text-xs"
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
