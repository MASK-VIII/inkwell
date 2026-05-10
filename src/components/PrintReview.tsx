import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BookMeta, Manuscript, Theme } from '../types'
import { TRIM_PRESETS } from '../types'
import { layoutProfileForManuscript } from '../lib/bookAssembly'
import type { PrintLayoutKind, PrintPage } from '../lib/print/paginate'
import { resolvePrintTitleFontId } from '../lib/print/paginate'
import { hashStringDjb2 } from '../lib/hash'
import {
  nextWorkerRev,
  onWorkerMessage,
  sendWorker,
  type PrintChapterResultMsg,
  type WorkerErrorMsg,
  type WorkerResponse,
} from '../lib/workerClient'
import { buildPrintPreviewFontFaceCss, printPreviewFontFamilyStack } from '../lib/fonts/fontCatalog'

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
  /** Ebook / Print toggle, centered between preview chrome and page controls. */
  formatModeBar?: ReactNode
}

function openerOrdinalForIndex(chapters: Manuscript[], index: number): { layout: PrintLayoutKind; ordinal: number } {
  let bodyBefore = 0
  for (let j = 0; j < index; j++) {
    if (layoutProfileForManuscript(chapters[j]!) === 'chapter') bodyBefore++
  }
  const layout = layoutProfileForManuscript(chapters[index]!)
  const ordinal = layout === 'chapter' ? bodyBefore + 1 : Math.max(1, bodyBefore)
  return { layout, ordinal }
}

