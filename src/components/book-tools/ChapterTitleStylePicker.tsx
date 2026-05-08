import type { ChapterTitleStyleId, ChapterTitleStyleSpec } from '../../types'
import { CHAPTER_TITLE_STYLES } from '../../types'

type Props = {
  id: string
  label: string
  value: ChapterTitleStyleId
  onChange: (id: ChapterTitleStyleId) => void
  disabled?: boolean
}

const STYLE_ENTRIES: { id: ChapterTitleStyleId; spec: ChapterTitleStyleSpec }[] = (
  Object.entries(CHAPTER_TITLE_STYLES) as [ChapterTitleStyleId, ChapterTitleStyleSpec][]
).map(([id, spec]) => ({ id, spec }))

const NAMED_STYLES = STYLE_ENTRIES.filter((e) => e.id !== 'inherit')

const GROUP_ORDER: NonNullable<ChapterTitleStyleSpec['group']>[] = [
  'Serif caps',
  'Display',
  'Sans',
  'Minimal',
]

export function ChapterTitleStylePicker({ id, label, value, onChange, disabled }: Props) {
  const groupedNamed: { group: string; entries: typeof NAMED_STYLES }[] = []
  const seen = new Map<string, number>()
  for (const g of GROUP_ORDER) {
    seen.set(g, groupedNamed.length)
    groupedNamed.push({ group: g, entries: [] })
  }
  for (const entry of NAMED_STYLES) {
    const g = entry.spec.group ?? 'Other'
    let idx = seen.get(g)
    if (idx == null) {
      idx = groupedNamed.length
      seen.set(g, idx)
      groupedNamed.push({ group: g, entries: [] })
    }
    groupedNamed[idx]!.entries.push(entry)
  }
  const populated = groupedNamed.filter((g) => g.entries.length > 0)

  const currentSpec = CHAPTER_TITLE_STYLES[value]

  return (
    <label className="block space-y-1" htmlFor={id}>
      <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">{label}</span>
      <select
        id={id}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value as ChapterTitleStyleId)}
        className="w-full rounded-2xl border border-dust bg-parchment px-3 py-2 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream disabled:opacity-50"
      >
        <option value="inherit">{CHAPTER_TITLE_STYLES.inherit.label}</option>
        {populated.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.entries.map(({ id: sid, spec }) => (
              <option key={sid} value={sid}>
                {spec.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="block text-[11px] text-ink/55 dark:text-ink-dark/55">
        {value === 'inherit'
          ? 'Defers to the interior preset; chapter title uses the body font.'
          : currentSpec.label}
      </span>
    </label>
  )
}
