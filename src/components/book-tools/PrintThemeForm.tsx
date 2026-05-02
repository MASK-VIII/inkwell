import type { PrintTheme, Theme, TrimPresetId } from '../../types'
import { TRIM_PRESETS } from '../../types'
import { clampNumber } from './clamp'
import { HeaderFooterRow } from './HeaderFooterRow'

type Props = {
  theme: Theme
  onThemeChange: (patch: { print?: Partial<PrintTheme> }) => void
}

export function PrintThemeForm({ theme, onThemeChange }: Props) {
  const printPreset = TRIM_PRESETS[theme.print.trimPreset]

  return (
    <div className="rounded-2xl border border-dust bg-parchment/80 p-4 dark:border-border-dark dark:bg-panel-dark/80 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink dark:text-ink-dark">Print</div>
          <div className="mt-0.5 text-xs text-ink/60 dark:text-ink-dark/60">
            Trim {printPreset.widthIn}" × {printPreset.heightIn}"
          </div>
        </div>
        <label className="block min-w-[12rem] space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Trim preset
          </span>
          <select
            value={theme.print.trimPreset}
            onChange={(e) => onThemeChange({ print: { trimPreset: e.target.value as TrimPresetId } })}
            className="w-full rounded-2xl border border-dust bg-parchment px-3 py-2 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          >
            {Object.values(TRIM_PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Font size (pt)</span>
          <input
            type="number"
            step={0.5}
            min={8}
            max={18}
            value={theme.print.fontSizePt}
            onChange={(e) =>
              onThemeChange({
                print: { fontSizePt: clampNumber(e.target.value, theme.print.fontSizePt, 8, 18) },
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
            max={2.2}
            value={theme.print.lineHeight}
            onChange={(e) =>
              onThemeChange({
                print: { lineHeight: clampNumber(e.target.value, theme.print.lineHeight, 1.1, 2.2) },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Top margin (in)</span>
          <input
            type="number"
            step={0.05}
            min={0.25}
            max={2}
            value={theme.print.marginTopIn}
            onChange={(e) =>
              onThemeChange({
                print: { marginTopIn: clampNumber(e.target.value, theme.print.marginTopIn, 0.25, 2) },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Bottom margin (in)</span>
          <input
            type="number"
            step={0.05}
            min={0.25}
            max={2}
            value={theme.print.marginBottomIn}
            onChange={(e) =>
              onThemeChange({
                print: {
                  marginBottomIn: clampNumber(e.target.value, theme.print.marginBottomIn, 0.25, 2),
                },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Inner margin (in)</span>
          <input
            type="number"
            step={0.05}
            min={0.25}
            max={2}
            value={theme.print.marginInnerIn}
            onChange={(e) =>
              onThemeChange({
                print: { marginInnerIn: clampNumber(e.target.value, theme.print.marginInnerIn, 0.25, 2) },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Outer margin (in)</span>
          <input
            type="number"
            step={0.05}
            min={0.25}
            max={2}
            value={theme.print.marginOuterIn}
            onChange={(e) =>
              onThemeChange({
                print: { marginOuterIn: clampNumber(e.target.value, theme.print.marginOuterIn, 0.25, 2) },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 items-end">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Gutter (in)</span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={theme.print.gutterIn}
            onChange={(e) =>
              onThemeChange({
                print: { gutterIn: clampNumber(e.target.value, theme.print.gutterIn, 0, 1) },
              })
            }
            className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-dust bg-parchment px-4 py-3 text-sm dark:border-border-dark dark:bg-panel-dark">
          <span className="text-sm font-medium text-ink/80 dark:text-ink-dark/80">Hyphenation</span>
          <input
            type="checkbox"
            checked={theme.print.hyphenation}
            onChange={(e) => onThemeChange({ print: { hyphenation: e.target.checked } })}
            className="h-4 w-4 accent-ink dark:accent-cream"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-dust bg-white/60 p-4 dark:border-border-dark dark:bg-panel-dark/60 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink dark:text-ink-dark">Headers & footers</div>
            <div className="mt-0.5 text-xs text-ink/60 dark:text-ink-dark/60">
              Configure odd/even page header/footer content.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-dust bg-parchment px-4 py-3 text-sm dark:border-border-dark dark:bg-panel-dark">
            <span className="text-sm font-medium text-ink/80 dark:text-ink-dark/80">Header</span>
            <input
              type="checkbox"
              checked={theme.print.header.enabled}
              onChange={(e) =>
                onThemeChange({ print: { header: { ...theme.print.header, enabled: e.target.checked } } })
              }
              className="h-4 w-4 accent-ink dark:accent-cream"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-dust bg-parchment px-4 py-3 text-sm dark:border-border-dark dark:bg-panel-dark">
            <span className="text-sm font-medium text-ink/80 dark:text-ink-dark/80">Footer</span>
            <input
              type="checkbox"
              checked={theme.print.footer.enabled}
              onChange={(e) =>
                onThemeChange({ print: { footer: { ...theme.print.footer, enabled: e.target.checked } } })
              }
              className="h-4 w-4 accent-ink dark:accent-cream"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Header size (pt)</span>
            <input
              type="number"
              step={0.5}
              min={6}
              max={14}
              value={theme.print.header.fontSizePt}
              onChange={(e) =>
                onThemeChange({
                  print: {
                    header: {
                      ...theme.print.header,
                      fontSizePt: clampNumber(e.target.value, theme.print.header.fontSizePt, 6, 14),
                    },
                  },
                })
              }
              className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Footer size (pt)</span>
            <input
              type="number"
              step={0.5}
              min={6}
              max={14}
              value={theme.print.footer.fontSizePt}
              onChange={(e) =>
                onThemeChange({
                  print: {
                    footer: {
                      ...theme.print.footer,
                      fontSizePt: clampNumber(e.target.value, theme.print.footer.fontSizePt, 6, 14),
                    },
                  },
                })
              }
              className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
            />
          </label>
        </div>

        <HeaderFooterRow
          label="Header (odd pages)"
          value={theme.print.header.odd}
          onChange={(next) => onThemeChange({ print: { header: { ...theme.print.header, odd: next } } })}
        />
        <HeaderFooterRow
          label="Header (even pages)"
          value={theme.print.header.even}
          onChange={(next) => onThemeChange({ print: { header: { ...theme.print.header, even: next } } })}
        />
        <HeaderFooterRow
          label="Footer (odd pages)"
          value={theme.print.footer.odd}
          onChange={(next) => onThemeChange({ print: { footer: { ...theme.print.footer, odd: next } } })}
        />
        <HeaderFooterRow
          label="Footer (even pages)"
          value={theme.print.footer.even}
          onChange={(next) => onThemeChange({ print: { footer: { ...theme.print.footer, even: next } } })}
        />
      </div>
    </div>
  )
}
