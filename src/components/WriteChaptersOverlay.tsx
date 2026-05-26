import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { MutableRefObject, TransitionEvent } from 'react'
import type { Manuscript } from '../types'
import { FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS, FORMAT_WORKSPACE_SIDE_RAIL_WIDTH_CLASS } from '../lib/formatWorkspaceLayout'
import { ChaptersScrollableList } from './ChaptersScrollableList'

type Props = {
  chaptersAsideCollapsed: boolean
  chaptersPanelMotionLive: boolean
  isMobile: boolean
  chapters: Manuscript[]
  currentId: number | null
  persistedScrollTopRef: MutableRefObject<number>
  onExpand: () => void
  onCollapse: () => void
  onCreateChapter: () => void
  onSelectChapter: (id: number) => void
  onDeleteChapter: (id: number) => void
  onDropReorder: (draggedId: number, targetId: number) => void
  onSplitChapter?: (id: number) => void
  onMergeWithNext?: (id: number) => void
  onPanelTransitionEnd: (e: TransitionEvent<HTMLElement>) => void
}

/** Write-route chapters drawer; rendered as a sibling of ManuscriptEditor so typing idle flushes do not remount the editor shell. */
export function WriteChaptersOverlay({
  chaptersAsideCollapsed,
  chaptersPanelMotionLive,
  isMobile,
  chapters,
  currentId,
  persistedScrollTopRef,
  onExpand,
  onCollapse,
  onCreateChapter,
  onSelectChapter,
  onDeleteChapter,
  onDropReorder,
  onSplitChapter,
  onMergeWithNext,
  onPanelTransitionEnd,
}: Props) {
  if (isMobile && chaptersAsideCollapsed) return null

  return (
    <div
      data-inkwell-tour="write-chapters"
      className={`inkwell-chapters-overlay-clip ${FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS} pointer-events-none absolute left-0 top-0 z-40 isolate h-full min-w-0 shrink-0 overflow-hidden ${
        chaptersAsideCollapsed ? 'inkwell-chapters-overlay-clip--collapsed' : 'inkwell-chapters-overlay-clip--expanded'
      }`}
    >
      <aside
        className={`inkwell-chapters-overlay-rail pointer-events-auto absolute left-0 top-0 z-20 flex h-full shrink-0 flex-col items-center gap-2 rounded-r-2xl border-r border-dust bg-panel-light-strong/92 py-3 shadow-xl backdrop-blur-sm dark:border-border-dark dark:bg-panel-dark/90 sm:py-4 ${FORMAT_WORKSPACE_SIDE_RAIL_WIDTH_CLASS}${chaptersPanelMotionLive ? ' inkwell-panel-motion--live' : ''}`}
      >
        <button
          type="button"
          onClick={onExpand}
          className="inkwell-btn-icon-sm"
          aria-label="Expand chapters list"
          title="Show chapters"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={onCreateChapter}
          className="inkwell-btn-chapter-new-sm"
          aria-label="New chapter"
          title="New chapter"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </aside>
      <aside
        className={`inkwell-chapters-overlay-panel absolute left-0 top-0 z-10 flex h-full shrink-0 flex-col rounded-r-2xl border-r border-dust bg-panel-light-strong/92 shadow-2xl backdrop-blur-sm dark:border-border-dark dark:bg-panel-dark/90 ${FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS}${chaptersPanelMotionLive ? ' inkwell-panel-motion--live' : ''}`}
        onTransitionEnd={onPanelTransitionEnd}
      >
        <div className="flex items-center gap-1.5 border-b border-dust px-3 py-3 dark:border-border-dark sm:gap-2 sm:px-5 sm:py-5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              Chapters
            </h2>
            <button
              type="button"
              onClick={onCreateChapter}
              className="inkwell-btn-chapter-new-xs"
              aria-label="New chapter"
              title="New chapter"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
          <button
            type="button"
            onClick={onCollapse}
            className="inkwell-btn-icon-xs"
            aria-label="Collapse chapters list"
            title="Collapse chapters · focus column"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
        <ChaptersScrollableList
          bookMode
          chapters={chapters}
          currentId={currentId}
          onSelectChapter={onSelectChapter}
          onDeleteChapter={onDeleteChapter}
          onDropReorder={onDropReorder}
          onSplitChapter={onSplitChapter}
          onMergeWithNext={onMergeWithNext}
          persistedScrollTopRef={persistedScrollTopRef}
        />
        <p className="mt-auto border-t border-dust px-3 py-3 text-[11px] leading-snug text-ink/55 dark:border-border-dark dark:text-ink-dark/55 sm:px-5">
          Drag a section by its book icon. Split uses the cursor position in the open section.
        </p>
      </aside>
    </div>
  )
}
