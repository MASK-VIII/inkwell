import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor, JSONContent } from '@tiptap/core'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AtSign,
  Bold,
  Feather,
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
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { createManuscriptTipTapExtensions } from '../lib/tiptap/manuscriptExtensions'
import type { MentionItem } from '../lib/tiptap/mentionUi'

const HEADINGS = [
  { value: '', label: 'Normal text' },
  { value: '1', label: 'Heading 1 — Large & stately' },
  { value: '2', label: 'Heading 2 — Chapter title' },
  { value: '3', label: 'Heading 3 — Section break' },
] as const

function mentionItemsEqual(a: MentionItem[], b: MentionItem[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].label !== b[i].label) return false
  }
  return true
}

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

/** listItem schema requires a paragraph; toggling a list inside a heading fails unless we normalize first. */
function chainToggleList(editor: Editor, kind: 'bullet' | 'ordered') {
  const c = editor.chain().focus()
  if (editor.isActive('heading')) {
    return kind === 'bullet' ? c.setParagraph().toggleBulletList().run() : c.setParagraph().toggleOrderedList().run()
  }
  return kind === 'bullet' ? c.toggleBulletList().run() : c.toggleOrderedList().run()
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

function countFootnoteMarkers(doc: Editor['state']['doc']): number {
  let n = 0
  doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === 'writerFootnote')) n += 1
  })
  return n
}

