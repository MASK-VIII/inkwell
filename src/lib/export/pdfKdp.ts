import { PDFDocument, rgb } from 'pdf-lib'
import type { InkwellProject } from '../../types'
import { paginateProjectForPrintExport } from '../print/paginate'
import { getPrintFontForPdf } from '../print/fonts'

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
  const font = await getPrintFontForPdf(pdf)

  const bleedPt = (project.theme.print.bleedIn ?? 0) * 72

  const pages = await paginateProjectForPrintExport(project, font, {
    bookTitle: project.book.title,
    authorName: project.book.authorName,
  })

  for (const p of pages) {
    const page = pdf.addPage([p.widthPt + 2 * bleedPt, p.heightPt + 2 * bleedPt])
    if (!p.isBlank) {
      for (const l of p.lines) {
        const text = (() => {
          try {
            font.encodeText(l.text)
            return l.text
          } catch {
            return toWinAnsiFallback(l.text)
          }
        })()
        page.drawText(text, {
          x: l.xPt + bleedPt,
          y: l.yPt + bleedPt,
          font,
          size: l.fontSizePt,
          color: rgb(0.12, 0.1, 0.09),
        })
      }
    }
  }

  // Deterministic output: avoid timestamps/metadata variability.
  pdf.setCreator('Inkwell')
  pdf.setProducer('Inkwell')
  pdf.setTitle(project.book.title || 'Inkwell Manuscript')

  return await pdf.save({ useObjectStreams: false })
}

