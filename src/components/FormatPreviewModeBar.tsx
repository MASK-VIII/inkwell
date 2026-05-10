type Props = {
  mode: 'print' | 'ebook'
  onSelectEbook: () => void
  onSelectPrint: () => void
}

export function FormatPreviewModeBar({ mode, onSelectEbook, onSelectPrint }: Props) {
  const seg = (active: boolean) =>
    `min-w-[6.25rem] rounded-xl px-4 py-2 text-center text-sm font-semibold transition-colors sm:min-w-[7rem] ${
      active ?
        'bg-ink text-parchment shadow-sm dark:bg-cream dark:text-ink'
      : 'text-ink/75 hover:bg-dust/40 dark:text-ink-dark/75 dark:hover:bg-border-dark/50'
    }`

  return (
    <div
      data-inkwell-tour="format-preview-modes"
      className="inline-flex shrink-0 rounded-2xl border border-dust bg-panel-light-strong/92 p-1 shadow-sm dark:border-border-dark dark:bg-panel-dark/90"
      role="tablist"
      aria-label="Preview mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'ebook'}
        className={seg(mode === 'ebook')}
        onClick={onSelectEbook}
      >
        Ebook
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'print'}
        className={seg(mode === 'print')}
        onClick={onSelectPrint}
      >
        Print
      </button>
    </div>
  )
}
