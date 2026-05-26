import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import { listAddableMasterKinds, type MasterPageCatalogEntry } from '../lib/masterPages'
import type { InkwellProject } from '../types'

type Props = {
  project: InkwellProject
  onAddMasterPage: (entry: MasterPageCatalogEntry) => void
}

export function ContentsEditorBanner({ project, onAddMasterPage }: Props) {
  const addable = useMemo(() => listAddableMasterKinds(project), [project])

  if (addable.length === 0) return null

  return (
    <div className="mx-auto mb-4 max-w-[720px] border-b border-dust/80 px-2 pb-4 dark:border-border-dark sm:px-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink/50 dark:text-ink-dark/50">
        Add front matter
      </p>
      <div className="flex flex-wrap gap-2">
        {addable.map((entry) => (
          <button
            key={entry.kind}
            type="button"
            onClick={() => onAddMasterPage(entry)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dust bg-panel-light-muted/82 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-walnut hover:bg-parchment dark:border-border-dark dark:bg-panel-dark/60 dark:text-ink-dark dark:hover:border-cream"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  )
}
