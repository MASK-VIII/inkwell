import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor, JSONContent } from '@tiptap/core'
import { Feather } from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { createManuscriptTipTapExtensions } from '../lib/tiptap/manuscriptExtensions'
import type { MentionItem } from '../lib/tiptap/mentionUi'
import { ManuscriptToolbar } from './ManuscriptToolbar'

function mentionItemsEqual(a: MentionItem[], b: MentionItem[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].label !== b[i].label) return false
    if ((a[i].noteProjectId ?? '') !== (b[i].noteProjectId ?? '')) return false
  }
  return true
}

type Props = {
  manuscriptId: number
  content: JSONContent
  onDocumentChange: (json: JSONContent) => void
  editorRef: MutableRefObject<Editor | null>
  /** Slimmer word/char line for minimal chrome */
  compactFooterStats?: boolean
  /** Compact padding and editor min-height for floating popout */
  embedded?: boolean
  /** Book chapters: large centered title at top of scroll area (not sticky). */
  chapterTitle?: string
  onChapterTitleChange?: (title: string) => void
  showChapterTitleOnPage?: boolean
  /** @mention suggestion list (e.g. author, book title, chapter titles). */
  mentionItems?: MentionItem[]
  /** Sum of words across all chapters (or the whole note project). Shown when the chapter word count is clicked. */
  totalBookWords?: number
  /** Label for the whole-project word line (e.g. Entire book / Entire note). */
  statsBookLabel?: string
  /** Small caption above the count (e.g. Chapter / Note). */
  statsScopeLabel?: string
  /** Persist drag position + “keep visible” preference (e.g. project id). */
  wordStatStorageKey?: string | null
  /** Slim one-row bar for Write; full bar for popouts; `formatSplit` = Format→Ebook side-by-side (no toolbar chrome). */
  toolbarVariant?: 'writeMinimal' | 'full' | 'formatSplit'
  /** Shown in the Write toolbar next to Undo/Redo when using `writeMinimal`. */
  onOpenFindReplace?: () => void
  /** Optional overlay rendered just below the toolbar, layered over the editor shell. Used for the Write Chapters drawer. */
  leftOverlay?: ReactNode
  /** `[[` wikilink picker targets (same shape as @mention items; `id` = note project id). */
  getWikilinkCandidates?: () => MentionItem[]
  /** Click on @mention of a linked note (`noteProjectId`). */
  onNoteMentionClick?: (noteProjectId: string) => void
  /** Click on `[[wikilink]]` to a note project. */
  onWikilinkClick?: (noteProjectId: string) => void
}

/** Offset from sticky top-right anchor (negative x moves left, positive y moves down). */
function clampWordStatOffset(
  shellW: number,
  shellH: number,
  dx: number,
  dy: number,
  floatW: number,
  floatH: number,
) {
  const pad = 8
  const gutter = 12
  const minDx = -(Math.max(0, shellW - floatW - pad - gutter))
  const maxDx = 56
  const minDy = -36
  const maxDy = Math.max(minDy, shellH - floatH - pad)
  return {
    x: Math.min(Math.max(minDx, dx), maxDx),
    y: Math.min(Math.max(minDy, dy), maxDy),
  }
}

const WORDSTAT_POS_V2 = (id: string) => `inkwell-wordstat-pos-v2:${id}`
const WORDSTAT_POS_LEGACY = (id: string) => `inkwell-wordstat-pos:${id}`

