import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { InkwellProject } from '../../types'
import { paginateWithFont } from '../print/paginate'

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
  const font = await pdf.embedFont(StandardFonts.TimesRoman)

  const pages = await paginateWithFont(project.chapters, project.theme, font)

  for (const p of pages) {
    const page = pdf.addPage([p.widthPt, p.heightPt])
    if (!p.isBlank) {
      for (const l of p.lines) {
        const text = (() => {
          try {
            // If it throws, the StandardFont can't encode a glyph.
            font.encodeText(l.text)
            return l.text
          } catch {
            return toWinAnsiFallback(l.text)
          }
        })()
        page.drawText(text, { x: l.xPt, y: l.yPt, font, size: l.fontSizePt, color: rgb(0.12, 0.1, 0.09) })
      }
    }

    if (project.theme.print.pageNumbers === 'footerCenter') {
      const size = 10
      const text = String(p.pageNumber)
      const w = font.widthOfTextAtSize(text, size)
      page.drawText(text, {
        x: (p.widthPt - w) / 2,
        y: 18,
        font,
        size,
        color: rgb(0.12, 0.1, 0.09),
      })
    }
  }

  // Deterministic output: avoid timestamps/metadata variability.
  pdf.setCreator('Inkwell')
  pdf.setProducer('Inkwell')
  pdf.setTitle(project.book.title || 'Inkwell Manuscript')

  return await pdf.save({ useObjectStreams: false })
}

