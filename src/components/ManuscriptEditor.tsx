import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor, JSONContent } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Feather,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { PageBreak } from '../lib/tiptap/extensions/PageBreak'

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
}: Props) {
  const [, setToolbarVersion] = useState(0)
  const bumpToolbar = useCallback(() => setToolbarVersion((v) => v + 1), [])

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrlDraft, setLinkUrlDraft] = useState('')
  const linkPanelRef = useRef<HTMLDivElement | null>(null)

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: {
            openOnClick: false,
            autolink: false,
          },
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph', 'blockquote'],
        }),
        PageBreak,
        CharacterCount.configure({
          limit: null,
        }),
      ],
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

  const words = editor ? editor.storage.characterCount.words() : 0
  const characters = editor ? editor.storage.characterCount.characters() : 0
  const minutes = words === 0 ? 0 : Math.max(1, Math.round(words / 200))

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
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={toolBtn(editor?.isActive('orderedList') ?? false)}
          title="Numbered list"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
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

        <div className="min-w-[1rem] flex-1" />

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

        <div
          className={`flex items-center gap-2 text-xs font-medium text-ink dark:text-ink-dark sm:text-sm ${
            compactFooterStats ? 'tabular-nums' : ''
          }`}
        >
          <Feather className="h-4 w-4 shrink-0 text-walnut dark:text-accent-warm" strokeWidth={2} />
          <span>{words.toLocaleString()} words</span>
          {!compactFooterStats && <span className="text-walnut/80 dark:text-accent-warm/80">·</span>}
          <span className="text-walnut dark:text-accent-warm">
            {characters.toLocaleString()} chars
          </span>
        </div>
        {!compactFooterStats && (
          <div className="hidden text-sm font-medium text-walnut dark:text-accent-warm sm:block">
            {words === 0 ? '—' : `${minutes} min read`}
          </div>
        )}
      </div>

      <div className={`inkwell-editor-shell flex-1 overflow-auto ${shellPad}`}>
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
    prev.showChapterTitleOnPage === next.showChapterTitleOnPage
  )
})
