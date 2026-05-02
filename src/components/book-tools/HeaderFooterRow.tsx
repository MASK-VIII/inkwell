import type { PrintHeaderFooterSlots, PrintHeaderFooterToken } from '../../types'

const HF_TOKENS: { id: PrintHeaderFooterToken; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'bookTitle', label: 'Book title' },
  { id: 'author', label: 'Author' },
  { id: 'chapterTitle', label: 'Chapter title' },
  { id: 'pageNumber', label: 'Page number' },
]

export function HeaderFooterRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: PrintHeaderFooterSlots
  onChange: (next: PrintHeaderFooterSlots) => void
}) {
  const slotSelect = (slot: keyof PrintHeaderFooterSlots) => (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
        {slot}
      </span>
      <select
        value={value[slot]}
        onChange={(e) => onChange({ ...value, [slot]: e.target.value as PrintHeaderFooterToken })}
        className="w-full rounded-2xl border border-dust bg-parchment px-3 py-2 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
      >
        {HF_TOKENS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-widest text-walnut/80 dark:text-accent-warm/80">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {slotSelect('left')}
        {slotSelect('center')}
        {slotSelect('right')}
      </div>
    </div>
  )
}
