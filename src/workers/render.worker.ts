import type { JSONContent } from '@tiptap/core'
import type { EbookTheme, InkwellProject, Manuscript, Theme } from '../types'
import { ebookCss } from '../lib/ebook/ebookCss'
import { tiptapDocToXhtmlBody } from '../lib/ebook/tiptapRender'
import { escapeHtml } from '../lib/escapeHtml'
import { hashStringDjb2 } from '../lib/hash'
import { layoutProfileForManuscript } from '../lib/bookAssembly'
import { getPrintFontForMeasurement } from '../lib/print/fonts'
import { paginateChapterWithFont, type PrintLayoutKind, type PrintPage } from '../lib/print/paginate'

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
}

type WorkerRequest = RenderEbookJob | PaginatePrintChapterJob | BuildPdfJob

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

type WorkerError = {
  kind: 'error'
  rev: number
  job: WorkerRequest['kind']
  message: string
}

type WorkerResponse = EbookResult | PrintChapterResult | PdfResult | WorkerError

const ebookHtmlCache = new Map<string, string>()
const ebookCssCache = new Map<string, string>()
const printChapterCache = new Map<string, { pages: PrintPage[]; nextPageNumber: number }>()

function safeStringify(x: unknown): string {
  try {
    return JSON.stringify(x)
  } catch {
    return String(x)
  }
}

function renderChapterHtml(chapter: { id: number; title: string; content: JSONContent }): string {
  const title = chapter.title?.trim() || 'Untitled chapter'
  const body = tiptapDocToXhtmlBody(chapter.content)
  return `<div class="chapter"><h1>${escapeHtml(title)}</h1>${body}</div>`
}

function post(msg: WorkerResponse) {
  ;(self as unknown as Worker).postMessage(msg)
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
        const next = renderChapterHtml(req.chapter)
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
        const { font } = await getPrintFontForMeasurement()
        const res = await paginateChapterWithFont(
          req.chapter,
          req.chapterIndex,
          req.theme,
          font,
          req.startPageNumber,
          {
            bookTitle: req.meta.bookTitle,
            authorName: req.meta.authorName,
          },
          layout,
          ordinal,
        )
        cached = { pages: res.pages, nextPageNumber: res.nextPageNumber }
        printChapterCache.set(cacheKey, cached)
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
      post({ kind: 'pdfResult', rev: req.rev, bytes: new Uint8Array() })
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
