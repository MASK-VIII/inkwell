import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

export type CollapsibleSectionProps = {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
  /** Fires after open state changes (user toggle or programmatic). */
  onOpenChange?: (open: boolean) => void
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
  className = '',
  onOpenChange,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  const toggle = () => {
    const next = !open
    setOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div
      className={`rounded-2xl border border-dust bg-panel-light-muted/68 dark:border-border-dark dark:bg-panel-dark/45 ${className}`}
    >
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex w-full cursor-pointer items-start gap-3 rounded-2xl px-3 py-3 text-left outline-none transition-colors hover:bg-panel-light-muted/78 focus-visible:ring-2 focus-visible:ring-walnut dark:hover:bg-white/8 dark:focus-visible:ring-cream sm:px-4"
      >
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-walnut transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none dark:text-accent-warm ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-ink dark:text-ink-dark">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs leading-snug text-ink/60 dark:text-ink-dark/60">
              {description}
            </span>
          ) : null}
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none motion-reduce:duration-0 ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0">
          <div className="border-t border-dust/80 px-3 pb-4 pt-3 dark:border-border-dark/80 sm:px-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
