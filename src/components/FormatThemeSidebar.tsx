import { ChevronLeft, ChevronRight, Palette } from 'lucide-react'
import type { EbookTheme, PrintTheme, Theme } from '../types'
import { THEME_PRESETS, type ThemePresetId } from '../lib/themePresets'
import { EbookThemeForm } from './book-tools/EbookThemeForm'
import { PrintThemeForm } from './book-tools/PrintThemeForm'

type Props = {
  theme: Theme
  onThemeChange: (patch: { print?: Partial<PrintTheme>; ebook?: Partial<EbookTheme> }) => void
  onApplyThemePreset: (id: ThemePresetId) => void
  collapsed: boolean
  onSetCollapsed: (collapsed: boolean) => void
}

export function FormatThemeSidebar({
  theme,
  onThemeChange,
  onApplyThemePreset,
  collapsed,
  onSetCollapsed,
}: Props) {
  if (collapsed) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center gap-2 border-l border-dust bg-white/70 py-3 dark:border-border-dark dark:bg-panel-dark/70 sm:w-12 sm:py-4">
        <button
          type="button"
          onClick={() => onSetCollapsed(false)}
          className="flex h-9 w-9 items-center justify-center rounded-2xl text-ink transition-colors hover:bg-dust/40 dark:text-ink-dark dark:hover:bg-border-dark/50"
          aria-label="Expand theme panel"
          title="Show theme"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <div className="flex flex-1 flex-col items-center pt-1" aria-hidden>
          <Palette className="h-4 w-4 text-walnut/70 dark:text-accent-warm/80" strokeWidth={2} />
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-[15.5rem] shrink-0 flex-col border-l border-dust bg-white/70 dark:border-border-dark dark:bg-panel-dark/70 sm:w-72">
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-ink transition-colors hover:bg-dust/40 dark:text-ink-dark dark:hover:bg-border-dark/50"
          aria-label="Collapse theme panel"
          title="Hide theme"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Interior preset
          </span>
          <select
            defaultValue=""
            className="w-full rounded-2xl border border-dust bg-parchment px-3 py-2.5 text-sm dark:border-border-dark dark:bg-panel-dark"
            onChange={(e) => {
              const v = e.target.value as ThemePresetId
              if (v) onApplyThemePreset(v)
              e.target.selectedIndex = 0
            }}
          >
            <option value="" disabled>
              Apply genre pack…
            </option>
            {THEME_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <PrintThemeForm theme={theme} onThemeChange={onThemeChange} />
        <EbookThemeForm theme={theme} onThemeChange={onThemeChange} />
      </div>

      <p className="mt-auto border-t border-dust px-3 py-3 text-[11px] leading-snug text-ink/55 dark:border-border-dark dark:text-ink-dark/55 sm:px-5">
        Print and ebook sections both affect your exports. Switch preview tabs to check each.
      </p>
    </aside>
  )
}
