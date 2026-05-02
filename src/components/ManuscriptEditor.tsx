import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor, JSONContent } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {
  Bold,
  Feather,
  Italic,
  List,
  ListOrdered,
  Quote,
  Scissors,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { memo, useEffect, useState, type MutableRefObject } from 'react'
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

type Props = {
  manuscriptId: number
  content: JSONContent
  onDocumentChange: (json: JSONContent) => void
  editorRef: MutableRefObject<Editor | null>
  /** Slimmer word/char line for minimal chrome */
  compactFooterStats?: boolean
  /** Compact padding and editor min-height for floating popout */
  embedded?: boolean
}

function ManuscriptEditorInner({
  manuscriptId,
  content,
  onDocumentChange,
  editorRef,
  compactFooterStats,
  embedded,
}: Props) {
  const [, setToolbarVersion] = useState(0)

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Underline,
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
        setToolbarVersion((v) => v + 1)
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
    const bump = () => setToolbarVersion((v) => v + 1)
    editor.on('selectionUpdate', bump)
    return () => {
      editor.off('selectionUpdate', bump)
    }
  }, [editor])

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
            setToolbarVersion((x) => x + 1)
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

        <div className="min-w-[1rem] flex-1" />

        <button
          type="button"
          className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50 sm:px-4"
          title="Insert page break (Ctrl/Cmd+Enter)"
          onClick={() => editor?.chain().focus().insertPageBreak().run()}
        >
          <Scissors className="h-4 w-4" strokeWidth={2.25} />
          <span className="hidden sm:inline">Page break</span>
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
    prev.embedded === next.embedded
  )
})
