import { Pin, PinOff, Trash2 } from 'lucide-react'
import type { Dispatch, DragEvent, MutableRefObject, ReactNode, SetStateAction } from 'react'
import type { ProjectMeta } from '../types'
import {
  buildInkwellUrlForProject,
  getPinnedChildNoteIdsForProject,
  loadProject,
  pinChildNoteInProject,
  reorderPinnedChildNotesInProject,
  reorderUnpinnedChildNotesInProject,
  unpinChildNoteInProject,
} from '../lib/manuscripts'
import { readShelfDragNoteId } from '../lib/shelfDrag'

export type ShelfLinkedNotesListProps = {
  masterId: string
  kidsOrdered: ProjectMeta[]
  parentLabel: 'project' | 'book'
  shelfProjectChildDropTarget: {
    masterId: string
    targetId: string
    place: 'before' | 'after'
  } | null
  setShelfProjectChildDropTarget: Dispatch<
    SetStateAction<{
      masterId: string
      targetId: string
      place: 'before' | 'after'
    } | null>
  >
  shelfDraggingNoteIdRef: MutableRefObject<string | null>
  onLinkedNoteOpen: (noteId: string) => void
  setShelfUiTick: Dispatch<SetStateAction<number>>
  setShelfDropHoverAttachId: Dispatch<SetStateAction<string | null>>
  setShelfDropHoverNotesSection: Dispatch<SetStateAction<boolean>>
  setShelfDropHoverProjectsSection: Dispatch<SetStateAction<boolean>>
  moveNoteUnderParent: (noteId: string, parentId: string) => boolean
  showToast: (node: ReactNode, ms?: number) => void
  shelfNoteDragStart: (e: DragEvent, noteId: string, previewTitle: string) => void
  shelfNoteDragEnd: (e: DragEvent) => void
  setShelfPinRev: Dispatch<SetStateAction<number>>
  onDeleteLinkedNote: (noteId: string) => void
}