function newFootnoteId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `fn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

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
}: Props) {
  const [, setToolbarVersion] = useState(0)
  const bumpToolbar = useCallback(() => setToolbarVersion((v) => v + 1), [])

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrlDraft, setLinkUrlDraft] = useState('')
  const linkPanelRef = useRef<HTMLDivElement | null>(null)

  const [commentOpen, setCommentOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const commentPanelRef = useRef<HTMLDivElement | null>(null)

  const [footnoteOpen, setFootnoteOpen] = useState(false)
  const [footnoteDraft, setFootnoteDraft] = useState('')
  const footnotePanelRef = useRef<HTMLDivElement | null>(null)

  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const floatClusterRef = useRef<HTMLDivElement | null>(null)

  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null)
  const [statsPinned, setStatsPinned] = useState(false)

  const mentionItemsRef = useRef(mentionItems)
  mentionItemsRef.current = mentionItems

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

  const editor = useEditor(
    {
      extensions: createManuscriptTipTapExtensions({
        getMentionItems: () => mentionItemsRef.current,
        mentionMode: 'live',
      }),
      content,
      editorProps: {
        attributes: {
          class: 'tiptap',
          spellcheck: 'true',
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
        setStatsPinned(false)
        return
      }
      try {
        setStatsPinned(localStorage.getItem(`inkwell-wordstat-pin:${wordStatStorageKey}`) === '1')
      } catch {
        setStatsPinned(false)
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

  useEffect(() => {
    if (!linkOpen) return
    const close = (e: MouseEvent) => {
      const el = linkPanelRef.current
      if (el && !el.contains(e.target as Node)) setLinkOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [linkOpen])

  const openLinkPanel = useCallback(() => {
    if (!editor) return
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

  const openCommentPanel = useCallback(() => {
    if (!editor) return
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

  const toolBtn = (active: boolean) =>
    `flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-colors ${
      active
        ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
        : 'text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50'
    }`

  const shellPad = embedded ? 'p-3 sm:p-4' : 'p-6 sm:p-12'
  const editorMinH = embedded ? 'min-h-[9rem]' : 'min-h-[50vh]'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={`flex flex-wrap items-center gap-2 border-b border-dust bg-white/50 dark:border-border-dark dark:bg-panel-dark/50 ${
          embedded ? 'px-2 py-2 sm:px-3 sm:py-2.5' : 'px-4 py-2.5 sm:px-8 sm:py-3'
        }`}
      >
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

        <div className="hidden h-6 w-px bg-dust sm:block dark:bg-border-dark" />

        <button
          type="button"
          className={toolBtn(editor?.isActive('bold') ?? false)}
          title="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={toolBtn(editor?.isActive('italic') ?? false)}
          title="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={toolBtn(editor?.isActive('underline') ?? false)}
          title="Underline"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={toolBtn(editor?.isActive('strike') ?? false)}
          title="Strikethrough"
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" strokeWidth={2.25} />
        </button>

        <div className="hidden h-6 w-px bg-dust sm:block dark:bg-border-dark" />

        <button
          type="button"
          className={toolBtn(editor?.isActive('bulletList') ?? false)}
          title="Bulleted list"
          onClick={() => {
            if (!editor) return
            chainToggleList(editor, 'bullet')
            bumpToolbar()
          }}
        >
          <List className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={toolBtn(editor?.isActive('orderedList') ?? false)}
          title="Numbered list"
          onClick={() => {
            if (!editor) return
            chainToggleList(editor, 'ordered')
            bumpToolbar()
          }}
        >
          <ListOrdered className="h-4 w-4" strokeWidth={2.25} />
        </button>

        <div className="hidden h-6 w-px bg-dust sm:block dark:bg-border-dark" />

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
          <span className="hidden sm:inline">Quote</span>
        </button>

        <div className="hidden h-6 w-px bg-dust sm:block dark:bg-border-dark" />

        {editor ? (
          <>
            <button
              type="button"
              className={toolBtn(isTextAlignActive(editor, 'left'))}
              title="Align left (Ctrl/Cmd+Shift+L)"
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
            >
              <AlignLeft className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolBtn(isTextAlignActive(editor, 'center'))}
              title="Align center (Ctrl/Cmd+Shift+E)"
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
            >
              <AlignCenter className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolBtn(isTextAlignActive(editor, 'right'))}
              title="Align right (Ctrl/Cmd+Shift+R)"
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
            >
              <AlignRight className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolBtn(isTextAlignActive(editor, 'justify'))}
              title="Justify (Ctrl/Cmd+Shift+J)"
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            >
              <AlignJustify className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </>
        ) : null}

        <div className="hidden h-6 w-px bg-dust sm:block dark:bg-border-dark" />

        <div className="relative">
          <button
            type="button"
            className={toolBtn(editor?.isActive('link') ?? false)}
            title="Link"
            onClick={openLinkPanel}
          >
            <Link2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
          {linkOpen && editor ? (
            <div
              ref={linkPanelRef}
              className="absolute left-0 top-full z-50 mt-2 flex min-w-[min(18rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl border border-dust bg-parchment p-3 shadow-lg dark:border-border-dark dark:bg-panel-dark sm:left-auto sm:right-0"
              onMouseDown={(e) => e.stopPropagation()}
            >
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
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={toolBtn(false)}
          title="Scene break (horizontal rule)"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" strokeWidth={2.25} />
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickImage(e.target.files)}
        />
        <button
          type="button"
          className={toolBtn(false)}
          title="Insert image"
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" strokeWidth={2.25} />
        </button>

        <div className="relative">
          <button
            type="button"
            className={toolBtn(editor?.isActive('writerComment') ?? false)}
            title="Comment on selection"
            onClick={openCommentPanel}
          >
            <MessageSquare className="h-4 w-4" strokeWidth={2.25} />
          </button>
          {commentOpen && editor ? (
            <div
              ref={commentPanelRef}
              className="absolute left-0 top-full z-50 mt-2 flex min-w-[min(18rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl border border-dust bg-parchment p-3 shadow-lg dark:border-border-dark dark:bg-panel-dark sm:left-auto sm:right-0"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <label
                className="text-xs font-semibold text-ink/80 dark:text-ink-dark/80"
                htmlFor={`inkwell-comment-${manuscriptId}`}
              >
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
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            className={toolBtn(false)}
            title="Insert footnote"
            onClick={() => {
              setFootnoteDraft('')
              setFootnoteOpen(true)
            }}
          >
            <NotebookPen className="h-4 w-4" strokeWidth={2.25} />
          </button>
          {footnoteOpen && editor ? (
            <div
              ref={footnotePanelRef}
              className="absolute left-0 top-full z-50 mt-2 flex min-w-[min(18rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl border border-dust bg-parchment p-3 shadow-lg dark:border-border-dark dark:bg-panel-dark sm:left-auto sm:right-0"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <label
                className="text-xs font-semibold text-ink/80 dark:text-ink-dark/80"
                htmlFor={`inkwell-fn-${manuscriptId}`}
              >
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
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            className={toolBtn(false)}
            title="Mention — type @ in text"
            onClick={() => editor?.chain().focus().insertContent('@').run()}
          >
            <AtSign className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            disabled={!editor?.can().undo()}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-colors disabled:cursor-default sm:h-10 sm:w-10 ${
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
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-colors disabled:cursor-default sm:h-10 sm:w-10 ${
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

      <div ref={shellRef} className={`inkwell-editor-shell relative flex-1 overflow-auto ${shellPad}`}>
        {floatPos !== null ? (
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
            className={`mx-auto max-w-[720px] ${embedded ? 'mb-5 px-1' : 'mb-8 px-2 sm:px-4'}`}
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
              embedded ? 'min-h-[9rem]' : 'min-h-[40vh]'
            }`}
          />
        )}
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
    prev.wordStatStorageKey === next.wordStatStorageKey
  )
})
