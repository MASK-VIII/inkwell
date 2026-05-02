import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export type CollapsibleSectionProps = {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={`group rounded-2xl border border-dust bg-white/45 dark:border-border-dark dark:bg-panel-dark/45 [&_summary::-webkit-details-marker]:hidden ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl px-3 py-3 text-left outline-none transition-colors hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-walnut dark:hover:bg-white/8 dark:focus-visible:ring-cream sm:px-4">
        <ChevronDown
          className="mt-0.5 h-4 w-4 shrink-0 text-walnut transition-transform duration-200 group-open:rotate-180 dark:text-accent-warm"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink dark:text-ink-dark">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs leading-snug text-ink/60 dark:text-ink-dark/60">
              {description}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="border-t border-dust/80 px-3 pb-4 pt-3 dark:border-border-dark/80 sm:px-4">{children}</div>
    </details>
  )
}
