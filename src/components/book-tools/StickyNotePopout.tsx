import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { GripVertical, PenLine, X } from 'lucide-react'

import type { InkwellProject } from '../../types'
import {
  deriveNoteMetaTitle,
  listLinkedNotesForBookInShelfOrder,
  loadProject,
  saveProject,
  totalWordsInChapters,
} from '../../lib/manuscripts'
import type { MentionItem } from '../../lib/tiptap/mentionUi'
import { ManuscriptEditor } from '../ManuscriptEditor'
import { OpenProjectInNewTabLink } from '../OpenProjectInNewTabLink'

type Props = {
  noteId: string
  /** Title of the book or note this sticky is linked from */
  bookTitle: string
  onClose: () => void
  /** Flush save, close popout, then navigate shelf to this note */
  onOpenInMainEditor: (noteId: string) => void
  /** Open another linked note in this same sticky stack */
  onOpenSiblingInPopout: (noteId: string) => void
}

const SAVE_DEBOUNCE_MS = 450

export function StickyNotePopout({
  noteId,
  bookTitle,
  onClose,
  onOpenInMainEditor,
  onOpenSiblingInPopout,
}: Props) {
  const [noteProject, setNoteProject] = useState<InkwellProject | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pos, setPos] = useState(() => ({
    x: Math.max(16, typeof window !== 'undefined' ? window.innerWidth - 460 : 400),
    y: 96,
  }))
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const persistRef = useRef<InkwellProject | null>(null)
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    persistRef.current = noteProject
  }, [noteProject])

  const flushSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const p = persistRef.current
    if (p) saveProject(p)
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoadError(null)
      setNoteProject(null)
      const loaded = loadProject(noteId)
      if (!loaded || loaded.kind !== 'note') {
        persistRef.current = null
        if (!cancelled) setLoadError(!loaded ? 'Note not found.' : 'Not a note.')
        return
      }
      persistRef.current = loaded
      if (!cancelled) setNoteProject(loaded)
    })
    return () => {
      cancelled = true
      flushSave()
    }
  }, [noteId, flushSave])

  const scheduleSave = useCallback((next: InkwellProject) => {
    persistRef.current = next
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      saveProject(next)
    }, SAVE_DEBOUNCE_MS)
  }, [])

  const onDocChange = useCallback(
    (json: JSONContent) => {
      setNoteProject((prev) => {
        if (!prev || prev.kind !== 'note') return prev
        const next: InkwellProject = {
          ...prev,
          chapters: prev.chapters.map((c, i) =>
            i === 0 ? { ...c, content: json } : c,
          ),
        }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave],
  )

  const handleClose = () => {
    flushSave()
    onClose()
  }

  const handleOpenMain = () => {
    flushSave()
    onOpenInMainEditor(noteId)
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      flushSave()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [flushSave, onClose])

  useEffect(() => {
    if (!isDragging) return
    const move = (ev: MouseEvent) => {
      const d = dragStartRef.current
      const el = panelRef.current
      const w = el?.offsetWidth ?? 420
      const h = el?.offsetHeight ?? 480
      const nx = d.px + ev.clientX - d.mx
      const ny = d.py + ev.clientY - d.my
      const maxX = Math.max(8, window.innerWidth - w - 8)
      const maxY = Math.max(8, window.innerHeight - h - 8)
      setPos({
        x: Math.min(Math.max(8, nx), maxX),
        y: Math.min(Math.max(8, ny), maxY),
      })
    }
    const up = () => setIsDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [isDragging])

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragStartRef.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    setIsDragging(true)
  }

  const title = noteProject ? deriveNoteMetaTitle(noteProject) : 'Note'
  const ch0 = noteProject?.chapters[0]

  const noteTotalWords = useMemo(
    () => (noteProject ? totalWordsInChapters(noteProject.chapters) : 0),
    [noteProject],
  )

  const shelfParentId = noteProject?.linkedBookId?.trim() || noteId

  const wikilinkMentionItems = useMemo((): MentionItem[] => {
    if (!noteProject || noteProject.kind !== 'note') return []
    const metas = listLinkedNotesForBookInShelfOrder(shelfParentId)
    const out: MentionItem[] = []
    for (const m of metas) {
      if (m.id === noteId) continue
      const p = loadProject(m.id)
      if (!p || p.kind !== 'note') continue
      const label = deriveNoteMetaTitle(p).trim() || 'Untitled note'
      out.push({ id: m.id, label })
    }
    return out.slice(0, 64)
  }, [noteProject, noteId, shelfParentId])

  const wikilinkItemsRef = useRef<MentionItem[]>([])
  useLayoutEffect(() => {
    wikilinkItemsRef.current = wikilinkMentionItems
  }, [wikilinkMentionItems])

  const mentionItems = useMemo((): MentionItem[] => {
    if (!noteProject) return []
    const items: MentionItem[] = []
    const author = noteProject.book.authorName.trim()
    if (author) items.push({ id: 'mention:author', label: author })
    const nt = noteProject.book.title.trim()
    if (nt) items.push({ id: 'mention:note', label: nt })
    const ct = noteProject.chapters[0]?.title.trim()
    if (ct) items.push({ id: 'mention:chapter', label: ct })
    if (bookTitle.trim()) items.push({ id: 'mention:linked-book', label: bookTitle.trim() })
    const metas = listLinkedNotesForBookInShelfOrder(shelfParentId)
    for (const m of metas) {
      if (m.id === noteId) continue
      const p = loadProject(m.id)
      const label =
        p?.kind === 'note' ? deriveNoteMetaTitle(p).trim() || 'Untitled note' : m.title.trim() || 'Untitled note'
      items.push({ id: `mention:note:${m.id}`, label, noteProjectId: m.id })
    }
    return items
  }, [noteProject, bookTitle, noteId, shelfParentId])

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Sticky note: ${title}`}
      className="fixed z-[102] flex w-[min(100vw-1.5rem,28rem)] flex-col overflow-hidden rounded-2xl border border-dust bg-card shadow-2xl dark:border-border-dark dark:bg-panel-dark"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex cursor-grab select-none items-center gap-2 border-b border-dust bg-dust/25 px-2 py-2 active:cursor-grabbing dark:border-border-dark dark:bg-white/5"
        onMouseDown={startDrag}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-faded" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink dark:text-ink-dark">
            {title}
          </div>
          <div className="truncate text-[11px] text-faded">
            Under “{bookTitle}” — drag to move
          </div>
        </div>
        <OpenProjectInNewTabLink
          projectId={noteId}
          label="Open note in new tab"
          variant="ghost"
          className="min-h-0 h-9 w-9 rounded-lg"
        />
        <button
          type="button"
          className="rounded-lg p-1.5 text-faded hover:bg-dust/40 hover:text-ink dark:hover:bg-white/10 dark:hover:text-ink-dark"
          title="Open note as main editor"
          onClick={(e) => {
            e.stopPropagation()
            handleOpenMain()
          }}
        >
          <PenLine className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-lg p-1.5 text-faded hover:bg-dust/40 hover:text-ink dark:hover:bg-white/10 dark:hover:text-ink-dark"
          title="Close"
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex max-h-[min(70vh,36rem)] min-h-[14rem] flex-1 flex-col overflow-hidden">
        {loadError ? (
          <div className="p-4 text-sm text-red-600 dark:text-red-400">{loadError}</div>
        ) : noteProject && ch0 ? (
          <ManuscriptEditor
            key={`${noteId}-${ch0.id}`}
            manuscriptId={ch0.id}
            content={ch0.content}
            onDocumentChange={onDocChange}
            editorRef={editorRef as MutableRefObject<Editor | null>}
            embedded
            compactFooterStats
            mentionItems={mentionItems}
            getWikilinkCandidates={() => wikilinkItemsRef.current}
            onNoteMentionClick={onOpenSiblingInPopout}
            onWikilinkClick={onOpenSiblingInPopout}
            totalBookWords={noteTotalWords}
            statsBookLabel="Entire note"
            statsScopeLabel="Note"
            wordStatStorageKey={noteId}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-faded">
            Loading…
          </div>
        )}
      </div>
    </div>
  )
}
