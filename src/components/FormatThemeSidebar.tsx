import { ChevronLeft, ChevronRight, Palette } from 'lucide-react'
import type { EbookTheme, PrintTheme, Theme } from '../types'
import {
  isThemePresetId,
  themePresetsGrouped,
  type ThemePresetId,
  type ThemePresetScope,
} from '../lib/themePresets'
import {
  FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS,
  FORMAT_WORKSPACE_SIDE_RAIL_WIDTH_CLASS,
} from '../lib/formatWorkspaceLayout'
import { EbookThemeForm } from './book-tools/EbookThemeForm'
import { PrintThemeForm } from './book-tools/PrintThemeForm'

type Props = {
  theme: Theme
  /** Which Format preview tab is active: only that side’s controls and presets apply. */
  formatScope: ThemePresetScope
  onThemeChange: (patch: { print?: Partial<PrintTheme>; ebook?: Partial<EbookTheme> }) => void
  onApplyThemePreset: (id: ThemePresetId) => void
  /** True when the active format tab has theme edits not yet saved to the project. */
  themeCommitDirty?: boolean
  /** Persist draft theme to the project (save + history). */
  onCommitTheme?: () => void
  themeCommitPending?: boolean
  collapsed: boolean
  onSetCollapsed: (collapsed: boolean) => void
  /**
   * Outer column width shared with the chapters rail so left/right stay matched and the center
   * does not shift when only one side collapses. When omitted, width follows collapsed state only.
   */
  sideColumnClassName?: string
}

export function FormatThemeSidebar({
  theme,
  formatScope,
  onThemeChange,
  onApplyThemePreset,
  themeCommitDirty = false,
  onCommitTheme,
  themeCommitPending = false,
  collapsed,
  onSetCollapsed,
  sideColumnClassName,
}: Props) {
  const outerCol =
    sideColumnClassName ??
    (collapsed ? FORMAT_WORKSPACE_SIDE_RAIL_WIDTH_CLASS : FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS)
  const lastForScope =
    formatScope === 'print' ? theme.lastPrintInteriorPresetId : theme.lastEbookInteriorPresetId
  const presetSelectValue =
    typeof lastForScope === 'string' && isThemePresetId(lastForScope) ? lastForScope : ''

  if (collapsed) {
    return (
      <aside
        className={`flex shrink-0 flex-col items-start gap-2 border-l border-dust bg-white/70 py-3 dark:border-border-dark dark:bg-panel-dark/70 sm:py-4 ${outerCol} transition-[width] duration-300 ease-out`}
      >
        <div
          className={`flex min-h-0 flex-1 flex-col items-center gap-2 ${FORMAT_WORKSPACE_SIDE_RAIL_WIDTH_CLASS}`}
        >
          <button
            type="button"
            onClick={() => onSetCollapsed(false)}
            className="inkwell-btn-icon-sm"
            aria-label="Expand theme panel"
            title="Show theme"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <div className="flex flex-1 flex-col items-center pt-1" aria-hidden>
            <Palette className="h-4 w-4 text-walnut/70 dark:text-accent-warm/80" strokeWidth={2} />
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={`flex shrink-0 flex-col border-l border-dust bg-white/70 transition-[width] duration-300 ease-out dark:border-border-dark dark:bg-panel-dark/70 ${outerCol}`}
    >
      <div className="flex items-center gap-1.5 border-b border-dust px-3 py-3 dark:border-border-dark sm:gap-2 sm:px-5 sm:py-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Palette className="h-4 w-4 shrink-0 text-walnut dark:text-accent-warm sm:h-5 sm:w-5" strokeWidth={2} />
          <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Theme
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onSetCollapsed(true)}
          className="inkwell-btn-icon-xs"
          aria-label="Collapse theme panel"
          title="Hide theme"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Interior preset ({formatScope === 'print' ? 'print' : 'ebook'})
          </span>
          <select
            value={presetSelectValue}
            className="w-full rounded-2xl border border-dust bg-parchment px-3 py-2.5 text-sm dark:border-border-dark dark:bg-panel-dark"
            onChange={(e) => {
              const v = e.target.value as ThemePresetId
              if (v) onApplyThemePreset(v)
            }}
          >
            <option value="" disabled>
              Apply genre pack…
            </option>
            {themePresetsGrouped().map(({ group, presets }) => (
              <optgroup key={group} label={group}>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {formatScope === 'print' ? (
          <PrintThemeForm theme={theme} onThemeChange={onThemeChange} />
        ) : (
          <EbookThemeForm theme={theme} onThemeChange={onThemeChange} />
        )}

        {onCommitTheme ? (
          <div className="pt-1">
            <button
              type="button"
              disabled={!themeCommitDirty || themeCommitPending}
              onClick={() => onCommitTheme()}
              className="w-full rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-parchment shadow-sm outline-none transition-opacity enabled:hover:opacity-95 focus-visible:ring-2 focus-visible:ring-walnut/45 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment/80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-cream dark:text-ink dark:focus-visible:ring-cream/55 dark:focus-visible:ring-offset-panel-dark"
            >
              {themeCommitPending ? 'Applying…' : 'Apply theme to book'}
            </button>
          </div>
        ) : null}
      </div>

      <p className="mt-auto border-t border-dust px-3 py-3 text-[11px] leading-snug text-ink/55 dark:border-border-dark dark:text-ink-dark/55 sm:px-5">
        {formatScope === 'print' ?
          'These settings apply to print preview, KDP PDF, and print exports. Switch to Ebook to adjust reflow typography.'
        : 'These settings apply to the ebook preview and EPUB. Switch to Print for trim, margins, and PDF layout.'}
      </p>
    </aside>
  )
}
