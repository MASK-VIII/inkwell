import CharacterCount from '@tiptap/extension-character-count'
import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import type { MentionItem } from './mentionUi'
import { PageBreak } from './extensions/PageBreak'
import { WriterComment } from './extensions/WriterComment'
import { WriterFootnote } from './extensions/WriterFootnote'
import { inkwellMentionExtension } from './inkwellMention'
import { InkwellTabIndent } from './extensions/InkwellTabIndent'

export function createManuscriptTipTapExtensions(opts: {
  getMentionItems: () => MentionItem[]
  mentionMode: 'live' | 'import'
}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: false,
      },
    }),
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph', 'blockquote'],
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: {
        class: 'inkwell-editor-img',
      },
    }),
    WriterComment,
    WriterFootnote,
    inkwellMentionExtension(opts.getMentionItems, opts.mentionMode),
    PageBreak,
    CharacterCount.configure({
      limit: null,
    }),
    /** After mention so @ suggestion can handle Tab first; prevents browser focus trap */
    InkwellTabIndent,
  ]
}
