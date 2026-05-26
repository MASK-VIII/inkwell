import { BookOpen, MoreVertical } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { attachInkwellDragGhost } from '../lib/dragGhost'
import { countWordsInDoc } from '../lib/wordCount'
import { isContentsPage } from '../lib/masterPages'
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
  rowVariant?: 'master' | 'body'
  allowDelete?: boolean
  allowDrag?: boolean
  /** Stable callback; avoids per-render closures so rows can memoize. */
  onSelectChapter: (id: number) => void
  onDeleteChapter: (id: number) => void
  onDropReorder: (draggedId: number, targetId: number) => void
  onSplitChapter?: (id: number) => void
  onMergeWithNext?: (id: number) => void
  canMergeWithNext?: boolean
}

function ManuscriptRowInner({
  manuscript,
  active,
  rowVariant = 'body',
  allowDelete = true,
  allowDrag = true,
  onSelectChapter,
  onDeleteChapter,
  onDropReorder,
  onSplitChapter,
  onMergeWithNext,
  canMergeWithNext,
}: ManuscriptRowProps) {
  const [dragOver, setDragOver] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const chapterHadDragRef = useRef(false)
  const id = manuscript.id

  const onSelect = useCallback(() => onSelectChapter(id), [onSelectChapter, id])
  const onDelete = useCallback(() => onDeleteChapter(id), [onDeleteChapter, id])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: PointerEvent) => {
      const el = menuRef.current
      if (el && !el.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const wordCount = useMemo(() => countWordsInDoc(manuscript.content), [manuscript.content])
  const displayTitle = manuscript.title?.trim() || 'Untitled section'
  const showMerge = rowVariant === 'body' && Boolean(onMergeWithNext && canMergeWithNext)
  const showSplit = rowVariant === 'body' && Boolean(onSplitChapter)
  const showDelete = allowDelete && !isContentsPage(manuscript)
  const dragEnabled = allowDrag && !isContentsPage(manuscript)
  const menuId = `inkwell-chapter-menu-${id}`

  const menuBtnClass = `inkwell-chapter-row-menu-btn flex h-8 w-8 items-center justify-center rounded-2xl transition-colors ${
    active
      ? 'text-parchment/80 hover:bg-white/10 dark:text-ink/70 dark:hover:bg-black/10'
      : 'text-ink-muted hover:bg-panel-light-muted/72 dark:text-ink-dark/55 dark:hover:bg-panel-dark/80'
  }`

  const menuItemClass = `block w-full px-3 py-2.5 text-left text-sm font-medium transition-colors ${
    active
      ? 'text-parchment hover:bg-white/10 dark:text-ink dark:hover:bg-black/10'
      : 'text-ink hover:bg-dust/40 dark:text-ink-dark dark:hover:bg-border-dark/50'
  }`

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      aria-grabbed={dragging}
      aria-label={`Section: ${displayTitle}. Drag the grip to reorder or activate to open.`}
      title="Drag the grip to reorder"
      className={`flex cursor-default touch-pan-y flex-col gap-2 rounded-3xl px-2.5 py-3 outline-none transition-[transform,background-color,box-shadow,filter] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-walnut focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark sm:px-3 ${
        active
          ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
          : 'hover:bg-dust/30 dark:hover:bg-border-dark/50'
      } ${
        dragOver && !active && !dragging
          ? 'bg-dust text-ink inkwell-shelf-drop-target dark:bg-border-dark dark:text-ink-dark'
          : ''
      } ${dragOver && active && !dragging ? 'inkwell-shelf-drop-target' : ''}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-chapter-row-actions], [data-chapter-drag-handle]')) return
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
      <div className="flex min-w-0 items-start gap-1.5">
        <div
          data-chapter-drag-handle
          draggable={dragEnabled}
          aria-label={dragEnabled ? `Drag to reorder: ${displayTitle}` : displayTitle}
          title={dragEnabled ? 'Drag to reorder' : undefined}
          className={`touch-none mt-0.5 flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded-lg border border-transparent active:cursor-grabbing sm:h-7 sm:w-7 sm:rounded-xl ${
            active
              ? 'text-parchment/90 hover:bg-white/10 dark:text-ink/80 dark:hover:bg-black/10'
              : 'text-ink-muted hover:border-dust/80 hover:bg-panel-light-muted/72 dark:text-ink-dark/50 dark:hover:border-border-dark dark:hover:bg-panel-dark/60'
          }`}
          onDragStart={(e) => {
            if (!dragEnabled) {
              e.preventDefault()
              return
            }
            chapterHadDragRef.current = true
            e.dataTransfer.setData('text/plain', String(id))
            e.dataTransfer.setData(CHAPTER_DRAG_MIME, String(id))
            e.dataTransfer.effectAllowed = 'move'
            setDragging(true)
            rowRef.current?.classList.add('inkwell-drag-source-lift')
            attachInkwellDragGhost(e.nativeEvent, displayTitle, {
              fallback: 'Section',
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
        >
          <BookOpen className="h-4 w-4 opacity-90 pointer-events-none" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words font-medium leading-snug">{displayTitle}</p>
            {rowVariant === 'master' ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  active
                    ? 'bg-white/15 text-parchment/90 dark:bg-black/10 dark:text-ink/70'
                    : 'bg-dust/50 text-ink/60 dark:bg-border-dark dark:text-ink-dark/60'
                }`}
              >
                {isContentsPage(manuscript) ? 'Auto' : 'Master'}
              </span>
            ) : null}
          </div>
          <p
            className={`mt-0.5 text-[11px] tabular-nums ${
              active ? 'text-parchment/70 dark:text-ink/55' : 'text-ink/50 dark:text-ink-dark/50'
            }`}
          >
            {isContentsPage(manuscript) ? 'Updates with chapters' : `${wordCount.toLocaleString()} words`}
          </p>
        </div>

        <div ref={menuRef} data-chapter-row-actions className="relative shrink-0">
          {(showSplit || showMerge || showDelete) ? (
          <button
            type="button"
            id={`${menuId}-trigger`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            className={menuBtnClass}
            title="Section actions"
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
          ) : null}
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              aria-labelledby={`${menuId}-trigger`}
              className="absolute right-0 top-full z-[60] mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-dust bg-panel-light-strong py-1 shadow-lg dark:border-border-dark dark:bg-panel-dark"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {showSplit && onSplitChapter ? (
                <button
                  type="button"
                  role="menuitem"
                  title="Split at cursor (open this section first)"
                  className={menuItemClass}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onSplitChapter(id)
                  }}
                >
                  Split
                </button>
              ) : null}
              {showMerge && onMergeWithNext ? (
                <button
                  type="button"
                  role="menuitem"
                  title="Merge into the section below"
                  className={menuItemClass}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onMergeWithNext(id)
                  }}
                >
                  Merge with next
                </button>
              ) : null}
              {showDelete ? (
              <button
                type="button"
                role="menuitem"
                className={`${menuItemClass} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40`}
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onDelete()
                }}
              >
                Delete
              </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const ManuscriptRow = memo(ManuscriptRowInner)
