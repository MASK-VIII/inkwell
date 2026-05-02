import type { SuggestionProps } from '@tiptap/suggestion'

export type MentionItem = { id: string; label: string }

export function filterMentionItems(items: MentionItem[], query: string): MentionItem[] {
  const q = query.trim().toLowerCase()
  const slice = items.slice(0, 16)
  if (!q) return slice
  return items
    .filter((i) => i.label.toLowerCase().includes(q) || String(i.id).toLowerCase().includes(q))
    .slice(0, 16)
}

/** Vanilla dropdown for @mention; avoids extra UI dependencies. */
export function inkwellMentionSuggestionRender(getItems: () => MentionItem[]) {
  let popup: HTMLDivElement | null = null
  let latest: SuggestionProps<MentionItem, MentionItem> | null = null
  let filtered: MentionItem[] = []
  let selected = 0

  function destroyPopup() {
    popup?.remove()
    popup = null
    latest = null
    filtered = []
    selected = 0
  }

  function syncList() {
    if (!popup || !latest) return
    filtered = filterMentionItems(getItems(), latest.query)
    selected = Math.min(selected, Math.max(0, filtered.length - 1))
    popup.innerHTML = ''
    const rectFn = latest.clientRect
    if (rectFn) {
      const rect = rectFn()
      if (rect) {
        popup.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`
        popup.style.top = `${rect.bottom + 6}px`
      }
    }
    filtered.forEach((item, i) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('role', 'option')
      btn.textContent = item.label
      btn.className =
        i === selected
          ? 'inkwell-mention-option inkwell-mention-option-active'
          : 'inkwell-mention-option'
      btn.addEventListener('mousedown', (e) => e.preventDefault())
      btn.addEventListener('click', () => latest?.command(item))
      popup!.appendChild(btn)
    })
    if (filtered.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'inkwell-mention-empty'
      empty.textContent = 'No matches'
      popup.appendChild(empty)
    }
  }

  return () => ({
    onStart: (props: SuggestionProps<MentionItem, MentionItem>) => {
      destroyPopup()
      latest = props
      popup = document.createElement('div')
      popup.className = 'inkwell-mention-popup'
      popup.setAttribute('role', 'listbox')
      document.body.appendChild(popup)
      selected = 0
      syncList()
    },
    onUpdate: (props: SuggestionProps<MentionItem, MentionItem>) => {
      latest = props
      syncList()
    },
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (!latest) return false
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (filtered.length) selected = (selected + 1) % filtered.length
        syncList()
        return true
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (filtered.length) selected = (selected - 1 + filtered.length) % filtered.length
        syncList()
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const pick = filtered[selected]
        if (pick) {
          event.preventDefault()
          latest.command(pick)
          return true
        }
      }
      return false
    },
    onExit: () => {
      destroyPopup()
    },
  })
}
