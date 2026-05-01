import type { JSONContent } from '@tiptap/core'
import type { Manuscript, PrintTheme, Theme } from '../../types'
import { TRIM_PRESETS } from '../../types'
import { extractPrintBlocks, type PrintBlock } from './extractBlocks'
import { PDFDocument, StandardFonts } from 'pdf-lib'

export type PrintLine = {
  text: string
  xPt: number
  yPt: number
  fontSizePt: number
  chapterId: number
}

export type PrintPage = {
  pageNumber: number
  widthPt: number
  heightPt: number
  lines: PrintLine[]
  isBlank: boolean
}

type FontMeasurer = {
  widthOfTextAtSize: (text: string, size: number) => number
}

const PT_PER_IN = 72

function inToPt(inches: number): number {
  return inches * PT_PER_IN
}

function toWinAnsiFallback(s: string): string {
  // pdf-lib StandardFonts (TimesRoman, etc.) use WinAnsi encoding.
  // If a manuscript contains extended Unicode, width measurement can throw.
  // We approximate by stripping diacritics and normalizing punctuation.
  const normalized = s.normalize('NFKD').replace(/\p{M}+/gu, '')
  return (
    normalized
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    // Replace anything outside WinAnsi-ish range with '?'
    // (avoids crashes on emoji/symbols like ❤).
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?')
  )
}

function safeWidthOfTextAtSize(text: string, size: number, font: FontMeasurer): number {
  try {
    return font.widthOfTextAtSize(text, size)
  } catch {
    // Fall back only if the font can't encode a character.
    return font.widthOfTextAtSize(toWinAnsiFallback(text), size)
  }
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function wrapText(text: string, maxWidthPt: number, fontSizePt: number, font: FontMeasurer): string[] {
  const t = normalizeSpaces(text)
  if (t.length === 0) return ['']

  const words = t.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w
    if (safeWidthOfTextAtSize(candidate, fontSizePt, font) <= maxWidthPt) {
      current = candidate
      continue
    }

    if (current) lines.push(current)
    // If a single word is too long, hard-break it.
    if (safeWidthOfTextAtSize(w, fontSizePt, font) <= maxWidthPt) {
      current = w
      continue
    }
    let chunk = ''
    for (const ch of w) {
      const cand = chunk + ch
      if (safeWidthOfTextAtSize(cand, fontSizePt, font) <= maxWidthPt) {
        chunk = cand
      } else {
        if (chunk) lines.push(chunk)
        chunk = ch
      }
    }
    current = chunk
  }
  if (current) lines.push(current)
  return lines
}

function contentBoxForPage(theme: PrintTheme, pageNumber: number) {
  const trim = TRIM_PRESETS[theme.trimPreset]
  const widthPt = inToPt(trim.widthIn)
  const heightPt = inToPt(trim.heightIn)

  const isRight = pageNumber % 2 === 1
  const inner = inToPt(theme.marginInnerIn + theme.gutterIn)
  const outer = inToPt(theme.marginOuterIn)
  const top = inToPt(theme.marginTopIn)
  const bottom = inToPt(theme.marginBottomIn)

  const leftPt = isRight ? inner : outer
  const rightPt = isRight ? outer : inner
  const contentWidthPt = Math.max(1, widthPt - leftPt - rightPt)
  const contentHeightPt = Math.max(1, heightPt - top - bottom)

  return { widthPt, heightPt, leftPt, rightPt, topPt: top, bottomPt: bottom, contentWidthPt, contentHeightPt }
}

type Run = { chapterId: number; blocks: PrintBlock[] }

function buildRuns(chapters: Manuscript[]): Run[] {
  return chapters.map((ch) => ({ chapterId: ch.id, blocks: extractPrintBlocks(ch.content as JSONContent) }))
}

export async function paginateForPrintReview(chapters: Manuscript[], theme: Theme): Promise<PrintPage[]> {
  // pdf-lib gives us deterministic text measurement that we can reuse in PDF export.
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.TimesRoman)
  return paginateWithFont(chapters, theme, font)
}

export async function paginateWithFont(
  chapters: Manuscript[],
  theme: Theme,
  font: FontMeasurer,
): Promise<PrintPage[]> {
  const print = theme.print

  const pages: PrintPage[] = []
  let pageNumber = 1

  const startNewPage = (blank = false) => {
    const box = contentBoxForPage(print, pageNumber)
    pages.push({
      pageNumber,
      widthPt: box.widthPt,
      heightPt: box.heightPt,
      lines: [],
      isBlank: blank,
    })
  }

  const ensurePage = () => {
    if (pages.length === 0 || pages[pages.length - 1]!.pageNumber !== pageNumber) startNewPage(false)
  }

  const nextPage = (blank = false) => {
    pageNumber += 1
    startNewPage(blank)
  }

  const runs = buildRuns(chapters)
  for (const run of runs) {
    // Chapters begin on a new page.
    if (pages.length > 0 && pages[pages.length - 1]!.lines.length > 0) nextPage(false)
    ensurePage()

    // Optionally force chapter start on a right-hand page (odd page number).
    if (print.chapterStartsOn === 'right' && pageNumber % 2 === 0) {
      // Insert an intentional blank page, then start content on the next page.
      pages[pages.length - 1]!.isBlank = true
      nextPage(false)
    }

    for (const block of run.blocks) {
      if (block.type === 'pageBreak') {
        nextPage(false)
        continue
      }

      const box = contentBoxForPage(print, pageNumber)
      ensurePage()
      const page = pages[pages.length - 1]!

      const fontSizePt =
        block.type === 'heading'
          ? block.level === 1
            ? print.fontSizePt * 1.55
            : block.level === 2
              ? print.fontSizePt * 1.3
              : print.fontSizePt * 1.15
          : print.fontSizePt

      const blockLineHeightPt = fontSizePt * print.lineHeight
      const lines = wrapText(block.text, box.contentWidthPt, fontSizePt, font)

      const yStartPt =
        box.heightPt -
        box.topPt -
        (page.lines.length === 0 ? 0 : blockLineHeightPt * 0.4) -
        page.lines.reduce((acc, l) => Math.max(acc, box.heightPt - l.yPt), 0)

      // Track current y by looking at last line on the page.
      let cursorYPt =
        page.lines.length === 0 ? box.heightPt - box.topPt : page.lines[page.lines.length - 1]!.yPt - blockLineHeightPt

      // If heading, give it a bit more air when not at top.
      if (block.type === 'heading' && page.lines.length > 0) cursorYPt -= blockLineHeightPt * 0.25
      void yStartPt // keep for clarity; layout uses cursorYPt directly.

      for (const line of lines) {
        const minYPt = box.bottomPt + blockLineHeightPt
        if (cursorYPt <= minYPt) {
          nextPage(false)
          const nextBox = contentBoxForPage(print, pageNumber)
          const nextPageObj = pages[pages.length - 1]!
          cursorYPt = nextBox.heightPt - nextBox.topPt
          // Recompute box for new page.
          ;(void nextPageObj)
        }

        const boxNow = contentBoxForPage(print, pageNumber)
        const left = boxNow.leftPt
        const pageNow = pages[pages.length - 1]!
        pageNow.lines.push({
          text: line,
          xPt: left,
          yPt: cursorYPt,
          fontSizePt,
          chapterId: run.chapterId,
        })
        cursorYPt -= blockLineHeightPt
      }
    }
  }

  // Ensure at least one page exists.
  if (pages.length === 0) {
    startNewPage(false)
  }

  // If page numbers are disabled, keep them logically but caller can hide UI.
  return pages
}

