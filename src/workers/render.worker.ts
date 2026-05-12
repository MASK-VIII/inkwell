import type { JSONContent } from '@tiptap/core'
import type { EbookTheme, InkwellProject, Manuscript, Theme } from '../types'
import { CHAPTER_TITLE_STYLES } from '../types'
import { ebookCss } from '../lib/ebook/ebookCss'
import { tiptapDocToXhtmlBody } from '../lib/ebook/tiptapRender'
import { escapeHtml } from '../lib/escapeHtml'
import { hashStringDjb2 } from '../lib/hash'
import { layoutProfileForManuscript } from '../lib/bookAssembly'
import { getPrintFontPairForMeasurement } from '../lib/print/fonts'
import { buildKdpPdf } from '../lib/export/pdfKdp'
import {
  groupPrintPreviewPagesByChapter,
  paginateChapterWithFont,
  paginateSpineWithFont,
  resolvePrintSpineLayoutForExport,
  resolvePrintTitleFontId,
  trimTrailingBlankPrintPage,
  type PrintLayoutKind,
  type PrintPage,
} from '../lib/print/paginate'
import { computePrintLayoutBasisKey } from '../lib/print/printLayoutBasis'

type RenderEbookJob = {
  kind: 'renderEbook'
  rev: number
  chapter: { id: number; title: string; content: JSONContent }
  ebookTheme: EbookTheme
}

type PaginatePrintChapterJob = {
  kind: 'paginatePrintChapter'
  rev: number
  chapterIndex: number
  chapter: Manuscript
  theme: Theme
  meta: { bookTitle: string; authorName: string }
  startPageNumber: number
  layoutKind?: PrintLayoutKind
  chapterOrdinalForOpener?: number
}

type BuildPdfJob = {
  kind: 'buildPdf'
  rev: number
  project: InkwellProject
  layoutFingerprint?: string
}

type ResolvePrintSpineJob = {
  kind: 'resolvePrintSpine'
  rev: number
  project: InkwellProject
  meta: { bookTitle: string; authorName: string }
  /** Live print theme (format workspace); must match `computePrintLayoutBasisKey(project, theme)` on the main thread. */
  theme: Theme
}

type PaginatePrintSpineJob = {
  kind: 'paginatePrintSpine'
  rev: number
  spine: Manuscript[]
  theme: Theme
  meta: { bookTitle: string; authorName: string }
  layoutFingerprint: string
}

type WorkerRequest =
  | RenderEbookJob
  | PaginatePrintChapterJob
  | BuildPdfJob
  | ResolvePrintSpineJob
  | PaginatePrintSpineJob

type EbookResult = {
  kind: 'ebookResult'
  rev: number
  css: string
  chapterId: number
  html: string
}

type PrintChapterResult = {
  kind: 'printChapterResult'
  rev: number
  chapterId: number
  chapterIndex: number
  pages: PrintPage[]
  nextPageNumber: number
  startPageNumber: number
}

type PdfResult = {
  kind: 'pdfResult'
  rev: number
  bytes: Uint8Array
}

type PdfProgress = {
  kind: 'pdfProgress'
  rev: number
  phase: 'paginate' | 'render'
  done: number
  total: number
}

type PrintSpineResult = {
  kind: 'printSpineResult'
  rev: number
  spine: Manuscript[]
  layoutSeed?: {
    layoutBasisKey: string
    chapters: Array<{ chapterId: number; pages: PrintPage[] }>
  }
}

type PrintSpinePagesResult = {
  kind: 'printSpinePagesResult'
  rev: number
  chapters: Array<{ chapterId: number; pages: PrintPage[] }>
}

/** Partial grouped pages while `paginatePrintSpine` advances through the spine (Atticus-class live updates). */
type PrintSpinePagesProgress = {
  kind: 'printSpinePagesProgress'
  rev: number
  chapters: Array<{ chapterId: number; pages: PrintPage[] }>
  completedChapterIndex: number
}

type WorkerError = {
  kind: 'error'
  rev: number
  job: WorkerRequest['kind']
  message: string
}

type WorkerResponse =
  | EbookResult
  | PrintChapterResult
  | PdfResult
  | PdfProgress
  | PrintSpineResult
  | PrintSpinePagesProgress
  | PrintSpinePagesResult
  | WorkerError

const MAX_PRINT_CHAPTER_CACHE = 96
const MAX_PRINT_SPINE_CACHE = 48
const MAX_PRINT_LAYOUT_PAGES_CACHE = 32

const ebookHtmlCache = new Map<string, string>()
const ebookCssCache = new Map<string, string>()
const printChapterCache = new Map<string, { pages: PrintPage[]; nextPageNumber: number }>()
const printSpineCache = new Map<string, Manuscript[]>()
/** Flat interior pages keyed by `computePrintLayoutBasisKey` — reused for KDP PDF when fingerprint matches. */
const printLayoutPaginatedCache = new Map<string, PrintPage[]>()

