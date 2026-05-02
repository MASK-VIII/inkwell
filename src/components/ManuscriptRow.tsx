import { BookOpen, Trash2 } from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'
import { attachInkwellDragGhost } from '../lib/dragGhost'
import type { Manuscript } from '../types'

const CHAPTER_DRAG_MIME = 'application/x-inkwell-chapter-id'

function readChapterDragId(dt: DataTransfer): number | null {
  const raw = dt.getData(CHAPTER_DRAG_MIME)
  if (raw) {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  const plain = dt.getData('text/plain')
  const n = Number(plain)
  return Number.isFinite(n) ? n : null
}

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
  const rowRef = useRef<HTMLDivElement | null>(null)
  const chapterHadDragRef = useRef(false)
  const id = manuscript.id

  const onSelect = useCallback(() => onSelectChapter(id), [onSelectChapter, id])
  const onDelete = useCallback(() => onDeleteChapter(id), [onDeleteChapter, id])

  return (
    <div
      ref={rowRef}
      draggable
      role="button"
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      aria-grabbed={dragging}
      aria-label={`Chapter: ${manuscript.title}. Drag to reorder or activate to open.`}
      title="Drag to reorder chapters"
      className={`flex cursor-grab touch-none items-center gap-2 rounded-3xl px-3 py-3 outline-none transition-[transform,background-color,box-shadow,filter] duration-200 ease-out active:cursor-grabbing sm:gap-3 sm:px-4 sm:py-4 focus-visible:ring-2 focus-visible:ring-walnut focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark ${
        active
          ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
          : 'hover:bg-dust/30 dark:hover:bg-border-dark/50'
      } ${
        dragOver && !active && !dragging
          ? 'bg-dust text-ink inkwell-shelf-drop-target dark:bg-border-dark dark:text-ink-dark'
          : ''
      } ${dragOver && active && !dragging ? 'inkwell-shelf-drop-target' : ''}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-chapter-row-actions]')) return
        if (chapterHadDragRef.current) {
          chapterHadDragRef.current = false
          return
        }
        onSelect()
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        if ((e.target as HTMLElement).closest('[data-chapter-row-actions]')) return
        e.preventDefault()
        if (chapterHadDragRef.current) {
          chapterHadDragRef.current = false
          return
        }
        onSelect()
      }}
      onDragStart={(e) => {
        chapterHadDragRef.current = true
        e.dataTransfer.setData('text/plain', String(id))
        e.dataTransfer.setData(CHAPTER_DRAG_MIME, String(id))
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
        rowRef.current?.classList.add('inkwell-drag-source-lift')
        attachInkwellDragGhost(e.nativeEvent, manuscript.title, {
          fallback: 'Chapter',
          icon: '📖',
        })
      }}
      onDragEnd={() => {
        rowRef.current?.classList.remove('inkwell-drag-source-lift')
        setDragging(false)
        setDragOver(false)
        window.setTimeout(() => {
          chapterHadDragRef.current = false
        }, 0)
      }}
      onDragOver={(e) => {
        const types = Array.from(e.dataTransfer.types)
        if (!types.includes(CHAPTER_DRAG_MIME) && !types.includes('text/plain')) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(ev) => {
        const next = ev.relatedTarget as Node | null
        if (next && ev.currentTarget.contains(next)) return
        setDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const dragged = readChapterDragId(e.dataTransfer)
        if (dragged == null || !Number.isFinite(dragged)) return
        onDropReorder(dragged, id)
      }}
    >
      <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2 text-left">
        <BookOpen className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="truncate font-medium">{manuscript.title}</span>
      </div>
      <div data-chapter-row-actions className="shrink-0">
        <button
          type="button"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-2xl transition-colors ${
            active
              ? 'text-parchment/70 hover:bg-white/10 dark:text-ink/60 dark:hover:bg-black/10'
              : 'text-walnut hover:bg-white/40 hover:text-red-600 dark:text-accent-warm dark:hover:bg-black/20 dark:hover:text-red-400'
          }`}
          aria-label="Delete chapter"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export const ManuscriptRow = memo(ManuscriptRowInner)
