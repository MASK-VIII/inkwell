import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Insert a hard page break node. */
      insertPageBreak: () => ReturnType
      /** Remove the currently selected page break node (if any). */
      removePageBreak: () => ReturnType
    }
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',

  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-break',
        class: 'inkwell-page-break',
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.insertPageBreak(),
    }
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ commands }) => {
          // Ensure it behaves like a block break (own line).
          return commands.insertContent({ type: this.name })
        },
      removePageBreak:
        () =>
        ({ state, commands }) => {
          const { selection } = state
          const node = selection.$from.nodeAfter
          if (!node || node.type.name !== this.name) return false
          return commands.deleteRange({
            from: selection.from,
            to: selection.from + node.nodeSize,
          })
        },
    }
  },
})

