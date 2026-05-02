import type { EbookTheme, Theme } from '../../types'
import { clampNumber } from './clamp'

type Props = {
  theme: Theme
  onThemeChange: (patch: { ebook?: Partial<EbookTheme> }) => void
}

export function EbookThemeForm({ theme, onThemeChange }: Props) {
  return (
    <div className="rounded-2xl border border-dust bg-parchment/80 p-4 dark:border-border-dark dark:bg-panel-dark/80 space-y-3">
      <div className="text-sm font-semibold text-ink dark:text-ink-dark">Ebook</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Base font size (px)</span>
          <input
            type="number"
            step={1}
            min={12}
            max={28}
            value={theme.ebook.baseFontSizePx}
            onChange={(e) =>
              onThemeChange({
                ebook: {
                  baseFontSizePx: clampNumber(e.target.value, theme.ebook.baseFontSizePx, 12, 28),
                },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Line height</span>
          <input
            type="number"
            step={0.05}
            min={1.1}
            max={2.4}
            value={theme.ebook.lineHeight}
            onChange={(e) =>
              onThemeChange({
                ebook: { lineHeight: clampNumber(e.target.value, theme.ebook.lineHeight, 1.1, 2.4) },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Reader width (px)</span>
          <input
            type="number"
            step={10}
            min={280}
            max={900}
            value={theme.ebook.maxWidthPx}
            onChange={(e) =>
              onThemeChange({
                ebook: { maxWidthPx: clampNumber(e.target.value, theme.ebook.maxWidthPx, 280, 900) },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Paragraph spacing (em)</span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={3}
            value={theme.ebook.paragraphSpacingEm}
            onChange={(e) =>
              onThemeChange({
                ebook: {
                  paragraphSpacingEm: clampNumber(e.target.value, theme.ebook.paragraphSpacingEm, 0, 3),
                },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 items-end">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Text align</span>
          <select
            value={theme.ebook.textAlign}
            onChange={(e) => onThemeChange({ ebook: { textAlign: e.target.value as 'left' | 'justify' } })}
            className="w-full rounded-2xl border border-dust bg-parchment px-3 py-2 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          >
            <option value="left">Left</option>
            <option value="justify">Justify</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">First line indent (em)</span>
          <input
            type="number"
            step={0.1}
            min={0}
            max={6}
            value={theme.ebook.firstLineIndentEm}
            onChange={(e) =>
              onThemeChange({
                ebook: {
                  firstLineIndentEm: clampNumber(e.target.value, theme.ebook.firstLineIndentEm, 0, 6),
                },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
      </div>
    </div>
  )
}
