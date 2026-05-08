import Paragraph from '@tiptap/extension-paragraph'

/** Paragraph with optional drop cap for ebook / print-themed layouts. */
export const InkwellParagraph = Paragraph.extend({
  name: 'paragraph',

  addAttributes() {
    return {
      ...this.parent?.(),
      inkwellDropCap: {
        default: false,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-inkwell-drop-cap') === 'true',
        renderHTML: (attrs) =>
          attrs.inkwellDropCap ?
            { 'data-inkwell-drop-cap': 'true', class: 'inkwell-drop-cap-para' }
          : {},
      },
    }
  },
})
