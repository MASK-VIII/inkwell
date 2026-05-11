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
  /** When set and worker has a fresh spine pagination for this key, skip export re-pagination. */
  layoutFingerprint?: string
}

type ResolvePrintSpineReq = {
  kind: 'resolvePrintSpine'
  rev: number
  project: InkwellProject
  meta: { bookTitle: string; authorName: string }
}

type PaginatePrintSpineReq = {
  kind: 'paginatePrintSpine'
  rev: number
  spine: Manuscript[]
  theme: Theme
  meta: { bookTitle: string; authorName: string }
  /** Matches `computePrintLayoutBasisKey(project, theme)` so export can reuse cached pages. */
  layoutFingerprint: string
}

type WorkerRequest =
  | RenderEbookReq
  | PaginatePrintChapterReq
  | BuildPdfReq
  | ResolvePrintSpineReq
  | PaginatePrintSpineReq

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

export type PdfProgressMsg = {
  kind: 'pdfProgress'
  rev: number
  phase: 'paginate' | 'render'
  done: number
  total: number
}

export type PrintSpineResultMsg = {
  kind: 'printSpineResult'
  rev: number
  spine: Manuscript[]
}

export type PrintSpinePagesResultMsg = {
  kind: 'printSpinePagesResult'
  rev: number
  chapters: Array<{ chapterId: number; pages: PrintPage[] }>
}

export type WorkerErrorMsg = {
  kind: 'error'
  rev: number
  job: WorkerRequest['kind']
  message: string
}

export type WorkerResponse =
  | EbookResultMsg
  | PrintChapterResultMsg
  | PdfResultMsg
  | PdfProgressMsg
  | PrintSpineResultMsg
  | PrintSpinePagesResultMsg
  | WorkerErrorMsg

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

export function buildPdfInWorker(
  project: InkwellProject,
  opts?: {
    layoutFingerprint?: string | null
    onProgress?: (msg: PdfProgressMsg) => void
  },
): Promise<Uint8Array> {
  const rev = nextWorkerRev()
  return new Promise((resolve, reject) => {
    const off = onWorkerMessage((msg: WorkerResponse) => {
      if (msg.rev !== rev) return
      if (msg.kind === 'pdfProgress') {
        opts?.onProgress?.(msg)
        return
      }
      if (msg.kind === 'pdfResult') {
        off()
        resolve(msg.bytes)
        return
      }
      if (msg.kind === 'error') {
        off()
        reject(new Error(msg.message))
      }
    })
    sendWorker({
      kind: 'buildPdf',
      rev,
      project,
      ...(opts?.layoutFingerprint ? { layoutFingerprint: opts.layoutFingerprint } : {}),
    })
  })
}
