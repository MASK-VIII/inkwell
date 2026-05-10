import { useEffect, useRef } from 'react'

export type InkwellEditorLinkMenuItem = {
  label: string
  onSelect: () => void
}

/** Allows http(s) and mailto for “Open link”; blocks javascript: etc. */
export function inkwellSafeExternalHref(href: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const u = new URL(href.trim(), window.location.origin)
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') return u.href
    return null
  } catch {
    return null
  }
}

export function InkwellEditorLinkMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: InkwellEditorLinkMenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    let detachMouse: (() => void) | null = null
    const id = window.requestAnimationFrame(() => {
      if (cancelled) return
      document.addEventListener('mousedown', onMouseDown)
      detachMouse = () => document.removeEventListener('mousedown', onMouseDown)
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(id)
      window.removeEventListener('keydown', onKey)
      detachMouse?.()
    }
  }, [onClose])

  if (items.length === 0) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const menuW = 260
  const estH = 12 + items.length * 44
  const left = Math.min(Math.max(8, x), vw - menuW - 8)
  const top = Math.min(Math.max(8, y + 4), vh - estH - 8)

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Link options"
      className="fixed z-[6000] min-w-[16rem] rounded-2xl border border-dust bg-white py-1 shadow-xl dark:border-border-dark dark:bg-panel-dark"
      style={{ left, top }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          className="flex w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-dust/40 dark:text-ink-dark dark:hover:bg-border-dark/50"
          onClick={() => {
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
