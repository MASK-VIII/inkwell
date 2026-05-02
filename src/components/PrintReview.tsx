import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { BookMeta, Manuscript, Theme } from '../types'
import { TRIM_PRESETS } from '../types'
import type { PrintPage } from '../lib/print/paginate'
import { hashStringDjb2 } from '../lib/hash'
import {
  nextWorkerRev,
  onWorkerMessage,
  sendWorker,
  type PrintChapterResultMsg,
  type WorkerErrorMsg,
  type WorkerResponse,
} from '../lib/workerClient'
import '../printPreviewFont.css'

const PX_PER_PT = 96 / 72

type Props = {
  chapters: Manuscript[]
  theme: Theme
  book: BookMeta
  /** When this changes (e.g. chapter click in sidebar), show this chapter */
  scrollToChapterId?: number | null
  onJumpToChapter?: (chapterId: number) => void
  /** Stay in print review and switch chapter (e.g. header dropdown) */
  onChapterSelect?: (chapterId: number) => void
  onPrevChapter?: () => void
  onNextChapter?: () => void
}

function printChapterPromise(
  pending: Map<number, (msg: PrintChapterResultMsg | WorkerErrorMsg) => void>,
  chapterIndex: number,
  chapter: Manuscript,
  theme: Theme,
  meta: { bookTitle: string; authorName: string },
  startPageNumber: number,
): Promise<PrintChapterResultMsg> {
  const rev = nextWorkerRev()
  return new Promise((resolve, reject) => {
    pending.set(rev, (msg) => {
      if (msg.kind === 'error') {
        reject(new Error(msg.message))
        return
      }
      resolve(msg)
    })
    sendWorker({
      kind: 'paginatePrintChapter',
      rev,
      chapterIndex,
      chapter,
      theme,
      meta,
      startPageNumber,
    })
  })
}

