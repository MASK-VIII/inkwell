import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { InkwellProject, Manuscript, Theme } from '../types'
import { TRIM_PRESETS } from '../types'
import { layoutProfileForManuscript, printSpineBaseForExport } from '../lib/bookAssembly'
import type { PrintLayoutKind, PrintLineTextRun, PrintPage } from '../lib/print/paginate'
import { resolvePrintTitleFontId } from '../lib/print/paginate'
import {
  computePrintContentLayoutKey,
  computePrintLayoutBasisKey,
  computePrintThemeKey,
} from '../lib/print/printLayoutBasis'
import {
  nextWorkerRev,
  onWorkerMessage,
  sendWorker,
  type PrintChapterResultMsg,
  type PrintSpinePagesProgressMsg,
  type PrintSpinePagesResultMsg,
  type PrintSpineResultMsg,
  type WorkerErrorMsg,
  type WorkerResponse,
} from '../lib/workerClient'
import { buildPrintPreviewFontFaceCss, printPreviewFontFamilyStack } from '../lib/fonts/fontCatalog'
import { roughPrintStartPageForSpineIndex } from '../lib/print/estimateRoughPrintPages'

const PX_PER_PT = 96 / 72

type Props = {
  /** Full project — print preview uses the same spine + TOC convergence as KDP PDF export. */
  project: InkwellProject
  theme: Theme
  /** When this changes (e.g. chapter click in sidebar), show this chapter */
  scrollToChapterId?: number | null
  onJumpToChapter?: (chapterId: number) => void
  /** Stay in print review and switch chapter (e.g. header dropdown) */
  onChapterSelect?: (chapterId: number) => void
  /** Ebook / Print toggle, centered between preview chrome and page controls. */
  formatModeBar?: ReactNode
  /** Word-count heuristic interior pages — shown until spine pagination finishes. */
  roughInteriorPageEstimate?: number | null
}

function openerOrdinalForIndex(spine: Manuscript[], index: number): { layout: PrintLayoutKind; ordinal: number } {
  let bodyBefore = 0
  for (let j = 0; j < index; j++) {
    if (layoutProfileForManuscript(spine[j]!) === 'chapter') bodyBefore++
  }
  const layout = layoutProfileForManuscript(spine[index]!)
  const ordinal = layout === 'chapter' ? bodyBefore + 1 : Math.max(1, bodyBefore)
  return { layout, ordinal }
}

/** Book-global start page for `chapterIndex` when prior chapters are already paginated in `pagesByChapter`. */
function bookStartPageForChapterIndex(
  spine: Manuscript[],
  chapterIndex: number,
  pagesByChapter: Map<number, PrintPage[]>,
): number {
  let start = 1
  for (let i = 0; i < chapterIndex; i++) {
    const pages = pagesByChapter.get(spine[i]!.id)
    if (!pages?.length) return 1
    start = pages[pages.length - 1]!.pageNumber + 1
  }
  return start
}

type PrintWorkerCompletionMsg =
  | PrintChapterResultMsg
  | PrintSpineResultMsg
  | PrintSpinePagesProgressMsg
  | PrintSpinePagesResultMsg
  | WorkerErrorMsg

function beginResolvePrintSpine(
  pending: Map<number, (msg: PrintWorkerCompletionMsg) => void>,
  project: InkwellProject,
  meta: { bookTitle: string; authorName: string },
  theme: Theme,
): { rev: number; promise: Promise<PrintSpineResultMsg>; abort: () => void } {
  const rev = nextWorkerRev()
  let rejectOuter: ((reason?: unknown) => void) | undefined
  const promise = new Promise<PrintSpineResultMsg>((resolve, reject) => {
    rejectOuter = reject
    pending.set(rev, (msg) => {
      pending.delete(rev)
      if (msg.kind === 'error') {
        reject(new Error(msg.message))
        return
      }
      if (msg.kind !== 'printSpineResult') {
        reject(new Error('Unexpected worker response'))
        return
      }
      resolve(msg)
    })
    sendWorker({ kind: 'resolvePrintSpine', rev, project, meta, theme })
  })
  const abort = () => {
    pending.delete(rev)
    rejectOuter?.(new DOMException('Print spine resolution aborted', 'AbortError'))
  }
  return { rev, promise, abort }
}

