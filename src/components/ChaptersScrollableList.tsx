import {
  useCallback,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type UIEvent,
} from 'react'
import type { Manuscript } from '../types'
import { ManuscriptRow } from './ManuscriptRow'

type Props = {
  chapters: Manuscript[]
  currentId: number | null
  onSelectChapter: (id: number) => void
  onDeleteChapter: (id: number) => void
  onDropReorder: (draggedId: number, targetId: number) => void
  onSplitChapter?: (id: number) => void
  onMergeWithNext?: (id: number) => void
  className?: string
  /**
   * Holds the last scrollTop for this list, owned by a parent that survives `leftOverlay` remounts.
   * Without this, a remounted list resets internal refs to 0 and cannot restore after chapter pick.
   */
  persistedScrollTopRef: MutableRefObject<number>
}

/**
 * Keeps chapter list scroll position when `currentId` changes (selection) or when the parent
 * re-renders with a new React element tree — avoids jumping back to the top after picking a chapter.
 */
export function ChaptersScrollableList({
  chapters,
  currentId,
  onSelectChapter,
  onDeleteChapter,
  onDropReorder,
  onSplitChapter,
  onMergeWithNext,
  className = 'min-h-0 flex-1 touch-pan-y space-y-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-5 sm:py-5',
  persistedScrollTopRef,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null)

  const onScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      persistedScrollTopRef.current = e.currentTarget.scrollTop
    },
    [persistedScrollTopRef],
  )

  const applyPersistedScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const top = persistedScrollTopRef.current
    el.scrollTop = top
    return requestAnimationFrame(() => {
      const box = listRef.current
      if (!box) return
      if (top > 0 && Math.abs(box.scrollTop - top) > 2) box.scrollTop = top
    })
  }, [persistedScrollTopRef])

  // Remount: `leftOverlay` can rebuild without `currentId` changing (e.g. while typing).
  useLayoutEffect(() => {
    const id = applyPersistedScroll()
    return () => {
      if (typeof id === 'number') cancelAnimationFrame(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + remount only
  }, [])

  useLayoutEffect(() => {
    const id = applyPersistedScroll()
    return () => {
      if (typeof id === 'number') cancelAnimationFrame(id)
    }
  }, [currentId, applyPersistedScroll])

  const onPointerDownCapture = useCallback(() => {
    const el = listRef.current
    if (el) persistedScrollTopRef.current = el.scrollTop
  }, [persistedScrollTopRef])

  return (
    <div
      ref={listRef}
      onScroll={onScroll}
      onPointerDownCapture={onPointerDownCapture}
      className={className}
    >
      {chapters.map((ms, i) => (
        <ManuscriptRow
          key={ms.id}
          manuscript={ms}
          active={ms.id === currentId}
          onSelectChapter={onSelectChapter}
          onDeleteChapter={onDeleteChapter}
          onDropReorder={onDropReorder}
          onSplitChapter={onSplitChapter}
          onMergeWithNext={onMergeWithNext}
          canMergeWithNext={i < chapters.length - 1}
        />
      ))}
    </div>
  )
}
