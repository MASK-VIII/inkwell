/** Shared drag preview card (bookshelf notes + chapter reorder). */
export function attachInkwellDragGhost(
  e: DragEvent,
  previewTitle: string,
  opts?: { fallback?: string; icon?: string },
): void {
  const dt = e.dataTransfer
  if (!dt) return

  const fallback = opts?.fallback ?? 'Note'
  const iconChar = opts?.icon ?? '🪶'

  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:absolute;left:-9999px;top:0;pointer-events:none'
  if (document.documentElement.classList.contains('dark')) {
    wrap.classList.add('dark')
  }

  const ghost = document.createElement('div')
  ghost.className = 'inkwell-shelf-note-drag-ghost'

  const icon = document.createElement('span')
  icon.className = 'inkwell-shelf-note-drag-ghost-icon'
  icon.setAttribute('aria-hidden', 'true')
  icon.textContent = iconChar

  const titleEl = document.createElement('span')
  titleEl.className = 'inkwell-shelf-note-drag-ghost-title'
  titleEl.textContent = previewTitle.trim().slice(0, 56) || fallback

  ghost.append(icon, titleEl)
  wrap.appendChild(ghost)
  document.body.appendChild(wrap)

  const rect = ghost.getBoundingClientRect()
  dt.setDragImage(wrap, Math.min(rect.width / 2, 72), rect.height / 2)

  requestAnimationFrame(() => wrap.remove())
}