/** Insert/update as most-recent; evict oldest entries beyond maxSize (Map insertion order). */
function touchLru<K, V>(map: Map<K, V>, key: K, value: V, maxSize: number): void {
  map.delete(key)
  map.set(key, value)
  while (map.size > maxSize) {
    const first = map.keys().next().value as K | undefined
    if (first === undefined) break
    map.delete(first)
  }
}

function printSpineCacheKey(
  project: InkwellProject,
  meta: { bookTitle: string; authorName: string },
  printOverride?: Theme['print'],
): string {
  const print = printOverride ?? project.theme.print
  return hashStringDjb2(
    safeStringify({
      id: project.id,
      meta,
      assembly: project.assembly,
      print,
      chapters: project.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        sectionRole: c.sectionRole,
        includeInPrint: c.includeInPrint,
        includeInPrintToc: c.includeInPrintToc,
      })),
    }),
  )
}

function safeStringify(x: unknown): string {
  try {
    return JSON.stringify(x)
  } catch {
    return String(x)
  }
}

function renderChapterHtml(
  chapter: { id: number; title: string; content: JSONContent },
  ebookTheme: EbookTheme,
): string {
  const title = chapter.title?.trim() || 'Untitled chapter'
  const body = tiptapDocToXhtmlBody(chapter.content)
  const spec = CHAPTER_TITLE_STYLES[ebookTheme.chapterTitleStyleId]
  const ornament = spec.ornamentBelow
    ? `<div class="inkwell-ch-ornament">${escapeHtml(spec.ornamentBelow)}</div>`
    : ''
  return `<div class="chapter"><h1>${escapeHtml(title)}</h1>${ornament}${body}</div>`
}

function post(msg: WorkerResponse) {
  ;(self as unknown as Worker).postMessage(msg)
}

