import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import type { BookMeta, Manuscript, Theme } from '../types'
import { TRIM_PRESETS } from '../types'
import type { PrintPage } from '../lib/print/paginate'
import { nextWorkerRev, onWorkerMessage, sendWorker } from '../lib/workerClient'

const PX_PER_PT = 96 / 72

type Props = {
  chapters: Manuscript[]
  theme: Theme
  book: BookMeta
  /** When this changes (e.g. chapter click in sidebar), scroll preview to that chapter's start page */
  scrollToChapterId?: number | null
  onJumpToChapter?: (chapterId: number) => void
}

export function PrintReview({ chapters, theme, book, scrollToChapterId, onJumpToChapter }: Props) {
  const [pages, setPages] = useState<PrintPage[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const pageAnchorRefs = useRef(new Map<number, HTMLDivElement>())

  const trim = TRIM_PRESETS[theme.print.trimPreset]
  const pageWidthPx = useMemo(() => trim.widthIn * 96, [trim.widthIn])
  const pageHeightPx = useMemo(() => trim.heightIn * 96, [trim.heightIn])

  useEffect(() => {
    const job = nextWorkerRev()
    startTransition(() => {
      setPages(null)
      setErr(null)
    })

    const unsub = onWorkerMessage((msg) => {
      if (msg.kind === 'error' && msg.job === 'paginatePrint' && msg.rev === job) {
        setPages(null)
        setErr(msg.message)
        return
      }
      if (msg.kind !== 'printChunk' || msg.rev !== job) return
      setPages((prev) => (prev == null ? [...msg.pages] : [...prev, ...msg.pages]))
    })

    sendWorker({
      kind: 'paginatePrint',
      rev: job,
      chapters,
      theme,
      meta: { bookTitle: book.title, authorName: book.authorName },
    })

    return () => unsub()
  }, [chapters, theme, book.title, book.authorName])

  useEffect(() => {
    if (scrollToChapterId == null || !pages?.length) return
    const target = pages.find(
      (pg) => !pg.isBlank && pg.lines.some((l) => l.kind === 'body' && l.chapterId === scrollToChapterId),
    )
    if (!target) return
    const el = pageAnchorRefs.current.get(target.pageNumber)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollToChapterId, pages])

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
            return (
              <div
                key={p.pageNumber}
                ref={(el) => {
                  if (!el) {
                    pageAnchorRefs.current.delete(p.pageNumber)
                    return
                  }
                  pageAnchorRefs.current.set(p.pageNumber, el)
                }}
                className="flex flex-col items-center gap-3 scroll-mt-6"
              >
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

