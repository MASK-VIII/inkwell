import { useEffect, useMemo, useState } from 'react'
import type { Manuscript, Theme } from '../types'
import { TRIM_PRESETS } from '../types'
import { paginateForPrintReview, type PrintPage } from '../lib/print/paginate'

const PX_PER_PT = 96 / 72

type Props = {
  chapters: Manuscript[]
  theme: Theme
  onJumpToChapter?: (chapterId: number) => void
}

export function PrintReview({ chapters, theme, onJumpToChapter }: Props) {
  const [pages, setPages] = useState<PrintPage[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const trim = TRIM_PRESETS[theme.print.trimPreset]
  const pageWidthPx = useMemo(() => trim.widthIn * 96, [trim.widthIn])
  const pageHeightPx = useMemo(() => trim.heightIn * 96, [trim.heightIn])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setPages(null)
      setErr(null)
    })
    ;(async () => {
      try {
        const p = await paginateForPrintReview(chapters, theme)
        if (!cancelled) setPages(p)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to paginate')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chapters, theme])

  if (err) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="max-w-xl rounded-3xl border border-dust bg-white/70 p-6 text-sm text-ink shadow-sm dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark">
          <div className="font-semibold">Print Review failed</div>
          <div className="mt-2 opacity-70">{err}</div>
        </div>
      </div>
    )
  }

  if (!pages) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-20 w-20 animate-pulse rounded-3xl bg-dust/40 dark:bg-border-dark/60" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto px-6 py-8 sm:px-10">
      <div className="mx-auto w-full max-w-[min(64rem,100%)]">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="font-serif text-2xl font-semibold tracking-tight">Review: Print</div>
            <div className="mt-1 text-xs text-ink/60 dark:text-ink-dark/60">
              Trim {trim.widthIn}" × {trim.heightIn}" · {pages.length.toLocaleString()} pages
            </div>
          </div>
        </div>

        <div className="space-y-10">
          {pages.map((p) => {
            const widthPx = p.widthPt * PX_PER_PT
            const heightPx = p.heightPt * PX_PER_PT
            const isFooter = theme.print.pageNumbers === 'footerCenter'
            return (
              <div key={p.pageNumber} className="flex flex-col items-center gap-3">
                <div
                  className="relative overflow-hidden rounded-sm bg-white shadow-[0_18px_55px_-28px_rgba(0,0,0,0.55)] ring-1 ring-dust/80 dark:ring-border-dark"
                  style={{
                    width: `${Math.min(widthPx, pageWidthPx)}px`,
                    height: `${Math.min(heightPx, pageHeightPx)}px`,
                  }}
                >
                  {p.isBlank ? null : (
                    <div className="absolute inset-0">
                      {p.lines.map((l, i) => {
                        const left = l.xPt * PX_PER_PT
                        const top = (p.heightPt - l.yPt) * PX_PER_PT
                        const fontSizePx = l.fontSizePt * PX_PER_PT
                        return (
                          <div
                            key={`${p.pageNumber}_${i}`}
                            className="absolute whitespace-pre text-ink"
                            style={{
                              left,
                              top,
                              fontFamily: 'var(--font-serif)',
                              fontSize: `${fontSizePx}px`,
                              lineHeight: `${theme.print.lineHeight}`,
                            }}
                            onClick={() => onJumpToChapter?.(l.chapterId)}
                            role={onJumpToChapter ? 'button' : undefined}
                            tabIndex={onJumpToChapter ? 0 : undefined}
                          >
                            {l.text}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {isFooter && (
                    <div className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-ink/70">
                      {p.pageNumber}
                    </div>
                  )}
                </div>
                <div className="text-xs font-medium text-ink/55 dark:text-ink-dark/55">Page {p.pageNumber}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

