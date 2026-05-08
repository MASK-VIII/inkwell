import type { Editor } from '@tiptap/core'
import {
  closestCorners,
  defaultDropAnimation,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ALargeSmall,
  AtSign,
  Bold,
  ChevronDown,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquare,
  Minus,
  NotebookPen,
  Quote,
  Redo2,
  Search,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  defaultToolbarLayout,
  loadToolbarLayout,
  saveToolbarLayout,
  type ToolbarLayoutState,
  type ToolbarRowEntry,
} from '../lib/editorToolbarLayout'
import { SCENE_BREAK_OPTIONS } from '../lib/sceneBreakCatalog'

const HEADINGS = [
  { value: '', label: 'Normal text' },
  { value: '1', label: 'Heading 1 — Large & stately' },
  { value: '2', label: 'Heading 2 — Chapter title' },
  { value: '3', label: 'Heading 3 — Section break' },
] as const

function headingSelectValue(editor: Editor): string {
  if (editor.isActive('heading', { level: 1 })) return '1'
  if (editor.isActive('heading', { level: 2 })) return '2'
  if (editor.isActive('heading', { level: 3 })) return '3'
  return ''
}

function isTextAlignActive(editor: Editor, alignment: 'left' | 'center' | 'right' | 'justify'): boolean {
  if (alignment === 'left') {
    return !(['center', 'right', 'justify'] as const).some((a) => editor.isActive({ textAlign: a }))
  }
  return editor.isActive({ textAlign: alignment })
}

function chainToggleList(editor: Editor, kind: 'bullet' | 'ordered') {
  const c = editor.chain().focus()
  if (editor.isActive('heading')) {
    return kind === 'bullet' ? c.setParagraph().toggleBulletList().run() : c.setParagraph().toggleOrderedList().run()
  }
  return kind === 'bullet' ? c.toggleBulletList().run() : c.toggleOrderedList().run()
}

function parseSortableId(id: string): { zone: 'primary' | 'overflow'; index: number } | null {
  const parts = id.split(':')
  if (parts.length !== 2) return null
  const [z, idxStr] = parts
  if (z !== 'primary' && z !== 'overflow') return null
  const index = Number(idxStr)
  if (!Number.isFinite(index)) return null
  return { zone: z, index }
}

