import { BookOpen, GripVertical, Trash2 } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import type { Manuscript } from '../types'

export type ManuscriptRowProps = {
  manuscript: Manuscript
  active: boolean
  /** Stable callback; avoids per-render closures so rows can memoize. */
  onSelectChapter: (id: number) => void
  onDeleteChapter: (id: number) => void
  onDropReorder: (draggedId: number, targetId: number) => void
}

function ManuscriptRowInner({
  manuscript,
  active,
  onSelectChapter,
  onDeleteChapter,
  onDropReorder,
}: ManuscriptRowProps) {
  const [dragOver, setDragOver] = useState(false)
  const [dragging, setDragging] = useState(false)
  const id = manuscript.id

  const onSelect = useCallback(() => onSelectChapter(id), [onSelectChapter, id])
  const onDelete = useCallback(() => onDeleteChapter(id), [onDeleteChapter, id])

  return (
    <div
      className={`flex items-center gap-2 rounded-3xl px-3 py-3 transition-colors sm:gap-3 sm:px-4 sm:py-4 ${
        active
          ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
          : 'hover:bg-dust/30 dark:hover:bg-border-dark/50'
      } ${dragOver && !active ? 'bg-dust text-ink dark:bg-border-dark dark:text-ink-dark' : ''} ${dragging ? 'opacity-40 scale-[0.98]' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const dragged = Number(e.dataTransfer.getData('text/plain'))
        if (!Number.isFinite(dragged)) return
        onDropReorder(dragged, id)
      }}
    >
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(id))
          e.dataTransfer.effectAllowed = 'move'
          setDragging(true)
        }}
        onDragEnd={() => setDragging(false)}
        className={`cursor-grab touch-none text-walnut active:cursor-grabbing dark:text-accent-warm ${active ? 'text-parchment/80 dark:text-ink/70' : ''}`}
        aria-label="Reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <BookOpen className="h-4 w-4 shrink-0 opacity-80" />
        <span className="truncate font-medium">{manuscript.title}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl transition-colors ${
          active
            ? 'text-parchment/70 hover:bg-white/10 dark:text-ink/60 dark:hover:bg-black/10'
            : 'text-walnut hover:bg-white/40 hover:text-red-600 dark:text-accent-warm dark:hover:bg-black/20 dark:hover:text-red-400'
        }`}
        aria-label="Delete chapter"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

export const ManuscriptRow = memo(ManuscriptRowInner)
