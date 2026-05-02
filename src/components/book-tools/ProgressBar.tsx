export function ProgressBar({
  label,
  current,
  target,
}: {
  label: string
  current: number
  target: number
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium text-walnut/90 dark:text-accent-warm/90">
        <span>{label}</span>
        <span>
          {current.toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-dust/60 dark:bg-border-dark/80">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-300 dark:bg-cream"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
