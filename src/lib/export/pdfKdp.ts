import {
  PDFDocument,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  type PDFFont,
} from 'pdf-lib'
import { type InkwellProject, TRIM_PRESETS } from '../../types'
import {
  paginateProjectForPrintExport,
  resolvePrintTitleFontId,
  trimTrailingBlankPrintPage,
  yieldToMain,
  type PrintPage,
} from '../print/paginate'
import { getPrintFontPairForPdf } from '../print/fonts'
import { breakOptionalLigaturesForPrint } from '../print/normalizePrintText'

function decodeDataUrl(src: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([^;,]+)?;base64,(.+)$/i.exec(src.trim())
  if (!m?.[2]) return null
  const mime = (m[1] ?? 'application/octet-stream').trim().toLowerCase()
  try {
    const bin = atob(m[2])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { bytes, mime }
  } catch {
    return null
  }
}

async function tryEmbedRaster(
  pdf: PDFDocument,
  src: string,
  cache: Map<string, Awaited<ReturnType<PDFDocument['embedPng']>> | Awaited<ReturnType<PDFDocument['embedJpg']>> | null>,
) {
  const key = src.trim()
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const dec = decodeDataUrl(key)
  if (!dec) {
    cache.set(key, null)
    return null
  }
  try {
    // EPUB sanitizer allows webp/avif; pdf-lib only embeds PNG/JPEG here — rasterise upstream if needed.
    const embedded =
      dec.mime.includes('png') ? await pdf.embedPng(dec.bytes)
      : dec.mime.includes('jpeg') || dec.mime.includes('jpg') ? await pdf.embedJpg(dec.bytes)
      : null
    cache.set(key, embedded)
    return embedded
  } catch {
    cache.set(key, null)
    return null
  }
}

function toWinAnsiFallback(s: string): string {
  const normalized = s.normalize('NFKD').replace(/\p{M}+/gu, '')
  return (
    normalized
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ')
      .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?')
  )
}

export type BuildKdpPdfProgress = {
  phase: 'paginate' | 'render'
  done: number
  total: number
}

/** Fail fast with a clear message before font work / pagination (KDP interior sanity). */
export function validateKdpPdfProject(project: InkwellProject): void {
  const print = project.theme.print
  const trim = TRIM_PRESETS[print.trimPreset]
  if (!(trim.widthIn > 0 && trim.heightIn > 0)) {
    throw new Error('Print trim size must be positive for KDP PDF export.')
  }
  const bleed = print.bleedIn ?? 0
  if (bleed < 0 || bleed > 0.5) {
    throw new Error('Print bleed must be between 0 and 0.5 inches.')
  }
}