export function PrintReview({
  chapters,
  theme,
  book,
  scrollToChapterId,
  onJumpToChapter,
  onChapterSelect,
  onPrevChapter,
  onNextChapter,
}: Props) {
  const [err, setErr] = useState<string | null>(null)
  const [chapterPages, setChapterPages] = useState<Map<number, PrintPage[]>>(() => new Map())
  const [inflight, setInflight] = useState<Set<number>>(() => new Set())
  const [pageIndexInChapter, setPageIndexInChapter] = useState(0)
  const [jumpDraft, setJumpDraft] = useState('')
  const [viewportBox, setViewportBox] = useState({ w: 400, h: 560 })

  const viewportRef = useRef<HTMLDivElement>(null)
  const pendingHandlers = useRef(new Map<number, (msg: PrintChapterResultMsg | WorkerErrorMsg) => void>())
  const layoutEpochRef = useRef(0)
  const pendingPageIndexRef = useRef<number | null>(null)
  const [localChapterId, setLocalChapterId] = useState<number | null>(null)

  const trim = TRIM_PRESETS[theme.print.trimPreset]
  const pageWidthPx = trim.widthIn * 96
  const pageHeightPx = trim.heightIn * 96

  useEffect(() => {
    setLocalChapterId(null)
  }, [scrollToChapterId])

  const activeChapterId = localChapterId ?? scrollToChapterId ?? chapters[0]?.id ?? null
  const activeChapterIndex = useMemo(() => {
    if (activeChapterId == null) return -1
    return chapters.findIndex((c) => c.id === activeChapterId)
  }, [chapters, activeChapterId])

  const meta = useMemo(
    () => ({ bookTitle: book.title, authorName: book.authorName }),
    [book.title, book.authorName],
  )

  const layoutDepsKey = useMemo(() => {
    const chapterSig = chapters
      .map((c) => `${c.id}:${hashStringDjb2(JSON.stringify(c.content))}:${hashStringDjb2(c.title)}`)
      .join('|')
    return `${chapterSig}|${hashStringDjb2(JSON.stringify(theme))}|${meta.bookTitle}|${meta.authorName}`
  }, [chapters, theme, meta.bookTitle, meta.authorName])

  useEffect(() => {
    const unsub = onWorkerMessage((msg: WorkerResponse) => {
      if (msg.kind !== 'printChapterResult' && !(msg.kind === 'error' && msg.job === 'paginatePrintChapter')) return
      const cb = pendingHandlers.current.get(msg.rev)
      if (cb) {
        pendingHandlers.current.delete(msg.rev)
        cb(msg)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (pendingPageIndexRef.current != null) {
      setPageIndexInChapter(pendingPageIndexRef.current)
      pendingPageIndexRef.current = null
      return
    }
    setPageIndexInChapter(0)
  }, [scrollToChapterId, localChapterId])

  useEffect(() => {
    layoutEpochRef.current += 1
    const epoch = layoutEpochRef.current

    startTransition(() => {
      setChapterPages(new Map())
      setInflight(new Set())
      setErr(null)
      setPageIndexInChapter(0)
    })

    if (chapters.length === 0) return

    let cancelled = false
    const inflightLocal = new Set<number>()
    const pagesLocal = new Map<number, PrintPage[]>()
    /** True start page used once sequential pagination has completed for this chapter. */
    const sequentialAuthoritativeStart = new Map<number, number>()

    const pushInflight = () => {
      if (cancelled || epoch !== layoutEpochRef.current) return
      setInflight(new Set(inflightLocal))
    }

    const pushPages = () => {
      if (cancelled || epoch !== layoutEpochRef.current) return
      setChapterPages(new Map(pagesLocal))
    }

    const maybeApplyPrefetch = (msg: PrintChapterResultMsg) => {
      const auth = sequentialAuthoritativeStart.get(msg.chapterId)
      if (auth != null && auth !== msg.startPageNumber) return
      pagesLocal.set(msg.chapterId, msg.pages)
      pushPages()
    }

    const run = async () => {
      try {
        const priorityId = scrollToChapterId ?? chapters[0]!.id
        const pidx = chapters.findIndex((c) => c.id === priorityId)
        if (pidx >= 0) {
          const pch = chapters[pidx]!
          inflightLocal.add(pch.id)
          pushInflight()
          try {
            const msg = await printChapterPromise(
              pendingHandlers.current,
              pidx,
              pch,
              theme,
              meta,
              1,
            )
            if (cancelled || epoch !== layoutEpochRef.current) return
            maybeApplyPrefetch(msg)
          } finally {
            inflightLocal.delete(pch.id)
            pushInflight()
          }
        }

        let nextStart = 1
        for (let i = 0; i < chapters.length; i++) {
          if (cancelled || epoch !== layoutEpochRef.current) return
          const ch = chapters[i]!
          const start = nextStart
          inflightLocal.add(ch.id)
          pushInflight()
          let msg: PrintChapterResultMsg
          try {
            msg = await printChapterPromise(pendingHandlers.current, i, ch, theme, meta, start)
          } finally {
            inflightLocal.delete(ch.id)
            pushInflight()
          }
          if (cancelled || epoch !== layoutEpochRef.current) return
          sequentialAuthoritativeStart.set(ch.id, start)
          pagesLocal.set(ch.id, msg.pages)
          nextStart = msg.nextPageNumber
          pushPages()
        }
      } catch (e) {
        if (cancelled || epoch !== layoutEpochRef.current) return
        setErr(e instanceof Error ? e.message : 'Print pagination failed')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [layoutDepsKey, chapters, theme, meta])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setViewportBox({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const activePages = activeChapterId != null ? chapterPages.get(activeChapterId) : undefined

  useEffect(() => {
    const len = activePages?.length ?? 0
    if (len === 0) return
    setPageIndexInChapter((i) => Math.min(i, len - 1))
  }, [activeChapterId, activePages?.length])

  const safePageIndex = Math.min(
    pageIndexInChapter,
    Math.max(0, (activePages?.length ?? 1) - 1),
  )
  const currentPage = activePages?.[safePageIndex]

  const sequentialPrefixComplete = useMemo(() => {
    if (chapters.length === 0) return true
    for (let i = 0; i < chapters.length; i++) {
      if (!chapterPages.has(chapters[i]!.id)) return false
    }
    return true
  }, [chapters, chapterPages])

  const totalPagesDisplay = useMemo(() => {
    if (chapters.length === 0) return { exact: 0, partialPlus: null as number | null }
    if (sequentialPrefixComplete) {
      let sum = 0
      for (const ch of chapters) {
        sum += chapterPages.get(ch.id)?.length ?? 0
      }
      return { exact: sum, partialPlus: null }
    }
    let partial = 0
    for (const ch of chapters) {
      const pgs = chapterPages.get(ch.id)
      if (!pgs) break
      partial += pgs.length
    }
    return { exact: 0, partialPlus: partial }
  }, [chapters, chapterPages, sequentialPrefixComplete])

  const bookPageLabel = currentPage?.pageNumber ?? '—'

  const scale = useMemo(() => {
    if (!currentPage) return 1
    const pw = currentPage.widthPt * PX_PER_PT
    const ph = currentPage.heightPt * PX_PER_PT
    const pad = 24
    const sx = (viewportBox.w - pad) / pw
    const sy = (viewportBox.h - pad) / ph
    return Math.max(0.15, Math.min(sx, sy, 1))
  }, [currentPage, viewportBox])

  const goPrevPage = useCallback(() => {
    setPageIndexInChapter((i) => (i > 0 ? i - 1 : i))
  }, [])

  const goNextPage = useCallback(() => {
    setPageIndexInChapter((i) => {
      const len = activePages?.length ?? 0
      if (len === 0) return i
      return i < len - 1 ? i + 1 : i
    })
  }, [activePages?.length])

  const goPrevChapter = useCallback(() => {
    if (activeChapterIndex <= 0) return
    const prev = chapters[activeChapterIndex - 1]!
    const prevLen = chapterPages.get(prev.id)?.length ?? 0
    pendingPageIndexRef.current = Math.max(0, prevLen - 1)
    if (onPrevChapter) onPrevChapter()
    else setLocalChapterId(prev.id)
  }, [activeChapterIndex, chapters, chapterPages, onPrevChapter])

  const goNextChapter = useCallback(() => {
    if (activeChapterIndex < 0 || activeChapterIndex >= chapters.length - 1) return
    const next = chapters[activeChapterIndex + 1]!
    pendingPageIndexRef.current = 0
    if (onNextChapter) onNextChapter()
    else setLocalChapterId(next.id)
  }, [activeChapterIndex, chapters, onNextChapter])

  const applyJump = useCallback(() => {
    const raw = jumpDraft.trim()
    if (!raw) return
    const target = Number.parseInt(raw, 10)
    if (!Number.isFinite(target) || target < 1) return

    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci]!
      const pgs = chapterPages.get(ch.id)
      if (!pgs?.length) continue
      const first = pgs[0]!.pageNumber
      const last = pgs[pgs.length - 1]!.pageNumber
      if (target >= first && target <= last) {
        const idx = pgs.findIndex((p) => p.pageNumber === target)
        pendingPageIndexRef.current = idx >= 0 ? idx : 0
        if (onChapterSelect) onChapterSelect(ch.id)
        else setLocalChapterId(ch.id)
        setJumpDraft('')
        return
      }
    }
  }, [jumpDraft, chapters, chapterPages, onChapterSelect])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goPrevPage()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        goNextPage()
      } else if (e.key === 'Home') {
        e.preventDefault()
        setPageIndexInChapter(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        const len = activePages?.length ?? 0
        if (len > 0) setPageIndexInChapter(len - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrevPage, goNextPage, activePages?.length])

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

  const showSkeleton = !currentPage && inflight.size > 0
  const atChapterStart = safePageIndex <= 0
  const atChapterEnd =
    activePages != null && activePages.length > 0 && safePageIndex >= activePages.length - 1

  return (
    <div className="flex min-h-0 flex-1 flex-col outline-none" tabIndex={0}>
      <div className="shrink-0 border-b border-dust px-4 py-3 dark:border-border-dark">
        <div className="mx-auto flex max-w-[min(64rem,100%)] flex-wrap items-center gap-3">
          <div className="font-serif text-lg font-semibold tracking-tight sm:text-xl">Review: Print</div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="print-review-chapter">
              Chapter
            </label>
            <select
              id="print-review-chapter"
              className="max-w-[12rem] rounded-lg border border-dust bg-white px-2 py-1.5 text-xs font-medium text-ink shadow-sm dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark sm:max-w-xs sm:text-sm"
              value={activeChapterId ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value)
                if (!Number.isFinite(id)) return
                if (onChapterSelect) onChapterSelect(id)
                else {
                  setLocalChapterId(id)
                  setPageIndexInChapter(0)
                }
              }}
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title?.trim() || `Chapter ${c.id}`}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg border border-dust px-2 py-1 text-xs font-medium text-ink hover:bg-dust/30 disabled:opacity-40 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/40"
                disabled={activeChapterIndex <= 0}
                onClick={goPrevChapter}
              >
                Chapter ‹
              </button>
              <button
                type="button"
                className="rounded-lg border border-dust px-2 py-1 text-xs font-medium text-ink hover:bg-dust/30 disabled:opacity-40 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/40"
                disabled={activeChapterIndex < 0 || activeChapterIndex >= chapters.length - 1}
                onClick={goNextChapter}
              >
                Chapter ›
              </button>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink/65 dark:text-ink-dark/65 sm:text-sm">
              Page {bookPageLabel}
              {!sequentialPrefixComplete
                ? ` of ${totalPagesDisplay.partialPlus != null && totalPagesDisplay.partialPlus > 0 ? totalPagesDisplay.partialPlus : '…'}+`
                : totalPagesDisplay.exact > 0
                  ? ` of ${totalPagesDisplay.exact}`
                  : ''}
            </span>
            {inflight.size > 0 ? (
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-dust border-t-ink dark:border-border-dark dark:border-t-ink-dark"
                aria-label="Paginating"
              />
            ) : null}
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Page #"
                value={jumpDraft}
                onChange={(e) => setJumpDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyJump()
                }}
                className="w-20 rounded-lg border border-dust bg-white px-2 py-1 text-xs dark:border-border-dark dark:bg-panel-dark sm:text-sm"
              />
              <button
                type="button"
                onClick={applyJump}
                className="rounded-lg border border-dust px-2 py-1 text-xs font-medium hover:bg-dust/30 dark:border-border-dark dark:hover:bg-border-dark/40"
              >
                Go
              </button>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-1 max-w-[min(64rem,100%)] text-[11px] text-ink/55 dark:text-ink-dark/55">
          Trim {trim.widthIn}" × {trim.heightIn}"
          {sequentialPrefixComplete ? ` · ${totalPagesDisplay.exact.toLocaleString()} pages` : null}
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative flex min-h-0 flex-1 items-center justify-center gap-2 px-2 py-4 sm:gap-4 sm:px-6"
      >
        <button
          type="button"
          aria-label="Previous page"
          className="shrink-0 rounded-full border border-dust bg-white/90 p-3 text-2xl leading-none shadow-sm hover:bg-dust/20 disabled:opacity-35 dark:border-border-dark dark:bg-panel-dark/90 dark:hover:bg-border-dark/30"
          disabled={atChapterStart}
          onClick={goPrevPage}
        >
          ‹
        </button>

        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
          {showSkeleton ? (
            <div className="h-48 w-36 animate-pulse rounded-sm bg-dust/40 dark:bg-border-dark/50 sm:h-64 sm:w-48" />
          ) : currentPage ? (
            <div
              className="relative overflow-hidden rounded-sm bg-white shadow-[0_18px_55px_-28px_rgba(0,0,0,0.55)] ring-1 ring-dust/80 dark:ring-border-dark"
              style={{
                width: `${pageWidthPx * scale}px`,
                height: `${pageHeightPx * scale}px`,
              }}
            >
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{
                  width: `${pageWidthPx}px`,
                  height: `${pageHeightPx}px`,
                  transform: `scale(${scale})`,
                }}
              >
                {currentPage.isBlank ? (
                  <div className="absolute inset-0 flex items-center justify-center px-8">
                    <p className="max-w-[85%] text-center font-sans text-[11px] leading-snug text-ink/45 dark:text-ink-dark/45">
                      Intentional blank — chapter starts on recto (right-hand page).
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0">
                    {currentPage.lines.map((l, i) => {
                      const left = l.xPt * PX_PER_PT
                      const top = (currentPage.heightPt - l.yPt) * PX_PER_PT
                      const fontSizePx = l.fontSizePt * PX_PER_PT
                      return (
                        <div
                          key={`${currentPage.pageNumber}_${i}`}
                          className="absolute whitespace-pre text-ink"
                          style={{
                            left,
                            top,
                            fontFamily: '"InkwellPrintDejaVuSerif", "DejaVu Serif", serif',
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
            </div>
          ) : (
            <div className="text-sm text-ink/60 dark:text-ink-dark/60">No pages yet.</div>
          )}
        </div>

        <button
          type="button"
          aria-label="Next page"
          className="shrink-0 rounded-full border border-dust bg-white/90 p-3 text-2xl leading-none shadow-sm hover:bg-dust/20 disabled:opacity-35 dark:border-border-dark dark:bg-panel-dark/90 dark:hover:bg-border-dark/30"
          disabled={atChapterEnd}
          onClick={goNextPage}
        >
          ›
        </button>
      </div>
    </div>
  )
}