function ManuscriptEditorInner({
  manuscriptId,
  content,
  onDocumentChange,
  editorRef,
  compactFooterStats,
  embedded,
  chapterTitle,
  onChapterTitleChange,
  showChapterTitleOnPage,
  mentionItems = [],
  totalBookWords,
  statsBookLabel = 'Entire book',
  statsScopeLabel = 'Chapter',
  wordStatStorageKey = null,
  toolbarVariant = 'full',
  onOpenFindReplace,
  leftOverlay,
  getWikilinkCandidates,
  onNoteMentionClick,
  onWikilinkClick,
}: Props) {
  const minimalBar = toolbarVariant === 'writeMinimal'
  const formatSplitMode = toolbarVariant === 'formatSplit'
  const [, setToolbarVersion] = useState(0)
  const bumpToolbar = useCallback(() => setToolbarVersion((v) => v + 1), [])

  const shellRef = useRef<HTMLDivElement | null>(null)
  const floatClusterRef = useRef<HTMLDivElement | null>(null)

  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null)
  const [statsPinned, setStatsPinned] = useState(true)

  const mentionItemsRef = useRef(mentionItems)
  const getWikilinkCandidatesRef = useRef(getWikilinkCandidates)
  const onNoteMentionClickRef = useRef(onNoteMentionClick)
  const onWikilinkClickRef = useRef(onWikilinkClick)

  useLayoutEffect(() => {
    mentionItemsRef.current = mentionItems
    getWikilinkCandidatesRef.current = getWikilinkCandidates
    onNoteMentionClickRef.current = onNoteMentionClick
    onWikilinkClickRef.current = onWikilinkClick
  }, [mentionItems, getWikilinkCandidates, onNoteMentionClick, onWikilinkClick])

  const dragMovedRef = useRef(false)
  const dragSessionRef = useRef<{
    originX: number
    originY: number
    startX: number
    startY: number
    shellW: number
    shellH: number
    floatW: number
    floatH: number
  } | null>(null)
  const pendingDragPosRef = useRef<{ x: number; y: number } | null>(null)

  /* eslint-disable react-hooks/refs -- TipTap extensions read refs so `useEditor` deps stay [manuscriptId]. */
  const editor = useEditor(
    {
      extensions: createManuscriptTipTapExtensions({
        getMentionItems: () => mentionItemsRef.current,
        mentionMode: 'live',
        getWikilinkCandidates: () => getWikilinkCandidatesRef.current?.() ?? [],
        wikilinkMode: 'live',
      }),
      content,
      editorProps: {
        attributes: {
          class: 'tiptap',
          spellcheck: 'true',
        },
        handleDOMEvents: {
          click: (_view, event) => {
            const el = event.target as HTMLElement | null
            if (!el?.closest) return false
            const mention = el.closest('.inkwell-mention[data-note-project-id]') as HTMLElement | null
            if (mention) {
              const id = mention.getAttribute('data-note-project-id')
              if (id && onNoteMentionClickRef.current) {
                event.preventDefault()
                event.stopPropagation()
                onNoteMentionClickRef.current(id)
                return true
              }
            }
            const wiki = el.closest('[data-inkwell-wikilink]') as HTMLElement | null
            if (wiki) {
              const id = wiki.getAttribute('data-project-id')
              if (id && onWikilinkClickRef.current) {
                event.preventDefault()
                event.stopPropagation()
                onWikilinkClickRef.current(id)
                return true
              }
            }
            return false
          },
        },
      },
      onUpdate: ({ editor }) => {
        onDocumentChange(editor.getJSON())
        // Intentionally no toolbar bump here: normal typing moves the selection,
        // so `selectionUpdate` keeps the bar in sync without double React work per key.
      },
    },
    // Mention list must NOT be a dependency: parents rebuild the array whenever project
    // state updates (each keystroke). Extensions read fresh items via getMentionItems + ref.
    [manuscriptId],
  )
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    editorRef.current = editor
    return () => {
      editorRef.current = null
    }
  }, [editor, editorRef])

  useEffect(() => {
    if (!editor) return
    const bump = () => bumpToolbar()
    editor.on('selectionUpdate', bump)
    return () => {
      editor.off('selectionUpdate', bump)
    }
  }, [editor, bumpToolbar])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!wordStatStorageKey) {
        setStatsPinned(true)
        return
      }
      try {
        setStatsPinned(localStorage.getItem(`inkwell-wordstat-pin:${wordStatStorageKey}`) !== '0')
      } catch {
        setStatsPinned(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [wordStatStorageKey])

  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const estimate = () => ({ w: floatClusterRef.current?.offsetWidth ?? 52, h: floatClusterRef.current?.offsetHeight ?? 52 })

    const initPos = () => {
      const sw = shell.clientWidth
      const sh = shell.clientHeight
      if (sw < 24 || sh < 24) return
      const { w: fw, h: fh } = estimate()

      if (wordStatStorageKey) {
        try {
          const raw2 = localStorage.getItem(WORDSTAT_POS_V2(wordStatStorageKey))
          if (raw2) {
            const { x, y } = JSON.parse(raw2) as { x: number; y: number }
            setFloatPos(clampWordStatOffset(sw, sh, x, y, fw, fh))
            return
          }
          const raw1 = localStorage.getItem(WORDSTAT_POS_LEGACY(wordStatStorageKey))
          if (raw1) {
            const { x: ox, y: oy } = JSON.parse(raw1) as { x: number; y: number }
            const migrated = {
              x: ox - (sw - fw - 12),
              y: oy - 12,
            }
            const next = clampWordStatOffset(sw, sh, migrated.x, migrated.y, fw, fh)
            setFloatPos(next)
            localStorage.setItem(WORDSTAT_POS_V2(wordStatStorageKey), JSON.stringify(next))
            localStorage.removeItem(WORDSTAT_POS_LEGACY(wordStatStorageKey))
            return
          }
        } catch {
          /* ignore */
        }
      }
      setFloatPos(clampWordStatOffset(sw, sh, 0, 0, fw, fh))
    }

    initPos()

    const ro = new ResizeObserver(() => {
      const sw = shell.clientWidth
      const sh = shell.clientHeight
      const { w: fw, h: fh } = estimate()
      setFloatPos((p) => {
        if (!p) return clampWordStatOffset(sw, sh, 0, 0, fw, fh)
        return clampWordStatOffset(sw, sh, p.x, p.y, fw, fh)
      })
    })
    ro.observe(shell)
    return () => ro.disconnect()
  }, [wordStatStorageKey])

  const words = editor ? editor.storage.characterCount.words() : 0
  const minutes = words === 0 ? 0 : Math.max(1, Math.round(words / 200))
  const bookWords =
    typeof totalBookWords === 'number' && Number.isFinite(totalBookWords) ? Math.max(0, totalBookWords) : null

  const toggleWordstatPinned = useCallback(() => {
    setStatsPinned((prev) => {
      const next = !prev
      if (wordStatStorageKey) {
        try {
          localStorage.setItem(`inkwell-wordstat-pin:${wordStatStorageKey}`, next ? '1' : '0')
        } catch {
          /* ignore */
        }
      }
      return next
    })
  }, [wordStatStorageKey])

  const onWordstatPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || !shellRef.current || floatPos === null) return
      const shellEl = shellRef.current
      const fr = floatClusterRef.current?.getBoundingClientRect()
      if (!fr) return
      dragMovedRef.current = false
      pendingDragPosRef.current = null
      dragSessionRef.current = {
        originX: floatPos.x,
        originY: floatPos.y,
        startX: e.clientX,
        startY: e.clientY,
        shellW: shellEl.clientWidth,
        shellH: shellEl.clientHeight,
        floatW: fr.width,
        floatH: fr.height,
      }
      e.currentTarget.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const s = dragSessionRef.current
        if (!s) return
        const dx = ev.clientX - s.startX
        const dy = ev.clientY - s.startY
        if (Math.abs(dx) + Math.abs(dy) > 6) dragMovedRef.current = true
        const nx = s.originX + dx
        const ny = s.originY + dy
        const next = clampWordStatOffset(s.shellW, s.shellH, nx, ny, s.floatW, s.floatH)
        pendingDragPosRef.current = next
        setFloatPos(next)
      }

      const onUp = (ev: PointerEvent) => {
        try {
          e.currentTarget.releasePointerCapture(ev.pointerId)
        } catch {
          /* ignore */
        }
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        dragSessionRef.current = null

        if (!dragMovedRef.current) {
          toggleWordstatPinned()
        } else if (wordStatStorageKey && pendingDragPosRef.current) {
          try {
            localStorage.setItem(
              WORDSTAT_POS_V2(wordStatStorageKey),
              JSON.stringify(pendingDragPosRef.current),
            )
          } catch {
            /* ignore */
          }
        }
        pendingDragPosRef.current = null
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [floatPos, wordStatStorageKey, toggleWordstatPinned],
  )

  const shellPad =
    formatSplitMode ? 'px-4 pt-4 pb-6 sm:px-5 sm:pt-5 sm:pb-8'
    : embedded ? 'p-3 sm:p-4'
    : 'p-6 sm:p-12'
  const editorMinH =
    formatSplitMode ? 'min-h-[10rem]'
    : embedded ? 'min-h-[9rem]'
    : 'min-h-[50vh]'

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-inkwell-tour="editor-toolbar"
      {...(formatSplitMode ? { 'data-inkwell-format-split': true } : {})}
    >
      {!formatSplitMode ?
        <ManuscriptToolbar
          manuscriptId={manuscriptId}
          editor={editor}
          minimalBar={minimalBar}
          embedded={embedded}
          bumpToolbar={bumpToolbar}
          onOpenFindReplace={onOpenFindReplace}
        />
      : null}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {leftOverlay}
      <div
        ref={shellRef}
        className={`inkwell-editor-shell relative min-h-0 flex-1 overflow-auto ${shellPad} ${formatSplitMode ? 'inkwell-editor-shell--format-split' : ''}`}
      >
        {floatPos !== null && !formatSplitMode ? (
          <div className="sticky top-2 z-30 flex h-0 w-full justify-end overflow-visible pr-2 pt-1 pointer-events-none">
            <div
              ref={floatClusterRef}
              className="inkwell-wordstat-float-root pointer-events-auto flex flex-col items-end gap-1.5"
              style={{ transform: `translate3d(${floatPos.x}px, ${floatPos.y}px, 0)` }}
            >
              {statsPinned ? (
                <div className="inkwell-wordstat-pill max-w-[min(100vw-2rem,18rem)] rounded-xl border border-dust/65 bg-parchment/96 px-2.5 py-2 text-right shadow-md backdrop-blur-md dark:border-border-dark/75 dark:bg-panel-dark/96">
                  <div className="text-[11px] leading-snug sm:text-xs">
                    <span className="font-semibold tabular-nums text-walnut dark:text-accent-warm">
                      {words.toLocaleString()}
                    </span>
                    <span className="text-ink/55 dark:text-ink-dark/55"> words · </span>
                    <span className="text-ink/45 dark:text-ink-dark/45">{statsScopeLabel}</span>
                  </div>
                  {bookWords != null ? (
                    <div className="mt-1 text-[11px] leading-snug sm:text-xs">
                      <span className="font-semibold tabular-nums text-walnut dark:text-accent-warm">
                        {bookWords.toLocaleString()}
                      </span>
                      <span className="text-ink/55 dark:text-ink-dark/55"> words · </span>
                      <span className="text-ink/45 dark:text-ink-dark/45">{statsBookLabel}</span>
                    </div>
                  ) : null}
                  {!compactFooterStats && words > 0 ? (
                    <div className="mt-1 text-[10px] text-ink/45 dark:text-ink-dark/45">~{minutes} min read</div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                aria-pressed={statsPinned}
                aria-label={
                  statsPinned ? 'Hide word counts · drag to move' : 'Show word counts · drag to move'
                }
                title="Click to show or hide counts · Drag to move · Stays at top while scrolling"
                onPointerDown={onWordstatPointerDown}
                className={`inkwell-wordstat-float-btn flex h-11 w-11 cursor-grab items-center justify-center rounded-2xl backdrop-blur-md active:cursor-grabbing ${
                  statsPinned ? 'ring-2 ring-walnut/35 ring-offset-2 ring-offset-parchment dark:ring-accent-warm/45 dark:ring-offset-panel-dark' : ''
                }`}
              >
                <Feather className="h-5 w-5 text-walnut dark:text-accent-warm" strokeWidth={2} />
              </button>
            </div>
          </div>
        ) : null}
        {showChapterTitleOnPage && onChapterTitleChange ? (
          <div
            className={`mx-auto max-w-[720px] ${
              formatSplitMode ? 'mb-3 px-1 sm:mb-4' : embedded ? 'mb-5 px-1' : 'mb-8 px-2 sm:px-4'
            }`}
          >
            <label className="sr-only" htmlFor={`inkwell-chapter-title-${manuscriptId}`}>
              Chapter title
            </label>
            <input
              id={`inkwell-chapter-title-${manuscriptId}`}
              type="text"
              value={chapterTitle ?? ''}
              onChange={(e) => onChapterTitleChange(e.target.value)}
              placeholder="Chapter title"
              className="w-full bg-transparent text-center font-serif text-2xl font-semibold tracking-tight text-ink placeholder:text-ink/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:text-ink-dark dark:placeholder:text-ink-dark/35 dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark sm:text-4xl sm:leading-tight"
            />
          </div>
        ) : null}
        {editor ? (
          <EditorContent editor={editor} className={`h-full ${editorMinH}`} />
        ) : (
          <div
            className={`mx-auto max-w-[720px] animate-pulse rounded-xl bg-dust/20 dark:bg-border-dark/30 ${
              formatSplitMode ? 'min-h-[10rem]' : embedded ? 'min-h-[9rem]' : 'min-h-[40vh]'
            }`}
          />
        )}
      </div>
      </div>
    </div>
  )
}

/** Skips re-renders when parent refreshes `content` every keystroke; TipTap owns the live document. */
export const ManuscriptEditor = memo(ManuscriptEditorInner, (prev, next) => {
  return (
    prev.manuscriptId === next.manuscriptId &&
    prev.onDocumentChange === next.onDocumentChange &&
    prev.editorRef === next.editorRef &&
    prev.compactFooterStats === next.compactFooterStats &&
    prev.embedded === next.embedded &&
    prev.chapterTitle === next.chapterTitle &&
    prev.onChapterTitleChange === next.onChapterTitleChange &&
    prev.showChapterTitleOnPage === next.showChapterTitleOnPage &&
    mentionItemsEqual(prev.mentionItems ?? [], next.mentionItems ?? []) &&
    prev.totalBookWords === next.totalBookWords &&
    prev.statsBookLabel === next.statsBookLabel &&
    prev.statsScopeLabel === next.statsScopeLabel &&
    prev.wordStatStorageKey === next.wordStatStorageKey &&
    prev.toolbarVariant === next.toolbarVariant &&
    prev.onOpenFindReplace === next.onOpenFindReplace &&
    prev.leftOverlay === next.leftOverlay &&
    prev.getWikilinkCandidates === next.getWikilinkCandidates &&
    prev.onNoteMentionClick === next.onNoteMentionClick &&
    prev.onWikilinkClick === next.onWikilinkClick
  )
})
