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
      const label = node.attrs.label ?? node.attrs.id ?? ''
      return [
        'span',
        {
          class: 'inkwell-mention',
          'data-type': 'mention',
          'data-id': node.attrs.id ?? '',
          'data-label': label,
        },
        `@${label}`,
      ]
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
