import { Mark, mergeAttributes } from '@tiptap/core'

/** Inline editorial comment on selected text; body stored on the mark for export and persistence. */
export const WriterComment = Mark.create({
  name: 'writerComment',

  inclusive: false,

  addAttributes() {
    return {
      body: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-body') ?? '',
        renderHTML: (attrs) => {
          if (!attrs.body) return {}
          return { 'data-body': attrs.body }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-writer-comment]',
        getAttrs: (el) => ({
          body: (el as HTMLElement).getAttribute('data-body') ?? '',
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        {
          'data-writer-comment': 'true',
          class: 'inkwell-writer-comment',
        },
        HTMLAttributes,
      ),
      0,
    ]
  },
})