export function ShelfLinkedNotesList({
  masterId,
  kidsOrdered,
  parentLabel,
  shelfProjectChildDropTarget,
  setShelfProjectChildDropTarget,
  shelfDraggingNoteIdRef,
  onLinkedNoteOpen,
  setShelfUiTick,
  setShelfDropHoverAttachId,
  setShelfDropHoverNotesSection,
  setShelfDropHoverProjectsSection,
  moveNoteUnderParent,
  showToast,
  shelfNoteDragStart,
  shelfNoteDragEnd,
  setShelfPinRev,
  onDeleteLinkedNote,
}: ShelfLinkedNotesListProps) {
  const kidById = new Map(kidsOrdered.map((k) => [k.id, k]))
  const pinnedOrder = getPinnedChildNoteIdsForProject(masterId)
  const pinnedSet = new Set(pinnedOrder)
  const pinnedKids = pinnedOrder
    .map((id) => kidById.get(id))
    .filter((k): k is ProjectMeta => k != null)
  const unpinnedKids = kidsOrdered.filter((k) => !pinnedSet.has(k.id))

  const pinTitle = parentLabel === 'book' ? 'Pin to top of book list' : 'Pin under master'
  const unpinTitle = parentLabel === 'book' ? 'Unpin from top of book list' : 'Unpin from top of project'

  const childRow = (n: ProjectMeta, pinnedInProject: boolean) => {
    const dropHint =
      shelfProjectChildDropTarget &&
      shelfProjectChildDropTarget.masterId === masterId &&
      shelfProjectChildDropTarget.targetId === n.id
        ? shelfProjectChildDropTarget.place
        : null
    return (
      <li
        key={n.id}
        onDragOver={(e) => {
          const dragId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
          if (!dragId || dragId === n.id) return
          const dragProj = loadProject(dragId)
          if (!dragProj || dragProj.kind !== 'note' || dragProj.linkedBookId !== masterId) return
          const dragPinned = getPinnedChildNoteIdsForProject(masterId).includes(dragId)
          if (dragPinned !== pinnedInProject) return
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'move'
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const place = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          setShelfProjectChildDropTarget({
            masterId,
            targetId: n.id,
            place,
          })
        }}
        onDragLeave={(e) => {
          const next = e.relatedTarget as Node | null
          if (next && (e.currentTarget as HTMLElement).contains(next)) return
          setShelfProjectChildDropTarget((cur) =>
            cur && cur.masterId === masterId && cur.targetId === n.id ? null : cur,
          )
        }}
        onDrop={(e) => {
          e.stopPropagation()
          e.preventDefault()
          const noteId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
          const place: 'before' | 'after' =
            shelfProjectChildDropTarget &&
            shelfProjectChildDropTarget.masterId === masterId &&
            shelfProjectChildDropTarget.targetId === n.id
              ? shelfProjectChildDropTarget.place
              : 'before'
          shelfDraggingNoteIdRef.current = null
          setShelfProjectChildDropTarget(null)
          setShelfDropHoverAttachId(null)
          setShelfDropHoverNotesSection(false)
          setShelfDropHoverProjectsSection(false)
          if (!noteId) return
          const drag = loadProject(noteId)
          if (!drag || drag.kind !== 'note') return

          if (drag.linkedBookId === masterId) {
            const dragPinned = getPinnedChildNoteIdsForProject(masterId).includes(noteId)
            if (dragPinned === pinnedInProject && noteId !== n.id) {
              if (pinnedInProject) {
                reorderPinnedChildNotesInProject(masterId, noteId, n.id, place)
              } else {
                reorderUnpinnedChildNotesInProject(masterId, noteId, n.id, place)
              }
              setShelfUiTick((x) => x + 1)
            }
            return
          }

          if (!moveNoteUnderParent(noteId, masterId)) return
          showToast('Note attached')
          setShelfUiTick((x) => x + 1)
        }}
        className={`rounded-2xl ${dropHint === 'before' ? 'border-t-2 border-walnut dark:border-accent-warm' : ''} ${dropHint === 'after' ? 'border-b-2 border-walnut dark:border-accent-warm' : ''}`}
      >
        <div className="flex items-stretch gap-1 rounded-2xl pr-1 outline-none hover:bg-dust/35 dark:hover:bg-border-dark/45 focus-within:ring-2 focus-within:ring-cream focus-within:ring-offset-2 focus-within:ring-offset-parchment dark:focus-within:ring-cream dark:focus-within:ring-offset-panel-dark">
          <a
            draggable
            href={buildInkwellUrlForProject(n.id)}
            title={
              parentLabel === 'book'
                ? 'Drag to reorder under this book, or onto a book, project, note, or Notes'
                : 'Drag to reorder in this project, or onto a book, project, note, or Notes'
            }
            aria-label={`Note: ${n.title || 'Untitled note'}. Drag to move, or activate to open.`}
            onDragStart={(e) => shelfNoteDragStart(e, n.id, n.title || 'Untitled note')}
            onDragEnd={shelfNoteDragEnd}
            className="min-w-0 flex-1 cursor-grab rounded-2xl px-3 py-2 text-left outline-none active:cursor-grabbing"
            onClick={(e) => {
              e.preventDefault()
              onLinkedNoteOpen(n.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onLinkedNoteOpen(n.id)
              }
            }}
          >
            <span className="flex items-center gap-2">
              <span className="block min-w-0 flex-1 truncate text-sm font-medium text-ink dark:text-ink-dark">
                {n.title || 'Untitled note'}
              </span>
              {pinnedInProject ? (
                <span className="shrink-0 rounded-full bg-dust/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-walnut dark:bg-border-dark/55 dark:text-accent-warm">
                  Pinned
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-[11px] font-normal text-ink/45 dark:text-ink-dark/45">
              Updated {new Date(n.updatedAt).toLocaleString()}
            </span>
          </a>
          <button
            type="button"
            title={pinnedInProject ? unpinTitle : pinTitle}
            aria-pressed={pinnedInProject}
            className="flex shrink-0 items-center justify-center rounded-xl px-2 text-ink/50 hover:bg-dust/50 hover:text-ink dark:text-ink-dark/50 dark:hover:bg-border-dark/50 dark:hover:text-ink-dark"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (pinnedInProject) unpinChildNoteInProject(masterId, n.id)
              else pinChildNoteInProject(masterId, n.id)
              setShelfPinRev((x) => x + 1)
            }}
          >
            {pinnedInProject ? (
              <PinOff className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <Pin className="h-4 w-4" strokeWidth={2.25} />
            )}
          </button>
          <button
            type="button"
            title="Delete note from this device"
            aria-label={`Delete note ${n.title || 'Untitled note'}`}
            className="flex shrink-0 items-center justify-center rounded-xl px-2 text-ink/50 hover:bg-red-500/10 hover:text-red-600 dark:text-ink-dark/50 dark:hover:bg-red-400/10 dark:hover:text-red-400"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onDeleteLinkedNote(n.id)
            }}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-3">
      {pinnedKids.length > 0 ? (
        <div>
          <div className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink/45 dark:text-ink-dark/45">
            Pinned
          </div>
          <ul className="space-y-1 px-2">{pinnedKids.map((n) => childRow(n, true))}</ul>
        </div>
      ) : null}
      {unpinnedKids.length > 0 ? (
        <ul className="space-y-1 px-2">{unpinnedKids.map((n) => childRow(n, false))}</ul>
      ) : null}
    </div>
  )
}
