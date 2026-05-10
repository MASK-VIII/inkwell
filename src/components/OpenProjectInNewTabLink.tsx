import { ExternalLink } from 'lucide-react'
import { buildInkwellUrlForProject } from '../lib/manuscripts'

type Props = {
  projectId: string
  /** Screen-reader / tooltip label */
  label?: string
  className?: string
  /** Toolbar-style control (no card border). */
  variant?: 'card' | 'ghost'
}

/**
 * Link to open an Inkwell book or note in a new browser tab (uses `?project=` deep link).
 */
export function OpenProjectInNewTabLink({
  projectId,
  label = 'Open in new tab',
  className = '',
  variant = 'card',
}: Props) {
  const href = buildInkwellUrlForProject(projectId)
  if (!href) return null
  const frame =
    variant === 'ghost'
      ? 'border-transparent bg-transparent text-faded hover:bg-dust/40 hover:text-ink dark:hover:bg-white/10 dark:hover:text-ink-dark'
      : 'border border-dust bg-panel-light/88 text-ink-muted hover:border-walnut/40 hover:bg-panel-light-strong hover:text-ink dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark/55 dark:hover:border-accent-warm/35 dark:hover:bg-panel-dark/90 dark:hover:text-ink-dark'
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors ${frame} ${className}`}
    >
      <ExternalLink className="h-4 w-4" strokeWidth={2.25} />
    </a>
  )
}