function printChapterPromise(
  pending: Map<number, (msg: PrintWorkerCompletionMsg) => void>,
  chapterIndex: number,
  chapter: Manuscript,
  spine: Manuscript[],
  theme: Theme,
  meta: { bookTitle: string; authorName: string },
  startPageNumber: number,
): Promise<PrintChapterResultMsg> {
  const { layout, ordinal } = openerOrdinalForIndex(spine, chapterIndex)
  const rev = nextWorkerRev()
  return new Promise((resolve, reject) => {
    pending.set(rev, (msg) => {
      if (msg.kind === 'printSpinePagesProgress') return
      if (msg.kind === 'error') {
        reject(new Error(msg.message))
        return
      }
      if (msg.kind !== 'printChapterResult') {
        reject(new Error('Unexpected worker response'))
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

function beginPaginatePrintSpine(
  pending: Map<number, (msg: PrintWorkerCompletionMsg) => void>,
  spine: Manuscript[],
  theme: Theme,
  meta: { bookTitle: string; authorName: string },
  layoutFingerprint: string,
  onProgress?: (msg: PrintSpinePagesProgressMsg) => void,
): { rev: number; promise: Promise<Map<number, PrintPage[]>>; abort: () => void } {
  const rev = nextWorkerRev()
  let rejectOuter: ((reason?: unknown) => void) | undefined
  const promise = new Promise<Map<number, PrintPage[]>>((resolve, reject) => {
    rejectOuter = reject
    pending.set(rev, (msg) => {
      if (msg.kind === 'printSpinePagesProgress') {
        onProgress?.(msg)
        return
      }
      pending.delete(rev)
      if (msg.kind === 'error') {
        reject(new Error(msg.message))
        return
      }
      if (msg.kind !== 'printSpinePagesResult') {
        reject(new Error('Unexpected worker response'))
        return
      }
      const m = new Map<number, PrintPage[]>()
      for (const row of msg.chapters) m.set(row.chapterId, row.pages)
      resolve(m)
    })
    sendWorker({ kind: 'paginatePrintSpine', rev, spine, theme, meta, layoutFingerprint })
  })
  const abort = () => {
    pending.delete(rev)
    rejectOuter?.(new DOMException('Print spine pagination aborted', 'AbortError'))
  }
  return { rev, promise, abort }
}

export function PrintReview({
  project,
  theme,
  scrollToChapterId,
  onJumpToChapter,
  onChapterSelect,
  formatModeBar,
  roughInteriorPageEstimate,
}: Props) {
  const book = project.book
  const [layoutSpine, setLayoutSpine] = useState<Manuscript[]>([])
  const [spineReady, setSpineReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [chapterPages, setChapterPages] = useState<Map<number, PrintPage[]>>(() => new Map())
  const [inflight, setInflight] = useState<Set<number>>(() => new Set())
  const [pageIndexInChapter, setPageIndexInChapter] = useState(0)
  const [jumpDraft, setJumpDraft] = useState('')
  const [viewportBox, setViewportBox] = useState({ w: 400, h: 560 })

  const viewportRef = useRef<HTMLDivElement>(null)
  const pendingHandlers = useRef(new Map<number, (msg: PrintWorkerCompletionMsg) => void>())
  /** When TOC resolve already produced full pagination, skip duplicate `paginatePrintSpine` if basis key matches. */
  const resolveLayoutSeedRef = useRef<{ basisKey: string; chapters: Map<number, PrintPage[]> } | null>(null)
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

  const activeChapterId = useMemo(() => {
    const preferred = localChapterId ?? scrollToChapterId ?? layoutSpine[0]?.id ?? null
    if (preferred == null) return null
    if (layoutSpine.some((m) => m.id === preferred)) return preferred
    return layoutSpine[0]?.id ?? null
  }, [localChapterId, scrollToChapterId, layoutSpine])
  useEffect(() => {
    activeChapterIdRef.current = activeChapterId
  }, [activeChapterId])

  const meta = useMemo(
    () => ({ bookTitle: book.title, authorName: book.authorName }),
    [book.title, book.authorName],
  )

  const contentLayoutKey = useMemo(() => computePrintContentLayoutKey(project), [
    project.chapters,
    project.assembly.includePrintToc,
    project.assembly.printTocTitle,
    meta.bookTitle,
    meta.authorName,
  ])

  const printThemeKey = useMemo(() => computePrintThemeKey(theme), [theme.print])

  const [debouncedPrintThemeKey, setDebouncedPrintThemeKey] = useState(printThemeKey)
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedPrintThemeKey(printThemeKey), 280)
    return () => window.clearTimeout(id)
  }, [printThemeKey])

  const layoutBasisKey = useMemo(() => computePrintLayoutBasisKey(project, theme), [project, theme])

  const layoutBasisKeyRef = useRef(layoutBasisKey)
  useEffect(() => {
    layoutBasisKeyRef.current = layoutBasisKey
  }, [layoutBasisKey])

  /** Printable TOC off: spine order is fixed from assembly — no worker TOC convergence. */
  useEffect(() => {
    if (project.assembly.includePrintToc) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setErr(null)
    })
    void (async () => {
      try {
        if (project.chapters.length === 0) {
          if (!cancelled) {
            setLayoutSpine([])
            setSpineReady(true)
          }
          return
        }
        const spine = printSpineBaseForExport(project)
        if (!cancelled) {
          setLayoutSpine(spine)
          setSpineReady(true)
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Print layout spine failed')
          setLayoutSpine([])
          setSpineReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contentLayoutKey fingerprints manuscript content + assembly
  }, [contentLayoutKey, project.assembly.includePrintToc])

  useEffect(() => {
    if (!project.assembly.includePrintToc) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setSpineReady(false)
      setErr(null)
    })
    let abortSpine: (() => void) | null = null
    void (async () => {
      try {
        if (project.chapters.length === 0) {
          if (!cancelled) {
            setLayoutSpine([])
            setSpineReady(true)
          }
          return
        }
        const begun = beginResolvePrintSpine(pendingHandlers.current, project, meta, theme)
        abortSpine = begun.abort
        const result = await begun.promise
        if (!cancelled) {
          if (result.layoutSeed) {
            const m = new Map<number, PrintPage[]>()
            for (const row of result.layoutSeed.chapters) m.set(row.chapterId, row.pages)
            resolveLayoutSeedRef.current = {
              basisKey: result.layoutSeed.layoutBasisKey,
              chapters: m,
            }
          } else {
            resolveLayoutSeedRef.current = null
          }
          setLayoutSpine(result.spine)
          setSpineReady(true)
        }
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Print layout spine failed')
          setLayoutSpine([])
          setSpineReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
      resolveLayoutSeedRef.current = null
      abortSpine?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced theme limits worker churn while TOC converges
  }, [contentLayoutKey, debouncedPrintThemeKey, project.assembly.includePrintToc])

  const [appliedFullLayoutBasisKey, setAppliedFullLayoutBasisKey] = useState<string | null>(null)
  const [applyingFullLayout, setApplyingFullLayout] = useState(false)

  useEffect(() => {
    const unsub = onWorkerMessage((msg: WorkerResponse) => {
      const okPrintChapter = msg.kind === 'printChapterResult'
      const okSpine = msg.kind === 'printSpineResult'
      const okSpinePages = msg.kind === 'printSpinePagesResult'
      const okSpinePagesProgress = msg.kind === 'printSpinePagesProgress'
      const okErr =
        msg.kind === 'error' &&
        (msg.job === 'paginatePrintChapter' ||
          msg.job === 'resolvePrintSpine' ||
          msg.job === 'paginatePrintSpine')
      if (!okPrintChapter && !okSpine && !okSpinePages && !okSpinePagesProgress && !okErr) return
      const cb = pendingHandlers.current.get(msg.rev)
      if (cb) {
        if (okSpinePagesProgress) {
          cb(msg)
          return
        }
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
    if (!spineReady || layoutSpine.length === 0) return
    layoutEpochRef.current += 1
    const epoch = layoutEpochRef.current
    setApplyingFullLayout(true)
    setErr(null)

    setChapterPages(new Map())
    const inflightLocal = new Set(layoutSpine.map((c) => c.id))
    setInflight(inflightLocal)
    setPageIndexInChapter(0)

    try {
      const pagesLocal = new Map<number, PrintPage[]>()
      const begun = beginPaginatePrintSpine(
        pendingHandlers.current,
        layoutSpine,
        theme,
        meta,
        layoutBasisKeyRef.current,
        (msg) => {
          if (epoch !== layoutEpochRef.current) return
          pagesLocal.clear()
          for (const row of msg.chapters) pagesLocal.set(row.chapterId, row.pages)
          setChapterPages(new Map(pagesLocal))
        },
      )
      const map = await begun.promise
      if (epoch !== layoutEpochRef.current) return
      setChapterPages(new Map(map))
      setAppliedFullLayoutBasisKey(layoutBasisKeyRef.current)
    } catch (e) {
      if (epoch === layoutEpochRef.current) {
        setErr(e instanceof Error ? e.message : 'Print pagination failed')
      }
    } finally {
      if (epoch === layoutEpochRef.current) {
        setInflight(new Set())
        setApplyingFullLayout(false)
      }
    }
  }, [layoutSpine, spineReady, theme, meta])

  useEffect(() => {
    layoutEpochRef.current += 1
    const epoch = layoutEpochRef.current

    setChapterPages(new Map())
    setInflight(new Set())
    setErr(null)
    setPageIndexInChapter(0)

    if (!spineReady) return
    if (layoutSpine.length === 0) return

    let cancelled = false

    const seed = resolveLayoutSeedRef.current
    if (seed) {
      if (seed.basisKey === layoutBasisKey) {
        resolveLayoutSeedRef.current = null
        setChapterPages(new Map(seed.chapters))
        setAppliedFullLayoutBasisKey(layoutBasisKey)
        return () => {
          cancelled = true
        }
      }
      resolveLayoutSeedRef.current = null
    }

    const inflightLocal = new Set<number>()
    const pagesLocal = new Map<number, PrintPage[]>()

    const pushInflight = () => {
      if (cancelled || epoch !== layoutEpochRef.current) return
      setInflight(new Set(inflightLocal))
    }

    const pushPages = () => {
      if (cancelled || epoch !== layoutEpochRef.current) return
      setChapterPages(new Map(pagesLocal))
    }

    const runFullSpinePagination = async () => {
      for (const ch of layoutSpine) inflightLocal.add(ch.id)
      pushInflight()
      try {
        const begun = beginPaginatePrintSpine(
          pendingHandlers.current,
          layoutSpine,
          theme,
          meta,
          layoutBasisKeyRef.current,
          (msg) => {
            if (cancelled || epoch !== layoutEpochRef.current) return
            pagesLocal.clear()
            for (const row of msg.chapters) pagesLocal.set(row.chapterId, row.pages)
            pushPages()
          },
        )
        const map = await begun.promise
        if (cancelled || epoch !== layoutEpochRef.current) return
        pagesLocal.clear()
        for (const ch of layoutSpine) {
          pagesLocal.set(ch.id, map.get(ch.id) ?? [])
        }
        pushPages()
      } finally {
        inflightLocal.clear()
        pushInflight()
      }
    }

    const runFastActiveChapterOnly = async () => {
      const aid = activeChapterIdRef.current ?? layoutSpine[0]!.id
      const pidx = layoutSpine.findIndex((c) => c.id === aid)
      if (pidx < 0) return
      const pch = layoutSpine[pidx]!
      inflightLocal.add(pch.id)
      pushInflight()
      try {
        const startPn = roughPrintStartPageForSpineIndex(layoutSpine, pidx, theme.print)
        const msg = await printChapterPromise(
          pendingHandlers.current,
          pidx,
          pch,
          layoutSpine,
          theme,
          meta,
          startPn,
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
        if (layoutSpine.length > 1) {
          try {
            await runFastActiveChapterOnly()
          } catch {
            /* fast preview is optional; full spine below is authoritative */
          }
          if (cancelled || epoch !== layoutEpochRef.current) return
          await runFullSpinePagination()
        } else {
          await runFastActiveChapterOnly()
        }
        if (!cancelled && epoch === layoutEpochRef.current) {
          setAppliedFullLayoutBasisKey(layoutBasisKey)
        }
      } catch (e) {
        if (cancelled || epoch !== layoutEpochRef.current) return
        setErr(e instanceof Error ? e.message : 'Print pagination failed')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [contentLayoutKey, debouncedPrintThemeKey, layoutSpine, spineReady, theme, meta, layoutBasisKey])

  const activeChapterPagesMissing = useMemo(
    () =>
      spineReady &&
      activeChapterId != null &&
      layoutSpine.length > 0 &&
      !chapterPages.has(activeChapterId),
    [spineReady, activeChapterId, layoutSpine.length, chapterPages],
  )

  useEffect(() => {
    if (!activeChapterPagesMissing || activeChapterId == null) return
    const aid = activeChapterId

    gapFillEpochRef.current += 1
    const gapEpoch = gapFillEpochRef.current
    let cancelled = false

    void (async () => {
      try {
        const pidx = layoutSpine.findIndex((c) => c.id === aid)
        if (pidx < 0) return
        const pch = layoutSpine[pidx]!
        const startPn = bookStartPageForChapterIndex(layoutSpine, pidx, chapterPages)
        const msg = await printChapterPromise(
          pendingHandlers.current,
          pidx,
          pch,
          layoutSpine,
          theme,
          meta,
          startPn,
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
  }, [activeChapterPagesMissing, activeChapterId, layoutSpine, theme, meta, chapterPages])

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
    if (!spineReady || layoutSpine.length === 0) return true
    for (let i = 0; i < layoutSpine.length; i++) {
      if (!chapterPages.has(layoutSpine[i]!.id)) return false
    }
    return true
  }, [spineReady, layoutSpine, chapterPages])

  const needsApplyFullBookLayout = useMemo(
    () =>
      spineReady &&
      layoutSpine.length > 1 &&
      appliedFullLayoutBasisKey !== null &&
      appliedFullLayoutBasisKey !== layoutBasisKey,
    [spineReady, layoutSpine.length, appliedFullLayoutBasisKey, layoutBasisKey],
  )

  const totalPagesDisplay = useMemo(() => {
    if (!spineReady || layoutSpine.length === 0) return { exact: 0, partialPlus: null as number | null }
    if (sequentialPrefixComplete) {
      let sum = 0
      for (const ch of layoutSpine) {
        sum += chapterPages.get(ch.id)?.length ?? 0
      }
      return { exact: sum, partialPlus: null }
    }
    let partial = 0
    for (const ch of layoutSpine) {
      const pgs = chapterPages.get(ch.id)
      if (!pgs) break
      partial += pgs.length
    }
    return { exact: 0, partialPlus: partial }
  }, [spineReady, layoutSpine, chapterPages, sequentialPrefixComplete])

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

    for (let ci = 0; ci < layoutSpine.length; ci++) {
      const ch = layoutSpine[ci]!
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
  }, [jumpDraft, layoutSpine, chapterPages, onChapterSelect])

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

  /** Keep showing preview once the active chapter has pages; full-spine refinement still spins in chrome. */
  const showSkeleton = !spineReady || !currentPage
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
              {!spineReady ?
                'Resolving print layout…'
              : <>
                  Page {bookPageLabel}
                  {!sequentialPrefixComplete
                    ? ` of ${totalPagesDisplay.partialPlus != null && totalPagesDisplay.partialPlus > 0 ? totalPagesDisplay.partialPlus : '…'}+`
                    : totalPagesDisplay.exact > 0
                      ? ` of ${totalPagesDisplay.exact}`
                      : ''}
                  {roughInteriorPageEstimate != null &&
                  roughInteriorPageEstimate > 0 &&
                  !sequentialPrefixComplete ?
                    <span className="ml-1.5 whitespace-nowrap text-ink/50 dark:text-ink-dark/50">
                      (~{roughInteriorPageEstimate.toLocaleString()} est.)
                    </span>
                  : null}
                </>
              }
            </span>
            {!spineReady || inflight.size > 0 ? (
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-dust border-t-ink dark:border-border-dark dark:border-t-ink-dark"
                aria-label={!spineReady ? 'Resolving print spine' : 'Paginating'}
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
            {!spineReady ?
              ' · …'
            : sequentialPrefixComplete && totalPagesDisplay.exact > 0 ?
              ` · ${totalPagesDisplay.exact.toLocaleString()} pages`
            : roughInteriorPageEstimate != null && roughInteriorPageEstimate > 0 ?
              ` · ~${roughInteriorPageEstimate.toLocaleString()} pages (est.)`
            : null}
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
                      const fontSizePx = l.fontSizePt * PX_PER_PT
                      const runStyle = (tr: PrintLineTextRun): CSSProperties => ({
                        fontFamily: usingTitleFont ? titleFontStack : printFontStack,
                        fontSize: `${fontSizePx}px`,
                        lineHeight: `${theme.print.lineHeight}`,
                        fontWeight: tr.bold ? 700 : 400,
                        fontStyle: tr.italic ? 'italic' : 'normal',
                        fontVariantLigatures: 'none',
                        fontFeatureSettings: '"liga" 0, "clig" 0',
                        ...(l.trackingEm ? { letterSpacing: `${l.trackingEm}em` } : null),
                        ...(tr.underline && tr.strike ?
                          {
                            textDecoration: 'underline line-through',
                            textUnderlineOffset: `${Math.max(1, fontSizePx * 0.08)}px`,
                          }
                        : tr.underline ?
                          { textDecoration: 'underline', textUnderlineOffset: `${Math.max(1, fontSizePx * 0.08)}px` }
                        : tr.strike ?
                          { textDecoration: 'line-through' }
                        : null),
                      })
                      if (l.textRuns?.length) {
                        return (
                          <Fragment key={`${currentPage.pageNumber}_${i}`}>
                            {l.textRuns.map((tr, ti) => (
                              <span
                                key={`${currentPage.pageNumber}_${i}_${ti}`}
                                className="absolute whitespace-pre text-ink"
                                style={{
                                  left: (l.xPt + tr.xOffsetPt) * PX_PER_PT,
                                  top: (currentPage.heightPt - l.yPt) * PX_PER_PT,
                                  ...runStyle(tr),
                                }}
                                onClick={() => onJumpToChapter?.(l.chapterId)}
                                role={onJumpToChapter ? 'button' : undefined}
                                tabIndex={onJumpToChapter ? 0 : undefined}
                              >
                                {tr.text}
                              </span>
                            ))}
                          </Fragment>
                        )
                      }
                      const left = l.xPt * PX_PER_PT
                      const top = (currentPage.heightPt - l.yPt) * PX_PER_PT
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
                            fontVariantLigatures: 'none',
                            fontFeatureSettings: '"liga" 0, "clig" 0',
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