function postPdfResult(rev: number, bytes: Uint8Array) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ;(self as unknown as Worker).postMessage({ kind: 'pdfResult', rev, bytes: new Uint8Array(ab) }, [ab])
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data
  try {
    if (req.kind === 'renderEbook') {
      const themeKey = hashStringDjb2(safeStringify(req.ebookTheme))
      const css = (() => {
        const cached = ebookCssCache.get(themeKey)
        if (cached) return cached
        const next = ebookCss(req.ebookTheme)
        ebookCssCache.set(themeKey, next)
        return next
      })()

      const chapterKey = hashStringDjb2(safeStringify(req.chapter.content))
      const cacheKey = `${req.chapter.id}|${themeKey}|${chapterKey}`
      const html = (() => {
        const cached = ebookHtmlCache.get(cacheKey)
        if (cached) return cached
        const next = renderChapterHtml(req.chapter, req.ebookTheme)
        ebookHtmlCache.set(cacheKey, next)
        return next
      })()

      post({ kind: 'ebookResult', rev: req.rev, css, chapterId: req.chapter.id, html })
      return
    }

    if (req.kind === 'paginatePrintChapter') {
      const layout = req.layoutKind ?? layoutProfileForManuscript(req.chapter)
      const ordinal = req.chapterOrdinalForOpener ?? req.chapterIndex + 1
      const cacheKey = hashStringDjb2(
        safeStringify({
          chapterContent: req.chapter.content,
          chapterTitle: req.chapter.title,
          chapterIndex: req.chapterIndex,
          chapterId: req.chapter.id,
          theme: req.theme,
          startPageNumber: req.startPageNumber,
          meta: req.meta,
          layout,
          ordinal,
        }),
      )
      let cached = printChapterCache.get(cacheKey)
      if (!cached) {
        const titleFontId = resolvePrintTitleFontId(req.theme.print)
        const {
          body,
          title,
          bodyBold,
          bodyItalic,
          bodyBoldItalic,
          bodyBoldIsSynthetic,
          bodyItalicIsSynthetic,
        } = await getPrintFontPairForMeasurement(req.theme.print.bodyFontId, titleFontId)
        const res = await paginateChapterWithFont(
          req.chapter,
          req.chapterIndex,
          req.theme,
          {
            body,
            title,
            bodyBold,
            bodyItalic,
            bodyBoldItalic,
            bodyBoldIsSynthetic,
            bodyItalicIsSynthetic,
          },
          req.startPageNumber,
          {
            bookTitle: req.meta.bookTitle,
            authorName: req.meta.authorName,
          },
          layout,
          ordinal,
        )
        cached = { pages: res.pages, nextPageNumber: res.nextPageNumber }
        touchLru(printChapterCache, cacheKey, cached, MAX_PRINT_CHAPTER_CACHE)
      } else {
        touchLru(printChapterCache, cacheKey, cached, MAX_PRINT_CHAPTER_CACHE)
      }
      post({
        kind: 'printChapterResult',
        rev: req.rev,
        chapterId: req.chapter.id,
        chapterIndex: req.chapterIndex,
        pages: cached.pages,
        nextPageNumber: cached.nextPageNumber,
        startPageNumber: req.startPageNumber,
      })
      return
    }

    if (req.kind === 'buildPdf') {
      const hint = req.layoutFingerprint?.trim()
      const cached =
        hint && hint.length > 0 ? printLayoutPaginatedCache.get(hint) : undefined
      const precomputed =
        cached != null && cached.length > 0 ? cached : undefined
      const bytes = await buildKdpPdf(req.project, {
        precomputedPages: precomputed,
        onProgress: (p) =>
          post({ kind: 'pdfProgress', rev: req.rev, phase: p.phase, done: p.done, total: p.total }),
      })
      postPdfResult(req.rev, bytes)
      return
    }

    if (req.kind === 'resolvePrintSpine') {
      const ck = printSpineCacheKey(req.project, req.meta, req.theme.print)
      let spine = printSpineCache.get(ck)
      let layoutSeed:
        | {
            layoutBasisKey: string
            chapters: Array<{ chapterId: number; pages: PrintPage[] }>
          }
        | undefined
      if (!spine) {
        const titleFontId = resolvePrintTitleFontId(req.theme.print)
        const {
          body,
          title,
          bodyBold,
          bodyItalic,
          bodyBoldItalic,
          bodyBoldIsSynthetic,
          bodyItalicIsSynthetic,
        } = await getPrintFontPairForMeasurement(req.theme.print.bodyFontId, titleFontId)
        const { finalSpine, pages } = await resolvePrintSpineLayoutForExport(
          req.project,
          {
            body,
            title,
            bodyBold,
            bodyItalic,
            bodyBoldItalic,
            bodyBoldIsSynthetic,
            bodyItalicIsSynthetic,
          },
          req.meta,
          req.theme,
        )
        spine = finalSpine
        touchLru(printSpineCache, ck, spine, MAX_PRINT_SPINE_CACHE)

        if (req.project.assembly.includePrintToc && pages.length > 0) {
          const layoutBasisKey = computePrintLayoutBasisKey(req.project, req.theme)
          const grouped = groupPrintPreviewPagesByChapter(spine, pages)
          const chapters = spine.map((m) => ({ chapterId: m.id, pages: grouped.get(m.id) ?? [] }))
          const flat: PrintPage[] = []
          for (const m of spine) {
            flat.push(...(grouped.get(m.id) ?? []))
          }
          const trimmed = trimTrailingBlankPrintPage(flat)
          touchLru(printLayoutPaginatedCache, layoutBasisKey, trimmed, MAX_PRINT_LAYOUT_PAGES_CACHE)
          layoutSeed = { layoutBasisKey, chapters }
        }
      } else {
        touchLru(printSpineCache, ck, spine, MAX_PRINT_SPINE_CACHE)
      }
      post({ kind: 'printSpineResult', rev: req.rev, spine, layoutSeed })
      return
    }

    if (req.kind === 'paginatePrintSpine') {
      const ctx = { bookTitle: req.meta.bookTitle, authorName: req.meta.authorName }
      const titleFontId = resolvePrintTitleFontId(req.theme.print)
      const {
        body,
        title,
        bodyBold,
        bodyItalic,
        bodyBoldItalic,
        bodyBoldIsSynthetic,
        bodyItalicIsSynthetic,
      } = await getPrintFontPairForMeasurement(req.theme.print.bodyFontId, titleFontId)
      const allPages = await paginateSpineWithFont(
        req.spine,
        req.theme,
        {
          body,
          title,
          bodyBold,
          bodyItalic,
          bodyBoldItalic,
          bodyBoldIsSynthetic,
          bodyItalicIsSynthetic,
        },
        ctx,
        {
          onChapterComplete: async ({ spine, pagesSoFar, chapterIndex }) => {
            try {
              const grouped = groupPrintPreviewPagesByChapter(spine, pagesSoFar)
              const chapters = spine.map((m) => ({ chapterId: m.id, pages: grouped.get(m.id) ?? [] }))
              post({
                kind: 'printSpinePagesProgress',
                rev: req.rev,
                chapters,
                completedChapterIndex: chapterIndex,
              })
            } catch {
              /* progress is best-effort; final result still posts */
            }
          },
        },
      )
      const grouped = groupPrintPreviewPagesByChapter(req.spine, allPages)
      const chapters = req.spine.map((m) => ({ chapterId: m.id, pages: grouped.get(m.id) ?? [] }))
      const flat: PrintPage[] = []
      for (const m of req.spine) {
        flat.push(...(grouped.get(m.id) ?? []))
      }
      const trimmed = trimTrailingBlankPrintPage(flat)
      touchLru(printLayoutPaginatedCache, req.layoutFingerprint, trimmed, MAX_PRINT_LAYOUT_PAGES_CACHE)
      post({ kind: 'printSpinePagesResult', rev: req.rev, chapters })
      return
    }
  } catch (e) {
    post({
      kind: 'error',
      rev: req.rev,
      job: req.kind,
      message: e instanceof Error ? e.message : 'Worker job failed',
    })
  }
}
