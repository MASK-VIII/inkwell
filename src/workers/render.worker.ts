import type { JSONContent } from '@tiptap/core'
import type { EbookTheme, InkwellProject, Manuscript, Theme } from '../types'
import { ebookCss } from '../lib/ebook/ebookCss'
import { tiptapDocToXhtmlBody } from '../lib/ebook/tiptapRender'
import { escapeHtml } from '../lib/escapeHtml'
import { hashStringDjb2 } from '../lib/hash'
import { getPrintFontForMeasurement } from '../lib/print/fonts'
import { paginateWithFont, type PrintPage } from '../lib/print/paginate'

type RenderEbookJob = {
  kind: 'renderEbook'
  rev: number
  chapter: { id: number; title: string; content: JSONContent }
  ebookTheme: EbookTheme
}

type PaginatePrintJob = {
  kind: 'paginatePrint'
  rev: number
  chapters: Manuscript[]
  theme: Theme
  meta: { bookTitle: string; authorName: string }
}

type BuildPdfJob = {
  kind: 'buildPdf'
  rev: number
  project: InkwellProject
}

type WorkerRequest = RenderEbookJob | PaginatePrintJob | BuildPdfJob

type EbookResult = {
  kind: 'ebookResult'
  rev: number
  css: string
  chapterId: number
  html: string
}

type PrintChunk = {
  kind: 'printChunk'
  rev: number
  pages: PrintPage[]
  done: boolean
  pageCountSoFar: number
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

type WorkerResponse = EbookResult | PrintChunk | PdfResult | WorkerError

const ebookHtmlCache = new Map<string, string>()
const ebookCssCache = new Map<string, string>()
const printPagesCache = new Map<string, PrintPage[]>()

const PRINT_CHUNK_SIZE = 12

async function streamPrintPages(rev: number, pages: PrintPage[]) {
  if (pages.length === 0) {
    post({ kind: 'printChunk', rev, pages: [], done: true, pageCountSoFar: 0 })
    return
  }
  for (let i = 0; i < pages.length; i += PRINT_CHUNK_SIZE) {
    const slice = pages.slice(i, i + PRINT_CHUNK_SIZE)
    const end = i + slice.length
    post({
      kind: 'printChunk',
      rev,
      pages: slice,
      done: end >= pages.length,
      pageCountSoFar: end,
    })
    await new Promise<void>((r) => setTimeout(r, 0))
  }
}

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

    if (req.kind === 'paginatePrint') {
      const cacheKey = hashStringDjb2(
        safeStringify({ chapters: req.chapters, theme: req.theme, meta: req.meta }),
      )
      let pages = printPagesCache.get(cacheKey)
      if (!pages) {
        const { font } = await getPrintFontForMeasurement()
        pages = await paginateWithFont(req.chapters, req.theme, font, {
          bookTitle: req.meta.bookTitle,
          authorName: req.meta.authorName,
        })
        printPagesCache.set(cacheKey, pages)
      }
      await streamPrintPages(req.rev, pages)
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

