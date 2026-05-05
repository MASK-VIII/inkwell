import Mention from '@tiptap/extension-mention'
import type { MentionItem } from './mentionUi'
import { filterMentionItems, inkwellMentionSuggestionRender } from './mentionUi'

export function inkwellMentionExtension(
  getItems: () => MentionItem[],
  mode: 'live' | 'import',
) {
  return Mention.configure({
    HTMLAttributes: {
      class: 'inkwell-mention',
    },
    renderText({ node }) {
      return `@${node.attrs.label ?? node.attrs.id ?? ''}`
    },
    renderHTML({ node }) {
      const id = String(node.attrs.id ?? '')
      const label = String(node.attrs.label ?? id)
      const fromAttr = node.attrs.noteProjectId != null ? String(node.attrs.noteProjectId) : ''
      const fromId = /^mention:note:(.+)$/.exec(id)?.[1] ?? ''
      const noteProjectId = fromAttr || fromId
      const attrs: Record<string, string> = {
        class: 'inkwell-mention',
        'data-type': 'mention',
        'data-id': id,
        'data-label': label,
      }
      if (noteProjectId) attrs['data-note-project-id'] = noteProjectId
      return ['span', attrs, `@${label}`]
    },
    suggestion: {
      char: '@',
      items: ({ query }) => (mode === 'import' ? [] : filterMentionItems(getItems(), query)),
      render:
        mode === 'import'
          ? () => ({})
          : () => inkwellMentionSuggestionRender(getItems)(),
    },
  })
}
