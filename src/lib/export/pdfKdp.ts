import {
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  type PDFFont,
} from 'pdf-lib'
import type { InkwellProject } from '../../types'
import { paginateProjectForPrintExport, resolvePrintTitleFontId } from '../print/paginate'
import { getPrintFontPairForPdf } from '../print/fonts'

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

export async function buildKdpPdf(project: InkwellProject): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const titleFontId = resolvePrintTitleFontId(project.theme.print)
  const { body, title } = await getPrintFontPairForPdf(
    pdf,
    project.theme.print.bodyFontId,
    titleFontId,
  )

  const bleedPt = (project.theme.print.bleedIn ?? 0) * 72

  const pages = await paginateProjectForPrintExport(
    project,
    { body, title },
    {
      bookTitle: project.book.title,
      authorName: project.book.authorName,
    },
  )

  const drawWith = (font: PDFFont, raw: string): string => {
    try {
      font.encodeText(raw)
      return raw
    } catch {
      return toWinAnsiFallback(raw)
    }
  }

  for (const p of pages) {
    const page = pdf.addPage([p.widthPt + 2 * bleedPt, p.heightPt + 2 * bleedPt])
    if (!p.isBlank) {
      for (const l of p.lines) {
        // Title font for chapter banner / ornament lines (set via line.fontId in paginate),
        // body font for everything else.
        const useTitleFont = l.fontId != null && l.fontId === titleFontId
        const lineFont = useTitleFont ? title : body
        const text = drawWith(lineFont, l.text)
        const characterSpacing =
          l.trackingEm && l.trackingEm > 0 ? l.trackingEm * l.fontSizePt : 0

        // pdf-lib's high-level drawText doesn't expose the Tc text-state operator,
        // so wrap the draw in a graphics-state push/pop and emit setCharacterSpacing
        // ourselves when the line uses tracked letter-spacing.
        if (characterSpacing > 0) {
          page.pushOperators(pushGraphicsState(), setCharacterSpacing(characterSpacing))
        }
        page.drawText(text, {
          x: l.xPt + bleedPt,
          y: l.yPt + bleedPt,
          font: lineFont,
          size: l.fontSizePt,
          color: rgb(0.12, 0.1, 0.09),
        })
        if (characterSpacing > 0) {
          page.pushOperators(popGraphicsState())
        }
      }
    }
  }

  // Deterministic output: avoid timestamps/metadata variability.
  pdf.setCreator('Inkwell')
  pdf.setProducer('Inkwell')
  pdf.setTitle(project.book.title || 'Inkwell Manuscript')

  return await pdf.save({ useObjectStreams: false })
}

