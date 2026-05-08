import type { Editor } from '@tiptap/core'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ALargeSmall,
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  NotebookPen,
  Quote,
  Redo2,
  Search,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SCENE_BREAK_OPTIONS } from '../lib/sceneBreakCatalog'

function chainToggleList(editor: Editor, kind: 'bullet' | 'ordered') {
  const c = editor.chain().focus()
  if (editor.isActive('heading')) {
    return kind === 'bullet' ? c.setParagraph().toggleBulletList().run() : c.setParagraph().toggleOrderedList().run()
  }
  return kind === 'bullet' ? c.toggleBulletList().run() : c.toggleOrderedList().run()
}

function isTextAlignActive(editor: Editor, alignment: 'left' | 'center' | 'right' | 'justify'): boolean {
  if (alignment === 'left') {
    return !(['center', 'right', 'justify'] as const).some((a) => editor.isActive({ textAlign: a }))
  }
  return editor.isActive({ textAlign: alignment })
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

function headingValue(editor: Editor): '' | '1' | '2' | '3' {
  if (editor.isActive('heading', { level: 1 })) return '1'
  if (editor.isActive('heading', { level: 2 })) return '2'
  if (editor.isActive('heading', { level: 3 })) return '3'
  return ''
}

type Props = {
  open: boolean
  editor: Editor | null
  onClose: () => void
  onOpenFindReplace?: () => void
}

function segBtn(active: boolean) {
  return `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
      : 'bg-dust/25 text-ink hover:bg-dust/40 dark:bg-border-dark/60 dark:text-ink-dark dark:hover:bg-border-dark/80'
  }`
}

function toolSquare(active: boolean) {
  return `flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${
    active
      ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
      : 'text-ink hover:bg-dust/35 dark:text-ink-dark dark:hover:bg-border-dark/50'
  }`
}

export function MobileFormatSheet({ open, editor, onClose, onOpenFindReplace }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<{ from: number; to: number } | null>(null)
  const [, bump] = useState(0)
  const refresh = useCallback(() => bump((x) => x + 1), [])

  const [linkDraft, setLinkDraft] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [footnoteDraft, setFootnoteDraft] = useState('')
  const [footnoteOpen, setFootnoteOpen] = useState(false)

  useEffect(() => {
    if (!open || !editor) return
    const { from, to } = editor.state.selection
    selectionRef.current = { from, to }
  }, [open, editor])

  const restoreSelection = useCallback(() => {
    if (!editor) return
    const saved = selectionRef.current
    if (!saved) {
      editor.commands.focus()
      return
    }
    try {
      editor.chain().focus().setTextSelection({ from: saved.from, to: saved.to }).run()
    } catch {
      editor.commands.focus()
    }
  }, [editor])

  const handleClose = useCallback(() => {
    restoreSelection()
    setLinkOpen(false)
    setFootnoteOpen(false)
    setLinkDraft('')
    setFootnoteDraft('')
    onClose()
  }, [onClose, restoreSelection])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      const el = panelRef.current
      if (el && !el.contains(e.target as Node)) handleClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('pointerdown', onDoc, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, handleClose])

  useEffect(() => {
    const root = document.getElementById('root')
    if (!open) {
      root?.classList.remove('inkwell-mobile-sheet-open')
      return
    }
    root?.classList.add('inkwell-mobile-sheet-open')
    return () => root?.classList.remove('inkwell-mobile-sheet-open')
  }, [open])

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
        refresh()
      }
      reader.readAsDataURL(file)
      if (imageInputRef.current) imageInputRef.current.value = ''
    },
    [editor, refresh],
  )

  const openLinkPanel = useCallback(() => {
    if (!editor) return
    const href = (editor.getAttributes('link') as { href?: string }).href ?? ''
    setLinkDraft(typeof href === 'string' ? href : '')
    setLinkOpen(true)
  }, [editor])

  const applyLink = useCallback(() => {
    if (!editor) return
    const raw = linkDraft.trim()
    if (!raw) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: raw }).run()
    }
    setLinkOpen(false)
    refresh()
  }, [editor, linkDraft, refresh])

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
    refresh()
  }, [editor, footnoteDraft, refresh])

  if (!open || !editor) return null

  const ed = editor
  const hv = headingValue(ed)

  return (
    <div className="inkwell-mobile-format-sheet-root" aria-modal role="dialog" aria-label="Formatting">
      <div className="inkwell-mobile-format-sheet-backdrop" aria-hidden />
      <div
        ref={panelRef}
        className="inkwell-mobile-format-sheet"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="inkwell-mobile-format-sheet-handle" aria-hidden />
        <div className="inkwell-mobile-format-sheet-scroll">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Formatting
          </p>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={toolSquare(false)}
              title="Undo"
              aria-label="Undo"
              onClick={() => {
                ed.chain().focus().undo().run()
                refresh()
              }}
            >
              <Undo2 className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(false)}
              title="Redo"
              aria-label="Redo"
              onClick={() => {
                ed.chain().focus().redo().run()
                refresh()
              }}
            >
              <Redo2 className="h-5 w-5" strokeWidth={2.25} />
            </button>
            {onOpenFindReplace ? (
              <button
                type="button"
                className={toolSquare(false)}
                title="Find and replace"
                aria-label="Find and replace"
                onClick={() => {
                  onOpenFindReplace()
                  handleClose()
                }}
              >
                <Search className="h-5 w-5" strokeWidth={2.25} />
              </button>
            ) : null}
          </div>

          <p className="mb-2 text-[11px] font-medium text-ink/60 dark:text-ink-dark/60">Paragraph & headings</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(
              [
                { v: '' as const, label: 'Body' },
                { v: '1' as const, label: 'H1' },
                { v: '2' as const, label: 'H2' },
                { v: '3' as const, label: 'H3' },
              ] as const
            ).map(({ v, label }) => (
              <button
                key={v || 'p'}
                type="button"
                className={segBtn(hv === v)}
                onClick={() => {
                  const chain = ed.chain().focus()
                  if (v === '') chain.setParagraph().run()
                  else {
                    const level = Number(v) as 1 | 2 | 3
                    chain.toggleHeading({ level }).run()
                  }
                  refresh()
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mb-2 text-[11px] font-medium text-ink/60 dark:text-ink-dark/60">Inline</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={toolSquare(ed.isActive('bold'))}
              title="Bold"
              aria-label="Bold"
              onClick={() => {
                ed.chain().focus().toggleBold().run()
                refresh()
              }}
            >
              <Bold className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(ed.isActive('italic'))}
              title="Italic"
              aria-label="Italic"
              onClick={() => {
                ed.chain().focus().toggleItalic().run()
                refresh()
              }}
            >
              <Italic className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(ed.isActive('underline'))}
              title="Underline"
              aria-label="Underline"
              onClick={() => {
                ed.chain().focus().toggleUnderline().run()
                refresh()
              }}
            >
              <UnderlineIcon className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(ed.isActive('strike'))}
              title="Strikethrough"
              aria-label="Strikethrough"
              onClick={() => {
                ed.chain().focus().toggleStrike().run()
                refresh()
              }}
            >
              <Strikethrough className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>

          <p className="mb-2 text-[11px] font-medium text-ink/60 dark:text-ink-dark/60">Lists & blocks</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={toolSquare(ed.isActive('bulletList'))}
              title="Bullet list"
              aria-label="Bullet list"
              onClick={() => {
                chainToggleList(ed, 'bullet')
                refresh()
              }}
            >
              <List className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(ed.isActive('orderedList'))}
              title="Numbered list"
              aria-label="Numbered list"
              onClick={() => {
                chainToggleList(ed, 'ordered')
                refresh()
              }}
            >
              <ListOrdered className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(ed.isActive('blockquote'))}
              title="Blockquote"
              aria-label="Blockquote"
              onClick={() => {
                ed.chain().focus().toggleBlockquote().run()
                refresh()
              }}
            >
              <Quote className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(Boolean(ed.getAttributes('paragraph').inkwellDropCap))}
              title="Drop cap (ebook)"
              aria-label="Drop cap paragraph"
              onClick={() => {
                if (!ed.isActive('paragraph')) return
                const cur = Boolean(ed.getAttributes('paragraph').inkwellDropCap)
                ed.chain().focus().updateAttributes('paragraph', { inkwellDropCap: !cur }).run()
                refresh()
              }}
            >
              <ALargeSmall className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>

          <p className="mb-2 text-[11px] font-medium text-ink/60 dark:text-ink-dark/60">Align</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={toolSquare(isTextAlignActive(ed, 'left'))}
              title="Align left"
              aria-label="Align left"
              onClick={() => {
                ed.chain().focus().setTextAlign('left').run()
                refresh()
              }}
            >
              <AlignLeft className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(isTextAlignActive(ed, 'center'))}
              title="Align center"
              aria-label="Align center"
              onClick={() => {
                ed.chain().focus().setTextAlign('center').run()
                refresh()
              }}
            >
              <AlignCenter className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(isTextAlignActive(ed, 'right'))}
              title="Align right"
              aria-label="Align right"
              onClick={() => {
                ed.chain().focus().setTextAlign('right').run()
                refresh()
              }}
            >
              <AlignRight className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={toolSquare(isTextAlignActive(ed, 'justify'))}
              title="Justify"
              aria-label="Justify"
              onClick={() => {
                ed.chain().focus().setTextAlign('justify').run()
                refresh()
              }}
            >
              <AlignJustify className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>

          <p className="mb-2 text-[11px] font-medium text-ink/60 dark:text-ink-dark/60">Insert</p>
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={toolSquare(ed.isActive('link'))}
                title="Link"
                aria-label="Link"
                onClick={() => {
                  openLinkPanel()
                }}
              >
                <Link2 className="h-5 w-5" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className={toolSquare(false)}
                title="Insert image"
                aria-label="Insert image"
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus className="h-5 w-5" strokeWidth={2.25} />
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
                className={`${toolSquare(false)} px-3`}
                title="Footnote"
                aria-label="Footnote"
                onClick={() => setFootnoteOpen((v) => !v)}
              >
                <NotebookPen className="h-5 w-5" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className={toolSquare(false)}
                title="Plain horizontal rule"
                aria-label="Plain horizontal rule"
                onClick={() => {
                  ed.chain().focus().setHorizontalRule().run()
                  refresh()
                }}
              >
                <Minus className="h-5 w-5" strokeWidth={2.25} />
              </button>
              <label className="sr-only" htmlFor="inkwell-mobile-scene-break">
                Scene break style
              </label>
              <select
                id="inkwell-mobile-scene-break"
                className="min-w-0 flex-1 rounded-xl border border-dust bg-white px-2 py-2 text-sm text-ink dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark"
                defaultValue=""
                aria-label="Insert scene break"
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'plain') ed.chain().focus().setHorizontalRule().run()
                  else if (v.startsWith('orn:')) {
                    const ornament = v.slice(4)
                    ed.chain().focus().insertContent({ type: 'horizontalRule', attrs: { ornament } }).run()
                  }
                  e.currentTarget.selectedIndex = 0
                  queueMicrotask(() => refresh())
                }}
              >
                <option value="" disabled>
                  Scene break…
                </option>
                <option value="plain">Plain rule</option>
                {SCENE_BREAK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {linkOpen ? (
              <div className="rounded-xl border border-dust bg-parchment/80 p-3 dark:border-border-dark dark:bg-panel-dark/80">
                <label className="mb-1 block text-xs font-semibold text-ink/80 dark:text-ink-dark/80" htmlFor="inkwell-mobile-link">
                  URL
                </label>
                <input
                  id="inkwell-mobile-link"
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyLink()
                    }
                  }}
                  placeholder="https://…"
                  className="mb-2 w-full rounded-xl border border-dust bg-white px-3 py-2 text-sm text-ink focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-cream"
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
                    onClick={() => {
                      ed.chain().focus().extendMarkRange('link').unsetLink().run()
                      setLinkOpen(false)
                      refresh()
                    }}
                  >
                    Remove link
                  </button>
                </div>
              </div>
            ) : null}

            {footnoteOpen ? (
              <div className="rounded-xl border border-dust bg-parchment/80 p-3 dark:border-border-dark dark:bg-panel-dark/80">
                <label className="mb-1 block text-xs font-semibold text-ink/80 dark:text-ink-dark/80" htmlFor="inkwell-mobile-fn">
                  Footnote text
                </label>
                <textarea
                  id="inkwell-mobile-fn"
                  value={footnoteDraft}
                  onChange={(e) => setFootnoteDraft(e.target.value)}
                  rows={3}
                  className="mb-2 w-full resize-y rounded-xl border border-dust bg-white px-3 py-2 text-sm text-ink focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-cream"
                  placeholder="Footnote content…"
                />
                <button
                  type="button"
                  className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-parchment hover:bg-walnut dark:bg-cream dark:text-ink dark:hover:bg-accent-warm"
                  onClick={applyFootnote}
                >
                  Insert footnote
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="inkwell-mobile-format-sheet-footer">
          <button
            type="button"
            className="w-full rounded-2xl bg-ink py-3 text-sm font-semibold text-parchment dark:bg-cream dark:text-ink"
            onClick={handleClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