export async function buildKdpPdf(
  project: InkwellProject,
  opts?: {
    precomputedPages?: PrintPage[]
    onProgress?: (p: BuildKdpPdfProgress) => void
  },
): Promise<Uint8Array> {
  validateKdpPdfProject(project)
  const onProgress = opts?.onProgress
  const pdf = await PDFDocument.create()
  const titleFontId = resolvePrintTitleFontId(project.theme.print)
  const {
    body,
    title,
    bodyBold,
    bodyItalic,
    bodyBoldItalic,
    bodyBoldIsSynthetic,
    bodyItalicIsSynthetic,
    titleBold,
    titleItalic,
    titleBoldItalic,
    titleBoldIsSynthetic,
    titleItalicIsSynthetic,
  } = await getPrintFontPairForPdf(pdf, project.theme.print.bodyFontId, titleFontId)

  const pdfBodyFont = (bold?: boolean, italic?: boolean): PDFFont => {
    if (bold && italic) return bodyBoldItalic
    if (bold) return bodyBold
    if (italic) return bodyItalic
    return body
  }

  const pdfTitleFont = (bold?: boolean, italic?: boolean): PDFFont => {
    if (bold && italic) return titleBoldItalic
    if (bold) return titleBold
    if (italic) return titleItalic
    return title
  }

  const bleedPt = (project.theme.print.bleedIn ?? 0) * 72

  const fontCtx = {
    body,
    title,
    bodyBold,
    bodyItalic,
    bodyBoldItalic,
    bodyBoldIsSynthetic,
    bodyItalicIsSynthetic,
  }
  const layoutCtx = {
    bookTitle: project.book.title,
    authorName: project.book.authorName,
  }

  let pages: PrintPage[]
  const pre = opts?.precomputedPages
  if (pre != null && pre.length > 0) {
    pages = trimTrailingBlankPrintPage(pre)
    onProgress?.({ phase: 'paginate', done: 1, total: 1 })
  } else {
    onProgress?.({ phase: 'paginate', done: 0, total: 1 })
    pages = await paginateProjectForPrintExport(project, fontCtx, layoutCtx)
    onProgress?.({ phase: 'paginate', done: 1, total: 1 })
  }

  const drawWith = (font: PDFFont, raw: string): string => {
    const prepared = breakOptionalLigaturesForPrint(raw)
    try {
      font.encodeText(prepared)
      return prepared
    } catch {
      return toWinAnsiFallback(prepared)
    }
  }

  const imageCache = new Map<
    string,
    Awaited<ReturnType<PDFDocument['embedPng']>> | Awaited<ReturnType<PDFDocument['embedJpg']>> | null
  >()

  const renderStride = pages.length > 120 ? 12 : pages.length > 40 ? 4 : 1
  for (let pi = 0; pi < pages.length; pi++) {
    if (pi === 0 || pi === pages.length - 1 || pi % renderStride === 0) {
      onProgress?.({ phase: 'render', done: pi + 1, total: pages.length })
    }
    if (pi > 0 && pi % 4 === 0) await yieldToMain()
    const p = pages[pi]!
    const page = pdf.addPage([p.widthPt + 2 * bleedPt, p.heightPt + 2 * bleedPt])
    if (!p.isBlank) {
      for (const l of p.lines) {
        if (l.kind === 'figure' && l.figureSrc && l.figureWidthPt && l.figureHeightPt) {
          const embedded = await tryEmbedRaster(pdf, l.figureSrc, imageCache)
          if (embedded) {
            page.drawImage(embedded, {
              x: l.xPt + bleedPt,
              y: l.yPt + bleedPt,
              width: l.figureWidthPt,
              height: l.figureHeightPt,
            })
          } else {
            page.drawText(drawWith(body, `[${l.text}]`), {
              x: l.xPt + bleedPt,
              y: l.yPt + bleedPt,
              font: body,
              size: Math.min(l.fontSizePt, 11),
              color: rgb(0.12, 0.1, 0.09),
            })
          }
          continue
        }

        // Title font for chapter banner / ornament lines (set via line.fontId in paginate),
        // body font (+ bold/italic variants) for everything else.
        const useTitleFont = l.fontId != null && l.fontId === titleFontId

        const bodyTextRgb = rgb(0.12, 0.1, 0.09)
        /** Oblique approximation when the body font has no italic file (matches browser faux-italic feel). */
        const fauxItalicSkew = degrees(-14)

        const drawOneLine = (
          sub: string,
          font: PDFFont,
          xPt: number,
          opts?: { fauxBold?: boolean; fauxItalic?: boolean },
        ) => {
          const text = drawWith(font, sub)
          const characterSpacing =
            l.trackingEm && l.trackingEm > 0 ? l.trackingEm * l.fontSizePt : 0
          const fauxBold = Boolean(opts?.fauxBold)
          const fauxItalic = Boolean(opts?.fauxItalic)
          const dx = fauxBold ? Math.max(0.12, l.fontSizePt * 0.01) : 0
          const shifts = fauxBold ? [0, dx, dx * 2] : [0]
          if (characterSpacing > 0) {
            page.pushOperators(pushGraphicsState(), setCharacterSpacing(characterSpacing))
          }
          for (const s of shifts) {
            page.drawText(text, {
              x: xPt + bleedPt + s,
              y: l.yPt + bleedPt,
              font,
              size: l.fontSizePt,
              color: bodyTextRgb,
              ...(fauxItalic ? { xSkew: fauxItalicSkew } : {}),
            })
          }
          if (characterSpacing > 0) {
            page.pushOperators(popGraphicsState())
          }
        }

        const pdfBodyFontForDraw = (bold?: boolean, italic?: boolean): PDFFont => {
          const b = Boolean(bold && !bodyBoldIsSynthetic)
          const i = Boolean(italic && !bodyItalicIsSynthetic)
          return pdfBodyFont(b, i)
        }

        const pdfTitleFontForDraw = (bold?: boolean, italic?: boolean): PDFFont => {
          const b = Boolean(bold && !titleBoldIsSynthetic)
          const i = Boolean(italic && !titleItalicIsSynthetic)
          return pdfTitleFont(b, i)
        }

        if (l.textRuns?.length) {
          const baseX = l.xPt
          for (const tr of l.textRuns) {
            const synthBold = useTitleFont ? titleBoldIsSynthetic : bodyBoldIsSynthetic
            const synthItalic = useTitleFont ? titleItalicIsSynthetic : bodyItalicIsSynthetic
            const fauxBold = Boolean(tr.bold && synthBold)
            const fauxItalic = Boolean(tr.italic && synthItalic)
            const segFont = useTitleFont ? pdfTitleFontForDraw(tr.bold, tr.italic) : pdfBodyFontForDraw(tr.bold, tr.italic)
            const segX = baseX + tr.xOffsetPt
            drawOneLine(tr.text, segFont, segX, { fauxBold, fauxItalic })
            if (tr.underline) {
              const prepared = drawWith(segFont, tr.text)
              const uw = segFont.widthOfTextAtSize(prepared, l.fontSizePt)
              const bx = segX + bleedPt
              const baselineY = l.yPt + bleedPt
              const uy = baselineY - Math.max(0.55, l.fontSizePt * 0.075)
              page.drawLine({
                start: { x: bx, y: uy },
                end: { x: bx + uw, y: uy },
                thickness: Math.max(0.35, l.fontSizePt * 0.045),
                color: bodyTextRgb,
              })
            }
            if (tr.strike) {
              const prepared = drawWith(segFont, tr.text)
              const uw = segFont.widthOfTextAtSize(prepared, l.fontSizePt)
              const bx = segX + bleedPt
              const baselineY = l.yPt + bleedPt
              const sy = baselineY + l.fontSizePt * 0.27
              page.drawLine({
                start: { x: bx, y: sy },
                end: { x: bx + uw, y: sy },
                thickness: Math.max(0.35, l.fontSizePt * 0.04),
                color: bodyTextRgb,
              })
            }
          }
        } else {
          const lineFont = useTitleFont ? title : body
          drawOneLine(l.text, lineFont, l.xPt)
        }
      }
    }
  }

  // Deterministic output: avoid timestamps/metadata variability.
  pdf.setCreator('Inkwell')
  pdf.setProducer('Inkwell')
  pdf.setTitle(project.book.title || 'Inkwell Manuscript')

  await yieldToMain()
  return await pdf.save({ useObjectStreams: false })
}

