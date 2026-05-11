import type { Manuscript, PrintTheme } from '../../types'
import { TRIM_PRESETS } from '../../types'
import { printContentWidthPt } from '../bookAssembly'
import { totalWordsInChapters } from '../manuscripts'
import { countWordsInDoc } from '../wordCount'

/** Heuristic interior pages for a word count (matches `estimateRoughPrintInteriorPages` geometry). */
export function roughInteriorPagesForWordCount(words: number, print: PrintTheme): number {
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
  const totalLines = Math.ceil((words * avgCharsPerWord) / charsPerLine)
  return Math.max(1, Math.ceil(totalLines / linesPerPage))
}

/**
 * Fast heuristic interior page count for the Format sidebar (~only).
 * True print length requires full pagination (hyphenation, blanks, TOC).
 */
export function estimateRoughPrintInteriorPages(chapters: Manuscript[], print: PrintTheme): number {
  const words = totalWordsInChapters(chapters)
  return roughInteriorPagesForWordCount(words, print)
}

/**
 * Approximate book-global start page number for `spine[chapterIndex]` (1-based),
 * by summing rough page counts for prior spine sections. Used for fast print preview
 * before full-spine pagination; full layout still replaces this.
 */
export function roughPrintStartPageForSpineIndex(
  spine: Manuscript[],
  chapterIndex: number,
  print: PrintTheme,
): number {
  if (chapterIndex <= 0) return 1
  let start = 1
  for (let i = 0; i < chapterIndex && i < spine.length; i++) {
    const words = countWordsInDoc(spine[i]!.content)
    start += roughInteriorPagesForWordCount(words, print)
  }
  return start
}
