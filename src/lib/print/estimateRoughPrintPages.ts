import type { Manuscript, PrintTheme } from '../../types'
import { TRIM_PRESETS } from '../../types'
import { printContentWidthPt } from '../bookAssembly'
import { totalWordsInChapters } from '../manuscripts'

/**
 * Fast heuristic interior page count for the Format sidebar (~only).
 * True print length requires full pagination (hyphenation, blanks, TOC).
 */
export function estimateRoughPrintInteriorPages(chapters: Manuscript[], print: PrintTheme): number {
  const trim = TRIM_PRESETS[print.trimPreset]
  const contentWPt = printContentWidthPt(print)
  const headerReserveIn = print.header.enabled ? (print.header.fontSizePt / 72) * 1.8 : 0
  const footerReserveIn = print.footer.enabled ? (print.footer.fontSizePt / 72) * 1.8 : 0
  const usableHIn = Math.max(
    1,
    trim.heightIn - print.marginTopIn - print.marginBottomIn - headerReserveIn - footerReserveIn,
  )
  const usableHPt = usableHIn * 72
  const lineHeightPt = print.fontSizePt * print.lineHeight
  const linesPerPage = Math.max(1, Math.floor(usableHPt / lineHeightPt))
  const avgCharsPerWord = 5.5
  const charWidthPt = print.fontSizePt * 0.48
  const charsPerLine = Math.max(12, Math.floor(contentWPt / charWidthPt))
  const words = totalWordsInChapters(chapters)
  const totalLines = Math.ceil((words * avgCharsPerWord) / charsPerLine)
  return Math.max(1, Math.ceil(totalLines / linesPerPage))
}
