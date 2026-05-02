import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { liftListItem, sinkListItem } from '@tiptap/pm/schema-list'

const inkwellTabIndentPluginKey = new PluginKey('inkwellTabIndent')

/**
 * Tab / Shift+Tab: nest lists, insert/remove literal tab at the caret, always preventDefault so the
 * browser does not steal focus. Uses `view.dispatch` here — `editor.chain()` inside `handleKeyDown`
 * often does not apply during the same key frame.
 */
export const InkwellTabIndent = Extension.create({
  name: 'inkwellTabIndent',
  priority: 0,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: inkwellTabIndentPluginKey,
        props: {
          handleKeyDown(view, event) {
            if (event.key !== 'Tab') return false

            event.preventDefault()

            const { state } = view
            const listItem = state.schema.nodes.listItem

            if (event.shiftKey) {
              if (listItem && liftListItem(listItem)(state, view.dispatch)) return true
              const { from, empty } = state.selection
              if (empty && from > 0 && state.doc.textBetween(from - 1, from) === '\t') {
                view.dispatch(state.tr.delete(from - 1, from))
              }
              return true
            }

            if (listItem && sinkListItem(listItem)(state, view.dispatch)) return true

            view.dispatch(state.tr.insertText('\t'))
            return true
          },
        },
      }),
    ]
  },
})