function printChapterPromise(
  pending: Map<number, (msg: PrintChapterResultMsg | WorkerErrorMsg) => void>,
  chapterIndex: number,
  chapter: Manuscript,
  chapters: Manuscript[],
  theme: Theme,
  meta: { bookTitle: string; authorName: string },
  startPageNumber: number,
): Promise<PrintChapterResultMsg> {
  const { layout, ordinal } = openerOrdinalForIndex(chapters, chapterIndex)
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
      layoutKind: layout,
      chapterOrdinalForOpener: ordinal,
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
  formatModeBar,
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
  const activeChapterIdRef = useRef<number | null>(null)
  const gapFillEpochRef = useRef(0)

  const trim = TRIM_PRESETS[theme.print.trimPreset]
  const pageWidthPx = trim.widthIn * 96
  const pageHeightPx = trim.heightIn * 96

  const titleFontId = useMemo(() => resolvePrintTitleFontId(theme.print), [theme.print])
  const printFontFaceCss = useMemo(() => {
    const bodyFace = buildPrintPreviewFontFaceCss(theme.print.bodyFontId)
    if (titleFontId === theme.print.bodyFontId) return bodyFace
    return `${bodyFace}\n${buildPrintPreviewFontFaceCss(titleFontId)}`
  }, [theme.print.bodyFontId, titleFontId])
  const printFontStack = useMemo(
    () => printPreviewFontFamilyStack(theme.print.bodyFontId),
    [theme.print.bodyFontId],
  )
  const titleFontStack = useMemo(
    () => printPreviewFontFamilyStack(titleFontId),
    [titleFontId],
  )

  useEffect(() => {
    queueMicrotask(() => setLocalChapterId(null))
  }, [scrollToChapterId])

  const activeChapterId = localChapterId ?? scrollToChapterId ?? chapters[0]?.id ?? null
  useEffect(() => {
    activeChapterIdRef.current = activeChapterId
  }, [activeChapterId])

  const meta = useMemo(
    () => ({ bookTitle: book.title, authorName: book.authorName }),
    [book.title, book.authorName],
  )

  const contentLayoutKey = useMemo(() => {
    const chapterSig = chapters
      .map((c) => `${c.id}:${hashStringDjb2(JSON.stringify(c.content))}:${hashStringDjb2(c.title)}`)
      .join('|')
    return `${chapterSig}|${meta.bookTitle}|${meta.authorName}`
  }, [chapters, meta.bookTitle, meta.authorName])

  const printThemeKey = useMemo(
    () => hashStringDjb2(JSON.stringify(theme.print)),
    [theme.print],
  )

  const layoutBasisKey = useMemo(
    () => `${contentLayoutKey}|${printThemeKey}`,
    [contentLayoutKey, printThemeKey],
  )

  const layoutBasisKeyRef = useRef(layoutBasisKey)
  useEffect(() => {
    layoutBasisKeyRef.current = layoutBasisKey
  }, [layoutBasisKey])

  const [appliedFullLayoutBasisKey, setAppliedFullLayoutBasisKey] = useState<string | null>(null)
  const [applyingFullLayout, setApplyingFullLayout] = useState(false)

  const prevContentLayoutKeyRef = useRef<string | null>(null)

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

  const applyFullBookLayout = useCallback(async () => {
    if (chapters.length === 0) return
    layoutEpochRef.current += 1
    const epoch = layoutEpochRef.current
    setApplyingFullLayout(true)
    setErr(null)

    setChapterPages(new Map())
    setInflight(new Set())
    setPageIndexInChapter(0)

    const inflightLocal = new Set<number>()
    const pagesLocal = new Map<number, PrintPage[]>()
    const sequentialAuthoritativeStart = new Map<number, number>()

    const pushInflight = () => {
      if (epoch !== layoutEpochRef.current) return
      setInflight(new Set(inflightLocal))
    }

    const pushPages = () => {
      if (epoch !== layoutEpochRef.current) return
      setChapterPages(new Map(pagesLocal))
    }

    const maybeApplyPrefetch = (msg: PrintChapterResultMsg) => {
      const auth = sequentialAuthoritativeStart.get(msg.chapterId)
      if (auth != null && auth !== msg.startPageNumber) return
      pagesLocal.set(msg.chapterId, msg.pages)
      pushPages()
    }

    try {
      const priorityId = activeChapterIdRef.current ?? chapters[0]!.id
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
            chapters,
            theme,
            meta,
            1,
          )
          if (epoch !== layoutEpochRef.current) return
          maybeApplyPrefetch(msg)
        } finally {
          inflightLocal.delete(pch.id)
          pushInflight()
        }
      }

      let nextStart = 1
      for (let i = 0; i < chapters.length; i++) {
        if (epoch !== layoutEpochRef.current) return
        const ch = chapters[i]!
        const start = nextStart
        inflightLocal.add(ch.id)
        pushInflight()
        let msg: PrintChapterResultMsg
        try {
          msg = await printChapterPromise(pendingHandlers.current, i, ch, chapters, theme, meta, start)
        } finally {
          inflightLocal.delete(ch.id)
          pushInflight()
        }
        if (epoch !== layoutEpochRef.current) return
        sequentialAuthoritativeStart.set(ch.id, start)
        pagesLocal.set(ch.id, msg.pages)
        nextStart = msg.nextPageNumber
        pushPages()
      }

      if (epoch === layoutEpochRef.current) {
        setAppliedFullLayoutBasisKey(layoutBasisKeyRef.current)
      }
    } catch (e) {
      if (epoch === layoutEpochRef.current) {
        setErr(e instanceof Error ? e.message : 'Print pagination failed')
      }
    } finally {
      if (epoch === layoutEpochRef.current) setApplyingFullLayout(false)
    }
  }, [chapters, theme, meta])

  useEffect(() => {
    layoutEpochRef.current += 1
    const epoch = layoutEpochRef.current

    const contentChanged =
      prevContentLayoutKeyRef.current === null || prevContentLayoutKeyRef.current !== contentLayoutKey
    prevContentLayoutKeyRef.current = contentLayoutKey

    const themeOnlyMultiChapter = !contentChanged && chapters.length > 1

    if (themeOnlyMultiChapter) {
      setErr(null)
      setInflight(new Set())
      const keepId = activeChapterIdRef.current ?? chapters[0]!.id
      setChapterPages((prev) => {
        const cur = prev.get(keepId)
        const next = new Map<number, PrintPage[]>()
        if (cur) next.set(keepId, cur)
        return next
      })
    } else {
      setChapterPages(new Map())
      setInflight(new Set())
      setErr(null)
      setPageIndexInChapter(0)
    }

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

    const runFullSequential = async () => {
      const priorityId = activeChapterIdRef.current ?? chapters[0]!.id
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
            chapters,
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
          msg = await printChapterPromise(pendingHandlers.current, i, ch, chapters, theme, meta, start)
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
    }

    const runFastActiveChapterOnly = async () => {
      const aid = activeChapterIdRef.current ?? chapters[0]!.id
      const pidx = chapters.findIndex((c) => c.id === aid)
      if (pidx < 0) return
      const pch = chapters[pidx]!
      inflightLocal.add(pch.id)
      pushInflight()
      try {
        const msg = await printChapterPromise(
          pendingHandlers.current,
          pidx,
          pch,
          chapters,
          theme,
          meta,
          1,
        )
        if (cancelled || epoch !== layoutEpochRef.current) return
        pagesLocal.clear()
        pagesLocal.set(msg.chapterId, msg.pages)
        pushPages()
      } finally {
        inflightLocal.delete(pch.id)
        pushInflight()
      }
    }

    void (async () => {
      try {
        if (contentChanged) {
          await runFullSequential()
          if (!cancelled && epoch === layoutEpochRef.current) {
            setAppliedFullLayoutBasisKey(layoutBasisKey)
          }
        } else {
          await runFastActiveChapterOnly()
          if (!cancelled && epoch === layoutEpochRef.current && chapters.length <= 1) {
            setAppliedFullLayoutBasisKey(layoutBasisKey)
          }
        }
      } catch (e) {
        if (cancelled || epoch !== layoutEpochRef.current) return
        setErr(e instanceof Error ? e.message : 'Print pagination failed')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [contentLayoutKey, printThemeKey, chapters, theme, meta, layoutBasisKey])

  const activeChapterPagesMissing = useMemo(
    () =>
      activeChapterId != null && chapters.length > 0 && !chapterPages.has(activeChapterId),
    [activeChapterId, chapters.length, chapterPages],
  )

  useEffect(() => {
    if (!activeChapterPagesMissing || activeChapterId == null) return
    const aid = activeChapterId

    gapFillEpochRef.current += 1
    const gapEpoch = gapFillEpochRef.current
    let cancelled = false

    void (async () => {
      try {
        const pidx = chapters.findIndex((c) => c.id === aid)
        if (pidx < 0) return
        const pch = chapters[pidx]!
        const msg = await printChapterPromise(
          pendingHandlers.current,
          pidx,
          pch,
          chapters,
          theme,
          meta,
          1,
        )
        if (cancelled || gapEpoch !== gapFillEpochRef.current) return
        setChapterPages((prev) => {
          if (prev.has(aid)) return prev
          const next = new Map(prev)
          next.set(msg.chapterId, msg.pages)
          return next
        })
      } catch {
        /* full-book pass will recover */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeChapterPagesMissing, activeChapterId, chapters, theme, meta])

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
    queueMicrotask(() => setPageIndexInChapter((i) => Math.min(i, len - 1)))
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

  const needsApplyFullBookLayout = useMemo(
    () =>
      chapters.length > 1 &&
      appliedFullLayoutBasisKey !== null &&
      appliedFullLayoutBasisKey !== layoutBasisKey,
    [chapters.length, appliedFullLayoutBasisKey, layoutBasisKey],
  )

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
        <div className="max-w-xl rounded-3xl border border-dust bg-panel-light/88 p-6 text-sm text-ink shadow-sm dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark">
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
      <style dangerouslySetInnerHTML={{ __html: printFontFaceCss }} />
      <div className="inkwell-theme-bridge shrink-0 border-b border-dust bg-panel-light-strong/92 px-4 py-3 backdrop-blur-sm dark:border-border-dark dark:bg-panel-dark/90 sm:px-5">
        <div className="mx-auto grid w-full max-w-[min(64rem,100%)] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <div className="min-w-0" aria-hidden />
          <div className="flex justify-center">{formatModeBar}</div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
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
                className="w-20 rounded-lg border border-dust bg-panel-light-strong px-2 py-1 text-xs dark:border-border-dark dark:bg-panel-dark sm:text-sm"
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
        <div className="mx-auto mt-1 flex max-w-[min(64rem,100%)] flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-ink/55 dark:text-ink-dark/55">
          <span>
            Trim {trim.widthIn}" × {trim.heightIn}"
            {sequentialPrefixComplete ? ` · ${totalPagesDisplay.exact.toLocaleString()} pages` : null}
          </span>
          {needsApplyFullBookLayout ? (
            <>
              <span className="text-ink/45 dark:text-ink-dark/45">
                Preview is the open chapter only. Apply when you want page counts and other chapters to match.
              </span>
              <button
                type="button"
                disabled={applyingFullLayout}
                onClick={() => void applyFullBookLayout()}
                className="rounded-xl border border-walnut/40 bg-walnut/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-walnut transition-colors hover:bg-walnut/18 disabled:opacity-45 dark:border-accent-warm/50 dark:bg-accent-warm/15 dark:text-accent-warm dark:hover:bg-accent-warm/25"
              >
                {applyingFullLayout ? 'Applying…' : 'Apply layout to whole book'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative flex min-h-0 flex-1 items-center justify-center gap-2 px-2 py-4 sm:gap-4 sm:px-6"
      >
        <button
          type="button"
          aria-label="Previous page"
          className="shrink-0 rounded-full border border-dust bg-panel-light-strong/92 p-3 text-2xl leading-none shadow-sm hover:bg-dust/20 disabled:opacity-35 dark:border-border-dark dark:bg-panel-dark/90 dark:hover:bg-border-dark/30"
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
              className="relative overflow-hidden rounded-sm bg-panel-light-strong shadow-[0_18px_55px_-28px_rgba(0,0,0,0.55)] ring-1 ring-dust/80 dark:ring-border-dark"
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
                      const usingTitleFont = l.fontId != null && l.fontId === titleFontId
                      if (
                        l.kind === 'figure' &&
                        l.figureSrc &&
                        l.figureWidthPt != null &&
                        l.figureHeightPt != null
                      ) {
                        const wPx = l.figureWidthPt * PX_PER_PT
                        const hPx = l.figureHeightPt * PX_PER_PT
                        const left = l.xPt * PX_PER_PT
                        const top =
                          (currentPage.heightPt - l.yPt - l.figureHeightPt) * PX_PER_PT
                        return (
                          <img
                            key={`${currentPage.pageNumber}_${i}`}
                            src={l.figureSrc}
                            alt={l.text}
                            className="absolute object-contain text-ink"
                            style={{ left, top, width: `${wPx}px`, height: `${hPx}px` }}
                          />
                        )
                      }
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
                            fontFamily: usingTitleFont ? titleFontStack : printFontStack,
                            fontSize: `${fontSizePx}px`,
                            lineHeight: `${theme.print.lineHeight}`,
                            ...(l.trackingEm
                              ? { letterSpacing: `${l.trackingEm}em` }
                              : null),
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
          className="shrink-0 rounded-full border border-dust bg-panel-light-strong/92 p-3 text-2xl leading-none shadow-sm hover:bg-dust/20 disabled:opacity-35 dark:border-border-dark dark:bg-panel-dark/90 dark:hover:bg-border-dark/30"
          disabled={atChapterEnd}
          onClick={goNextPage}
        >
          ›
        </button>
      </div>
    </div>
  )
}