function newFootnoteId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `fn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function countFootnoteMarkers(doc: Editor['state']['doc']): number {
  let n = 0
  doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === 'writerFootnote')) n += 1
  })
  return n
}

export type ManuscriptToolbarProps = {
  manuscriptId: number
  editor: Editor | null
  minimalBar: boolean
  embedded?: boolean
  bumpToolbar: () => void
  onOpenFindReplace?: () => void
}

const OVERFLOW_DROP_ID = 'overflow-zone'

const PRIMARY_SORTABLE_RE = /^primary:\d+$/
const OVERFLOW_SORTABLE_RE = /^overflow:\d+$/

function mergeOverflowPanelPointerCollision(
  collisions: ReturnType<typeof pointerWithin>,
  panelEl: HTMLElement | null,
  pointer: { x: number; y: number } | null,
) {
  if (!panelEl || !pointer) return collisions
  const r = panelEl.getBoundingClientRect()
  if (pointer.x < r.left || pointer.x > r.right || pointer.y < r.top || pointer.y > r.bottom) return collisions
  if (collisions.some((c) => String(c.id) === OVERFLOW_DROP_ID)) return collisions
  return [...collisions, { id: OVERFLOW_DROP_ID }]
}

/**
 * `closestCorners` often misses parent droppables; prefer targets under the pointer.
 * The overflow droppable node can measure only the “More” button while the menu is `position:absolute`;
 * `overflowPanelEl` is the real panel box so drops still hit `overflow-zone`.
 * Dragging from More: prefer primary-bar sortables so moving tools back onto the bar feels responsive.
 *
 * Dragging from the primary bar toward “More”: the pointer often leaves every icon’s box before it enters
 * the overflow panel. If we only return `overflow-zone` then, `over` is not a primary sortable and the bar
 * stops doing sibling slide animations. While the pointer is NOT inside the overflow panel, keep resolving
 * to the closest primary slot so the row keeps the same motion as in-bar reordering.
 */
function createToolbarCollisionDetection(overflowPanelEl: HTMLElement | null): CollisionDetection {
  return (args) => {
    let pointerCollisions = pointerWithin(args)
    pointerCollisions = mergeOverflowPanelPointerCollision(pointerCollisions, overflowPanelEl, args.pointerCoordinates)

    const activeId = String(args.active.id)
    const fromOverflow = OVERFLOW_SORTABLE_RE.test(activeId)
    const fromPrimary = PRIMARY_SORTABLE_RE.test(activeId)

    const sortableHits = pointerCollisions.filter((c) => {
      const id = String(c.id)
      return PRIMARY_SORTABLE_RE.test(id) || OVERFLOW_SORTABLE_RE.test(id)
    })

    if (fromOverflow && sortableHits.length > 0) {
      const primaryOnly = sortableHits.filter((c) => PRIMARY_SORTABLE_RE.test(String(c.id)))
      if (primaryOnly.length > 0) return primaryOnly
    }

    if (sortableHits.length > 0) return sortableHits

    const cc = closestCorners(args)

    if (fromPrimary) {
      const pointer = args.pointerCoordinates
      let overOverflowPanel = false
      if (overflowPanelEl && pointer) {
        const r = overflowPanelEl.getBoundingClientRect()
        overOverflowPanel =
          pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom
      }

      const primaryCc = cc.filter((c) => PRIMARY_SORTABLE_RE.test(String(c.id)))

      /** Pointer is on the More / overflow droppable chrome (incl. button) but not on a primary icon — keep real overflow target for drop. */
      const onOverflowChromeOnly =
        pointerCollisions.length > 0 &&
        sortableHits.length === 0 &&
        pointerCollisions.some((c) => String(c.id) === OVERFLOW_DROP_ID)

      // Gaps between icons, empty space below the row, or approach toward More before hitting its droppable:
      // resolve closest primary slot so the bar keeps the same sibling slide animation as in-bar reordering.
      if (!onOverflowChromeOnly && !overOverflowPanel && primaryCc.length > 0) return primaryCc
    }

    if (pointerCollisions.length > 0) return pointerCollisions
    return cc
  }
}

const SORTABLE_TRANSITION = {
  duration: 170,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const

const TOOLBAR_DROP_ANIMATION: DropAnimation = {
  ...defaultDropAnimation,
  duration: 180,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
}

/** Matches main-toolbar controls: icon-only, no “MOVE / label” pill (esp. when dragging out of More). */
function ToolbarDragIconPreview({ entry }: { entry: ToolbarRowEntry }) {
  const sw = 2.25
  const icon = (() => {
    switch (entry) {
      case 'divider':
        return <div className="h-6 w-px shrink-0 bg-ink/55 dark:bg-ink-dark/60" />
      case 'heading':
        return <Type className="h-4 w-4" strokeWidth={sw} />
      case 'bold':
        return <Bold className="h-4 w-4" strokeWidth={sw} />
      case 'italic':
        return <Italic className="h-4 w-4" strokeWidth={sw} />
      case 'underline':
        return <UnderlineIcon className="h-4 w-4" strokeWidth={sw} />
      case 'strikethrough':
        return <Strikethrough className="h-4 w-4" strokeWidth={sw} />
      case 'bulletList':
        return <List className="h-4 w-4" strokeWidth={sw} />
      case 'orderedList':
        return <ListOrdered className="h-4 w-4" strokeWidth={sw} />
      case 'blockquote':
        return <Quote className="h-4 w-4" strokeWidth={sw} />
      case 'dropCap':
        return <ALargeSmall className="h-4 w-4" strokeWidth={sw} />
      case 'align':
        return <AlignCenter className="h-4 w-4" strokeWidth={sw} />
      case 'link':
        return <Link2 className="h-4 w-4" strokeWidth={sw} />
      case 'sceneBreak':
        return <Minus className="h-4 w-4" strokeWidth={sw} />
      case 'image':
        return <ImagePlus className="h-4 w-4" strokeWidth={sw} />
      case 'comment':
        return <MessageSquare className="h-4 w-4" strokeWidth={sw} />
      case 'footnote':
        return <NotebookPen className="h-4 w-4" strokeWidth={sw} />
      case 'mention':
        return <AtSign className="h-4 w-4" strokeWidth={sw} />
      default:
        return null
    }
  })()

  return (
    <div
      className="pointer-events-none flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-dust bg-parchment/98 text-ink shadow-2xl ring-2 ring-walnut/35 dark:border-border-dark dark:bg-panel-dark/98 dark:text-ink-dark dark:ring-accent-warm/45"
      aria-hidden
    >
      {icon}
    </div>
  )
}

function toolBtnClass(active: boolean) {
  return `flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-colors duration-150 ${
    active
      ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
      : 'text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50'
  }`
}

/** Surface only — position via fixed coords from anchor (see ToolbarAnchoredPopover). */
const PANEL_POPOVER_SURFACE_CLASS =
  'flex min-w-[min(18rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl border border-dust bg-parchment p-3 shadow-lg ring-1 ring-black/5 dark:border-border-dark dark:bg-panel-dark dark:ring-white/10'

function ToolbarAnchoredPopover({
  open,
  anchorRef,
  panelRef,
  children,
}: {
  open: boolean
  anchorRef: MutableRefObject<HTMLElement | null>
  panelRef: MutableRefObject<HTMLDivElement | null>
  children: React.ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const update = () => {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef])

  if (!open || pos === null) return null

  return createPortal(
    <div
      ref={panelRef}
      className={`${PANEL_POPOVER_SURFACE_CLASS} z-[80]`}
      style={{ position: 'fixed', top: pos.top, right: pos.right }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

const MORE_PANEL_CLASS =
  'absolute right-0 top-full z-50 mt-2 flex max-h-[min(70vh,28rem)] w-[min(calc(100vw-2rem),36rem)] flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl border border-dust bg-parchment p-3 shadow-xl ring-1 ring-black/5 dark:border-border-dark dark:bg-panel-dark dark:ring-white/10'

const MORE_BUTTON_CLASS =
  'flex h-9 cursor-pointer list-none items-center gap-1 rounded-2xl px-3 text-sm font-medium text-ink transition-colors hover:bg-dust/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:text-ink-dark dark:hover:bg-border-dark/50 dark:focus-visible:ring-accent-warm/40 dark:focus-visible:ring-offset-panel-dark'

/** Non-customize: overflow tools only — same dropdown as customize mode for a consistent “More” control. */
function MoreToolbarOverflowUse({
  moreOpen,
  setMoreOpen,
  moreWrapRef,
  overflow,
  renderTool,
  menuId,
}: {
  moreOpen: boolean
  setMoreOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  moreWrapRef: MutableRefObject<HTMLDivElement | null>
  overflow: ToolbarRowEntry[]
  renderTool: (entry: ToolbarRowEntry, opts: { moreVariant?: boolean }) => ReactNode
  menuId: string
}) {
  return (
    <div ref={moreWrapRef} className="relative inline-flex w-fit shrink-0">
      <button
        type="button"
        className={MORE_BUTTON_CLASS}
        aria-expanded={moreOpen}
        aria-haspopup="true"
        aria-controls={`${menuId}-panel`}
        id={`${menuId}-trigger`}
        onClick={() => setMoreOpen((v) => !v)}
      >
        More
        <ChevronDown
          className={`h-4 w-4 opacity-70 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}
          strokeWidth={2.25}
        />
      </button>
      {moreOpen ? (
        <div
          id={`${menuId}-panel`}
          role="region"
          aria-labelledby={`${menuId}-trigger`}
          className={MORE_PANEL_CLASS}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-medium text-ink/65 dark:text-ink-dark/65">
            {overflow.length > 0
              ? 'Tools not shown on the main bar — same layout in Customize.'
              : 'Nothing in More yet. Open Customize toolbar to move tools here.'}
          </p>
          <div
            className={`flex flex-col gap-3 ${overflow.length === 0 ? 'min-h-[4.5rem] justify-center rounded-xl border border-dashed border-dust/60 dark:border-border-dark/70' : ''}`}
          >
            {overflow.map((entry, idx) => (
              <div key={`overflow-${idx}-${entry}`} className="flex flex-col">
                {renderTool(entry, { moreVariant: true })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Customize: droppable wrapper + sortable overflow list inside the dropdown (drop on button/panel). */
function MoreToolbarOverflowCustomize({
  moreOpen,
  setMoreOpen,
  moreWrapRef,
  overflow,
  overflowIds,
  renderTool,
  customizing,
  menuId,
  onOverflowPanelNode,
  dropHighlight,
}: {
  moreOpen: boolean
  setMoreOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  moreWrapRef: MutableRefObject<HTMLDivElement | null>
  overflow: ToolbarRowEntry[]
  overflowIds: string[]
  renderTool: (entry: ToolbarRowEntry, opts?: { moreVariant?: boolean }) => ReactNode
  customizing: boolean
  menuId: string
  /** Absolute panel box — used so collision detection matches the visible drop zone (droppable ref stays on the button-sized wrapper). */
  onOverflowPanelNode?: (node: HTMLDivElement | null) => void
  /** Another control is being dragged over the More / overflow area. */
  dropHighlight: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: OVERFLOW_DROP_ID,
    data: { type: 'overflow-zone' },
  })

  const setCombinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      moreWrapRef.current = node
    },
    [setNodeRef, moreWrapRef],
  )

  const panelRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      onOverflowPanelNode?.(node)
    },
    [onOverflowPanelNode],
  )

  const moreDropActive = isOver || dropHighlight

  return (
    <div
      ref={setCombinedRef}
      className={`relative inline-flex w-fit shrink-0 rounded-xl transition-[box-shadow,background-color,ring-color] duration-150 ${
        moreDropActive
          ? 'bg-walnut/10 ring-2 ring-accent-warm/55 ring-offset-2 ring-offset-parchment shadow-[0_0_24px_-4px_rgba(217,164,65,0.45)] dark:bg-accent-warm/15 dark:ring-accent-warm/50 dark:ring-offset-panel-dark dark:shadow-[0_0_28px_-4px_rgba(217,164,65,0.35)]'
          : ''
      }`}
    >
      <button
        type="button"
        className={MORE_BUTTON_CLASS}
        aria-expanded={moreOpen}
        aria-haspopup="true"
        aria-controls={`${menuId}-panel`}
        id={`${menuId}-trigger`}
        onClick={() => setMoreOpen((v) => !v)}
      >
        More
        <ChevronDown
          className={`h-4 w-4 opacity-70 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}
          strokeWidth={2.25}
        />
      </button>
      {moreOpen ? (
        <div
          ref={panelRefCallback}
          id={`${menuId}-panel`}
          role="region"
          aria-labelledby={`${menuId}-trigger`}
          className={`${MORE_PANEL_CLASS} ${
            moreDropActive
              ? 'border-accent-warm/55 ring-2 ring-accent-warm/40 ring-offset-2 ring-offset-parchment dark:border-accent-warm/45 dark:ring-accent-warm/35 dark:ring-offset-panel-dark'
              : ''
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-medium leading-snug text-ink/70 dark:text-ink-dark/70">
            Drag from the bar into this menu to stash tools, or reorder below. Everything here stays available even when
            you exit Customize.
          </p>
          <SortableContext items={overflowIds} strategy={verticalListSortingStrategy}>
            <div className={`flex flex-col gap-3 ${overflow.length === 0 ? 'min-h-[4.5rem] justify-center' : ''}`}>
              {overflow.map((entry, i) => (
                <SortableSlot key={`overflow-${i}-${entry}`} id={`overflow:${i}`} customizing={customizing}>
                  {renderTool(entry)}
                </SortableSlot>
              ))}
              {overflow.length === 0 ? (
                <p className="text-center text-xs text-ink/45 dark:text-ink-dark/45">Drop a tool here from the bar above…</p>
              ) : null}
            </div>
          </SortableContext>
        </div>
      ) : null}
    </div>
  )
}

function SortableSlot({
  id,
  customizing,
  children,
}: {
  id: string
  customizing: boolean
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !customizing,
    transition: SORTABLE_TRANSITION,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center rounded-xl transition-[opacity,box-shadow] duration-150 ${
        customizing
          ? `touch-none ${isDragging ? 'z-[80] cursor-grabbing opacity-[0.28] shadow-md ring-2 ring-walnut/25 ring-offset-2 ring-offset-parchment dark:ring-accent-warm/30 dark:ring-offset-panel-dark' : 'cursor-grab active:cursor-grabbing'}`
          : ''
      } ${isDragging ? 'will-change-transform' : ''}`}
      {...(customizing
        ? {
            ...attributes,
            ...listeners,
            role: 'group',
            tabIndex: -1,
          }
        : {})}
    >
      {children}
    </div>
  )
}

export function ManuscriptToolbar({
  manuscriptId,
  editor,
  minimalBar,
  embedded,
  bumpToolbar,
  onOpenFindReplace,
}: ManuscriptToolbarProps) {
  const [layout, setLayout] = useState<ToolbarLayoutState>(() => loadToolbarLayout())
  const [customizing, setCustomizing] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreWrapRef = useRef<HTMLDivElement | null>(null)

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrlDraft, setLinkUrlDraft] = useState('')
  const linkPanelRef = useRef<HTMLDivElement | null>(null)
  const linkPopoverAnchorRef = useRef<HTMLElement | null>(null)

  const [commentOpen, setCommentOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const commentPanelRef = useRef<HTMLDivElement | null>(null)
  const commentPopoverAnchorRef = useRef<HTMLElement | null>(null)

  const [footnoteOpen, setFootnoteOpen] = useState(false)
  const [footnoteDraft, setFootnoteDraft] = useState('')
  const footnotePanelRef = useRef<HTMLDivElement | null>(null)
  const footnotePopoverAnchorRef = useRef<HTMLElement | null>(null)

  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const layoutRef = useRef(layout)
  const [dragPreviewEntry, setDragPreviewEntry] = useState<ToolbarRowEntry | null>(null)
  const [dragOverMoreZone, setDragOverMoreZone] = useState(false)
  const [overflowPanelNode, setOverflowPanelNode] = useState<HTMLDivElement | null>(null)

  const toolbarCollisionDetectionFn = useMemo(
    () => createToolbarCollisionDetection(overflowPanelNode),
    [overflowPanelNode],
  )

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  useEffect(() => {
    const id = window.setTimeout(() => {
      saveToolbarLayout(layout)
    }, 280)
    return () => window.clearTimeout(id)
  }, [layout])

  useEffect(() => {
    if (!linkOpen) return
    const close = (e: MouseEvent) => {
      const el = linkPanelRef.current
      if (el && !el.contains(e.target as Node)) setLinkOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [linkOpen])

  useEffect(() => {
    if (!commentOpen) return
    const close = (e: MouseEvent) => {
      const el = commentPanelRef.current
      if (el && !el.contains(e.target as Node)) setCommentOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [commentOpen])

  useEffect(() => {
    if (!footnoteOpen) return
    const close = (e: MouseEvent) => {
      const el = footnotePanelRef.current
      if (el && !el.contains(e.target as Node)) setFootnoteOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [footnoteOpen])

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent) => {
      // While customizing, ignore outside-close: primary-bar drags start with mousedown outside
      // `moreWrapRef`, which would collapse More before the drop target is usable.
      if (customizing) return
      if (moreWrapRef.current && !moreWrapRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen, customizing])

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const openLinkPanel = useCallback((anchor?: HTMLElement | null) => {
    if (!editor) return
    if (anchor) linkPopoverAnchorRef.current = anchor
    const href = (editor.getAttributes('link') as { href?: string }).href ?? ''
    setLinkUrlDraft(typeof href === 'string' ? href : '')
    setLinkOpen(true)
  }, [editor])

  const applyLink = useCallback(() => {
    if (!editor) return
    const raw = linkUrlDraft.trim()
    if (!raw) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkOpen(false)
      bumpToolbar()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: raw }).run()
    setLinkOpen(false)
    bumpToolbar()
  }, [editor, linkUrlDraft, bumpToolbar])

  const removeLink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkOpen(false)
    bumpToolbar()
  }, [editor, bumpToolbar])

  const openCommentPanel = useCallback((anchor?: HTMLElement | null) => {
    if (!editor) return
    if (anchor) commentPopoverAnchorRef.current = anchor
    const mark = editor.getAttributes('writerComment') as { body?: string }
    setCommentDraft(typeof mark.body === 'string' ? mark.body : '')
    setCommentOpen(true)
  }, [editor])

  const applyComment = useCallback(() => {
    if (!editor) return
    const body = commentDraft.trim()
    if (!body) {
      editor.chain().focus().extendMarkRange('writerComment').unsetMark('writerComment').run()
      setCommentOpen(false)
      bumpToolbar()
      return
    }
    if (editor.state.selection.empty) {
      setCommentOpen(false)
      return
    }
    editor.chain().focus().setMark('writerComment', { body }).run()
    setCommentOpen(false)
    bumpToolbar()
  }, [editor, commentDraft, bumpToolbar])

  const removeComment = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('writerComment').unsetMark('writerComment').run()
    setCommentOpen(false)
    bumpToolbar()
  }, [editor, bumpToolbar])

  const applyFootnote = useCallback(() => {
    if (!editor) return
    const content = footnoteDraft.trim()
    if (!content) {
      setFootnoteOpen(false)
      return
    }
    const id = newFootnoteId()
    const n = countFootnoteMarkers(editor.state.doc) + 1
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: String(n),
        marks: [{ type: 'writerFootnote', attrs: { id, content } }],
      })
      .run()
    setFootnoteOpen(false)
    setFootnoteDraft('')
    bumpToolbar()
  }, [editor, footnoteDraft, bumpToolbar])

  const onPickImage = useCallback(
    (fileList: FileList | null) => {
      if (!editor || !fileList?.[0]) return
      const file = fileList[0]
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : ''
        if (!src) return
        editor.chain().focus().setImage({ src, alt: file.name }).run()
        bumpToolbar()
      }
      reader.readAsDataURL(file)
      if (imageInputRef.current) imageInputRef.current.value = ''
    },
    [editor, bumpToolbar],
  )

  const renderTool = (entry: ToolbarRowEntry, opts: { moreVariant?: boolean } = {}): ReactNode => {
    const { moreVariant = false } = opts

    if (entry === 'divider') {
      return <div className="hidden h-6 w-px shrink-0 bg-dust sm:block dark:bg-border-dark" />
    }

    if (!editor && entry !== 'heading') {
      return null
    }

    switch (entry) {
      case 'heading':
        return (
          <select
            value={editor ? headingSelectValue(editor) : ''}
            onChange={(e) => {
              if (!editor) return
              const v = e.target.value
              const chain = editor.chain().focus()
              if (v === '') chain.setParagraph().run()
              else {
                const level = Number(v) as 1 | 2 | 3
                chain.toggleHeading({ level }).run()
              }
              bumpToolbar()
            }}
            className="rounded-full border-2 border-dust bg-parchment px-3 py-2 text-sm font-medium text-ink focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-cream sm:px-4 sm:py-2.5"
          >
            {HEADINGS.map((h) => (
              <option key={h.value || 'p'} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        )
      case 'bold':
        return (
          <button
            type="button"
            className={toolBtnClass(editor?.isActive('bold') ?? false)}
            title="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )
      case 'italic':
        return (
          <button
            type="button"
            className={toolBtnClass(editor?.isActive('italic') ?? false)}
            title="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )
      case 'underline':
        return (
          <button
            type="button"
            className={toolBtnClass(editor?.isActive('underline') ?? false)}
            title="Underline"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )
      case 'strikethrough':
        return (
          <button
            type="button"
            className={toolBtnClass(editor?.isActive('strike') ?? false)}
            title="Strikethrough"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )
      case 'bulletList':
        return (
          <button
            type="button"
            className={toolBtnClass(editor?.isActive('bulletList') ?? false)}
            title="Bulleted list"
            onClick={() => {
              if (!editor) return
              chainToggleList(editor, 'bullet')
              bumpToolbar()
            }}
          >
            <List className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )
      case 'orderedList':
        return (
          <button
            type="button"
            className={toolBtnClass(editor?.isActive('orderedList') ?? false)}
            title="Numbered list"
            onClick={() => {
              if (!editor) return
              chainToggleList(editor, 'ordered')
              bumpToolbar()
            }}
          >
            <ListOrdered className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )
      case 'blockquote':
        return (
          <button
            type="button"
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
              editor?.isActive('blockquote')
                ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
                : 'text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50'
            }`}
            title="Block quote"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-4 w-4" strokeWidth={2.25} />
            {!moreVariant ? <span className="hidden sm:inline">Quote</span> : <span>Quote</span>}
          </button>
        )
      case 'dropCap':
        return (
          <button
            type="button"
            className={toolBtnClass(Boolean(editor?.getAttributes('paragraph').inkwellDropCap))}
            title="Drop cap on paragraph (ebook)"
            onClick={() => {
              if (!editor || !editor.isActive('paragraph')) return
              const cur = Boolean(editor.getAttributes('paragraph').inkwellDropCap)
              editor.chain().focus().updateAttributes('paragraph', { inkwellDropCap: !cur }).run()
              bumpToolbar()
            }}
          >
            <ALargeSmall className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )
      case 'align':
        return editor ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={toolBtnClass(isTextAlignActive(editor, 'left'))}
              title="Align left (Ctrl/Cmd+Shift+L)"
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
            >
              <AlignLeft className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolBtnClass(isTextAlignActive(editor, 'center'))}
              title="Align center (Ctrl/Cmd+Shift+E)"
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
            >
              <AlignCenter className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolBtnClass(isTextAlignActive(editor, 'right'))}
              title="Align right (Ctrl/Cmd+Shift+R)"
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
            >
              <AlignRight className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolBtnClass(isTextAlignActive(editor, 'justify'))}
              title="Justify (Ctrl/Cmd+Shift+J)"
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            >
              <AlignJustify className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        ) : null
      case 'link':
        return (
          <div className="relative inline-flex shrink-0">
            <button
              type="button"
              className={toolBtnClass(editor?.isActive('link') ?? false)}
              title="Link"
              onClick={(e) => openLinkPanel(e.currentTarget)}
            >
              <Link2 className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        )
      case 'sceneBreak':
        return (
          <div className="flex items-center gap-0.5">
            <select
              className="h-8 max-w-[7rem] rounded-lg border border-dust bg-parchment text-[10px] font-medium text-ink dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark"
              defaultValue=""
              title="Scene break / ornament"
              onChange={(e) => {
                const v = e.target.value
                if (!editor) return
                if (v === 'plain') editor.chain().focus().setHorizontalRule().run()
                else if (v.startsWith('orn:')) {
                  const ornament = v.slice(4)
                  editor.chain().focus().insertContent({ type: 'horizontalRule', attrs: { ornament } }).run()
                }
                e.currentTarget.selectedIndex = 0
              }}
            >
              <option value="" disabled>
                Scene…
              </option>
              <option value="plain">Plain rule</option>
              {SCENE_BREAK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={toolBtnClass(false)}
              title="Plain horizontal rule"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            >
              <Minus className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        )
      case 'image':
        return (
          <button
            type="button"
            className={toolBtnClass(false)}
            title="Insert image"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )
      case 'comment':
        return (
          <div className="relative inline-flex shrink-0">
            <button
              type="button"
              className={toolBtnClass(editor?.isActive('writerComment') ?? false)}
              title="Comment on selection"
              onClick={(e) => openCommentPanel(e.currentTarget)}
            >
              <MessageSquare className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        )
      case 'footnote':
        return (
          <div className="relative inline-flex shrink-0">
            <button
              type="button"
              className={toolBtnClass(false)}
              title="Insert footnote"
              onClick={(e) => {
                footnotePopoverAnchorRef.current = e.currentTarget
                setFootnoteDraft('')
                setFootnoteOpen(true)
              }}
            >
              <NotebookPen className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        )
      case 'mention':
        return (
          <button
            type="button"
            className={toolBtnClass(false)}
            title="Mention — type @ in text"
            onClick={() => editor?.chain().focus().insertContent('@').run()}
          >
            <AtSign className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )
      default:
        return null
    }
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    if (active.id === over.id) return

    const activeParsed = parseSortableId(String(active.id))
    if (!activeParsed) return

    const overStr = String(over.id)

    setLayout((prev) => {
      let primary = [...prev.primary]
      let overflow = [...prev.overflow]

      const entry =
        activeParsed.zone === 'primary'
          ? primary[activeParsed.index]
          : overflow[activeParsed.index]
      if (entry === undefined) return prev

      if (overStr === OVERFLOW_DROP_ID) {
        if (activeParsed.zone === 'primary') primary.splice(activeParsed.index, 1)
        else overflow.splice(activeParsed.index, 1)
        overflow.push(entry)
        return { primary, overflow }
      }

      const overParsed = parseSortableId(overStr)

      if (overParsed && activeParsed.zone === overParsed.zone) {
        const zone = activeParsed.zone
        const getArr = (z: 'primary' | 'overflow') => (z === 'primary' ? primary : overflow)
        const arr = [...getArr(zone)]
        const newArr = arrayMove(arr, activeParsed.index, overParsed.index)
        if (zone === 'primary') primary = newArr
        else overflow = newArr
        return { primary, overflow }
      }

      if (overParsed) {
        if (activeParsed.zone === 'primary') primary.splice(activeParsed.index, 1)
        else overflow.splice(activeParsed.index, 1)

        const destArr = overParsed.zone === 'primary' ? [...primary] : [...overflow]
        destArr.splice(overParsed.index, 0, entry)
        if (overParsed.zone === 'primary') primary = destArr
        else overflow = destArr
        return { primary, overflow }
      }

      return prev
    })
  }, [])

  const clearToolbarDragUi = useCallback(() => {
    document.body.classList.remove('inkwell-toolbar-dnd')
    setDragPreviewEntry(null)
    setDragOverMoreZone(false)
  }, [])

  useEffect(() => () => document.body.classList.remove('inkwell-toolbar-dnd'), [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    document.body.classList.add('inkwell-toolbar-dnd')
    setDragOverMoreZone(false)
    const parsed = parseSortableId(String(event.active.id))
    if (!parsed) {
      setDragPreviewEntry(null)
      return
    }
    const list = parsed.zone === 'primary' ? layoutRef.current.primary : layoutRef.current.overflow
    setDragPreviewEntry(list[parsed.index] ?? null)
  }, [])

  const onToolbarDragEnd = useCallback(
    (event: DragEndEvent) => {
      clearToolbarDragUi()
      handleDragEnd(event)
    },
    [clearToolbarDragUi, handleDragEnd],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const primaryIds = useMemo(
    () => layout.primary.map((_, i) => `primary:${i}`),
    [layout],
  )
  const overflowIds = useMemo(
    () => layout.overflow.map((_, i) => `overflow:${i}`),
    [layout],
  )

  const resetLayout = () => {
    const next = defaultToolbarLayout()
    setLayout(next)
    saveToolbarLayout(next)
  }

  const shellPad = embedded ? 'px-2 py-2 sm:px-3 sm:py-2.5' : 'px-4 py-2.5 sm:px-8 sm:py-3'
  const moreMenuId = `inkwell-toolbar-more-${manuscriptId}`

  const toolbarInner = customizing ? (
    <DndContext
      sensors={sensors}
      collisionDetection={toolbarCollisionDetectionFn}
      onDragStart={handleDragStart}
      onDragOver={({ over }) => {
        if (!over) {
          setDragOverMoreZone(false)
          return
        }
        const id = String(over.id)
        setDragOverMoreZone(id === OVERFLOW_DROP_ID || id.startsWith('overflow:'))
      }}
      onDragEnd={onToolbarDragEnd}
      onDragCancel={clearToolbarDragUi}
    >
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain">
          <SortableContext items={primaryIds} strategy={horizontalListSortingStrategy}>
            {layout.primary.map((entry, i) => (
              <SortableSlot key={`primary-${i}-${entry}`} id={`primary:${i}`} customizing={customizing}>
                {renderTool(entry)}
              </SortableSlot>
            ))}
          </SortableContext>
        </div>
        <MoreToolbarOverflowCustomize
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
          moreWrapRef={moreWrapRef}
          overflow={layout.overflow}
          overflowIds={overflowIds}
          renderTool={renderTool}
          customizing={customizing}
          menuId={moreMenuId}
          onOverflowPanelNode={setOverflowPanelNode}
          dropHighlight={dragOverMoreZone}
        />
      </div>
      <DragOverlay adjustScale={false} dropAnimation={TOOLBAR_DROP_ANIMATION} zIndex={100}>
        {dragPreviewEntry ? <ToolbarDragIconPreview entry={dragPreviewEntry} /> : null}
      </DragOverlay>
    </DndContext>
  ) : (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain">
        {layout.primary.map((entry, i) => (
          <div key={`p-${i}-${entry}`} className="flex items-center">
            {renderTool(entry)}
          </div>
        ))}
      </div>
      <MoreToolbarOverflowUse
        moreOpen={moreOpen}
        setMoreOpen={setMoreOpen}
        moreWrapRef={moreWrapRef}
        overflow={layout.overflow}
        renderTool={renderTool}
        menuId={moreMenuId}
      />
    </div>
  )

  return (
    <>
    <div
      className={`relative z-[70] flex flex-nowrap items-center gap-2 border-b border-dust bg-white/50 dark:border-border-dark dark:bg-panel-dark/50 ${shellPad}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2" data-inkwell-tour="editor-toolbar-bar">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">
            {toolbarInner}
          </div>

          <div
            className="flex shrink-0 items-center gap-2 border-l border-dust/80 pl-3 dark:border-border-dark/90"
            data-inkwell-tour="editor-toolbar-customize"
          >
            <button
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:focus-visible:ring-accent-warm/40 dark:focus-visible:ring-offset-panel-dark ${
                customizing
                  ? 'border-walnut bg-walnut/10 text-walnut dark:border-accent-warm dark:bg-accent-warm/15 dark:text-accent-warm'
                  : 'border-dust text-ink/80 hover:bg-dust/25 dark:border-border-dark dark:text-ink-dark/85 dark:hover:bg-border-dark/40'
              }`}
              onClick={() => {
                setCustomizing((prev) => {
                  const next = !prev
                  if (next) queueMicrotask(() => setMoreOpen(true))
                  else {
                    setMoreOpen(false)
                    setOverflowPanelNode(null)
                    setLinkOpen(false)
                    setCommentOpen(false)
                    setFootnoteOpen(false)
                  }
                  return next
                })
              }}
            >
              {customizing ? 'Done' : 'Customize toolbar'}
            </button>
            {customizing ? (
              <button
                type="button"
                className="rounded-full border border-dust px-3 py-1.5 text-xs font-semibold text-ink/85 transition-colors duration-150 hover:bg-dust/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/30 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:border-border-dark dark:text-ink-dark/85 dark:hover:bg-border-dark/40 dark:focus-visible:ring-accent-warm/35 dark:focus-visible:ring-offset-panel-dark"
                onClick={resetLayout}
              >
                Reset to default
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPickImage(e.target.files)}
      />

      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 border-l border-transparent pl-1 sm:border-dust/60 sm:pl-3 dark:sm:border-border-dark/80">
          {minimalBar && onOpenFindReplace ? (
            <button
              type="button"
              className="flex h-9 shrink-0 items-center gap-2 rounded-2xl border border-dust bg-white/80 px-2.5 text-sm font-medium text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/80 dark:text-ink-dark dark:hover:bg-panel-dark sm:h-10 sm:px-3"
              title="Find and replace across all sections"
              aria-label="Find and replace across all sections"
              onClick={() => onOpenFindReplace()}
            >
              <Search className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              <span className="hidden sm:inline">Find</span>
            </button>
          ) : null}
          <button
            type="button"
            disabled={!editor?.can().undo()}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-colors duration-150 disabled:cursor-default sm:h-10 sm:w-10 ${
              editor?.can().undo()
                ? 'text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50'
                : 'cursor-default text-ink/35 dark:text-ink-dark/35'
            }`}
            title="Undo (Ctrl/Cmd+Z)"
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            disabled={!editor?.can().redo()}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-colors duration-150 disabled:cursor-default sm:h-10 sm:w-10 ${
              editor?.can().redo()
                ? 'text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50'
                : 'cursor-default text-ink/35 dark:text-ink-dark/35'
            }`}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
    </div>

      {editor ?
        <>
          <ToolbarAnchoredPopover open={linkOpen} anchorRef={linkPopoverAnchorRef} panelRef={linkPanelRef}>
            <label className="text-xs font-semibold text-ink/80 dark:text-ink-dark/80" htmlFor={`inkwell-link-url-${manuscriptId}`}>
              URL
            </label>
            <input
              id={`inkwell-link-url-${manuscriptId}`}
              type="url"
              value={linkUrlDraft}
              onChange={(e) => setLinkUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                }
              }}
              placeholder="https://…"
              className="rounded-xl border border-dust bg-white px-3 py-2 text-sm text-ink focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-cream"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-parchment hover:bg-walnut dark:bg-cream dark:text-ink dark:hover:bg-accent-warm"
                onClick={applyLink}
              >
                Apply
              </button>
              <button
                type="button"
                className="rounded-full border border-dust px-4 py-2 text-xs font-semibold text-ink hover:bg-dust/30 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/50"
                onClick={removeLink}
              >
                Remove link
              </button>
            </div>
          </ToolbarAnchoredPopover>

          <ToolbarAnchoredPopover open={commentOpen} anchorRef={commentPopoverAnchorRef} panelRef={commentPanelRef}>
            <label className="text-xs font-semibold text-ink/80 dark:text-ink-dark/80" htmlFor={`inkwell-comment-${manuscriptId}`}>
              Comment
            </label>
            <textarea
              id={`inkwell-comment-${manuscriptId}`}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={3}
              placeholder="Note to self or editor…"
              className="resize-y rounded-xl border border-dust bg-white px-3 py-2 text-sm text-ink focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-cream"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-parchment hover:bg-walnut dark:bg-cream dark:text-ink dark:hover:bg-accent-warm"
                onClick={applyComment}
              >
                Apply
              </button>
              <button
                type="button"
                className="rounded-full border border-dust px-4 py-2 text-xs font-semibold text-ink hover:bg-dust/30 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/50"
                onClick={removeComment}
              >
                Remove
              </button>
            </div>
          </ToolbarAnchoredPopover>

          <ToolbarAnchoredPopover open={footnoteOpen} anchorRef={footnotePopoverAnchorRef} panelRef={footnotePanelRef}>
            <label className="text-xs font-semibold text-ink/80 dark:text-ink-dark/80" htmlFor={`inkwell-fn-${manuscriptId}`}>
              Footnote text
            </label>
            <textarea
              id={`inkwell-fn-${manuscriptId}`}
              value={footnoteDraft}
              onChange={(e) => setFootnoteDraft(e.target.value)}
              rows={3}
              className="resize-y rounded-xl border border-dust bg-white px-3 py-2 text-sm text-ink focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-cream"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-parchment hover:bg-walnut dark:bg-cream dark:text-ink dark:hover:bg-accent-warm"
                onClick={applyFootnote}
              >
                Insert
              </button>
            </div>
          </ToolbarAnchoredPopover>
        </>
      : null}
    </>
  )
}
