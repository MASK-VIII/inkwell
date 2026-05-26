import CharacterCount from '@tiptap/extension-character-count'
import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import type { MentionItem } from './mentionUi'
import { InkwellParagraph } from './extensions/InkwellParagraph'
import { PageBreak } from './extensions/PageBreak'
import { InkwellSceneBreak } from './extensions/InkwellSceneBreak'
import { WriterComment } from './extensions/WriterComment'
import { WriterFootnote } from './extensions/WriterFootnote'
import { inkwellMentionExtension } from './inkwellMention'
import { InkwellTabIndent } from './extensions/InkwellTabIndent'
import { inkwellTypewriterScrollExtension } from './extensions/InkwellTypewriterScroll'
import type { TypewriterMode } from '../typewriterMode'

export function createManuscriptTipTapExtensions(opts: {
  getMentionItems: () => MentionItem[]
  mentionMode: 'live' | 'import'
  /** Reserved for `[[wikilink]]` suggestion (wired in editor; extension TBD). */
  getWikilinkCandidates?: () => MentionItem[]
  wikilinkMode?: 'live' | 'import'
  getTypewriterMode?: () => TypewriterMode
  getScrollRoot?: () => HTMLElement | null
}) {
  void opts.getWikilinkCandidates
  void opts.wikilinkMode
  const scrollExt =
    opts.getTypewriterMode && opts.getScrollRoot
      ? inkwellTypewriterScrollExtension({
          getTypewriterMode: opts.getTypewriterMode,
          getScrollRoot: opts.getScrollRoot,
        })
      : null
  return [
    StarterKit.configure({
      paragraph: false,
      heading: { levels: [1, 2, 3] },
      horizontalRule: false,
      link: {
        openOnClick: false,
        autolink: false,
      },
    }),
    InkwellParagraph,
    InkwellSceneBreak,
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
    ...(scrollExt ? [scrollExt] : []),
  ]
}
