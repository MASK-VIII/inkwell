import { Mark, mergeAttributes } from '@tiptap/core'

/** Superscript marker with note body on the mark; ebook export emits an ordered notes section. */
export const WriterFootnote = Mark.create({
  name: 'writerFootnote',

  inclusive: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-fn-id'),
        renderHTML: (attrs) => {
          if (!attrs.id) return {}
          return { 'data-fn-id': attrs.id }
        },
      },
      content: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-fn-content') ?? '',
        renderHTML: (attrs) => {
          if (!attrs.content) return {}
          return { 'data-fn-content': attrs.content }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'sup[data-writer-footnote]',
        getAttrs: (el) => ({
          id: (el as HTMLElement).getAttribute('data-fn-id'),
          content: (el as HTMLElement).getAttribute('data-fn-content') ?? '',
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(
        {
          'data-writer-footnote': 'true',
          class: 'inkwell-fn-ref',
        },
        HTMLAttributes,
      ),
      0,
    ]
  },
})
