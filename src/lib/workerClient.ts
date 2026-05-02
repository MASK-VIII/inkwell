import type { JSONContent } from '@tiptap/core'
import type { EbookTheme, InkwellProject, Manuscript, Theme } from '../types'
import type { PrintLayoutKind, PrintPage } from './print/paginate'

let workerRevSeq = 0

/** Monotonic id so ebook + print jobs never share a rev and collide. */
export function nextWorkerRev(): number {
  return ++workerRevSeq
}

type RenderEbookReq = {
  kind: 'renderEbook'
  rev: number
  chapter: { id: number; title: string; content: JSONContent }
  ebookTheme: EbookTheme
}

type PaginatePrintChapterReq = {
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

type BuildPdfReq = {
  kind: 'buildPdf'
  rev: number
  project: InkwellProject
}

type WorkerRequest = RenderEbookReq | PaginatePrintChapterReq | BuildPdfReq

export type EbookResultMsg = {
  kind: 'ebookResult'
  rev: number
  css: string
  chapterId: number
  html: string
}

export type PrintChapterResultMsg = {
  kind: 'printChapterResult'
  rev: number
  chapterId: number
  chapterIndex: number
  pages: PrintPage[]
  nextPageNumber: number
  startPageNumber: number
}

export type PdfResultMsg = {
  kind: 'pdfResult'
  rev: number
  bytes: Uint8Array
}

export type WorkerErrorMsg = {
  kind: 'error'
  rev: number
  job: WorkerRequest['kind']
  message: string
}

export type WorkerResponse = EbookResultMsg | PrintChapterResultMsg | PdfResultMsg | WorkerErrorMsg

let singleton: Worker | null = null

function getWorker(): Worker {
  if (singleton) return singleton
  singleton = new Worker(new URL('../workers/render.worker.ts', import.meta.url), { type: 'module' })
  return singleton
}

export function sendWorker(req: WorkerRequest): void {
  getWorker().postMessage(req)
}

export function onWorkerMessage(cb: (msg: WorkerResponse) => void): () => void {
  const w = getWorker()
  const handler = (e: MessageEvent<WorkerResponse>) => cb(e.data)
  w.addEventListener('message', handler)
  return () => w.removeEventListener('message', handler)
}
