import type { InkwellFontId } from '../../types'
import { listFontsByCategory } from '../../lib/fonts/fontCatalog'

type Props = {
  id: string
  label: string
  value: InkwellFontId
  onChange: (id: InkwellFontId) => void
  disabled?: boolean
}

export function BodyFontPicker({ id, label, value, onChange, disabled }: Props) {
  const groups = listFontsByCategory()
  return (
    <label className="block space-y-1" htmlFor={id}>
      <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">{label}</span>
      <select
        id={id}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value as InkwellFontId)}
        className="w-full rounded-2xl border border-dust bg-parchment px-3 py-2 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream disabled:opacity-50"
      >
        {groups.map((g) => (
          <optgroup key={g.category} label={g.category}>
            {g.fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
