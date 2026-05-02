import type { JSONContent } from '@tiptap/core'
import type {
  Manuscript,
  PrintChapterOpener,
  PrintHeaderFooterSlots,
  PrintHeaderFooterToken,
  PrintTheme,
  Theme,
} from '../../types'
import { TRIM_PRESETS } from '../../types'
import { extractPrintBlocks, type PrintBlock } from './extractBlocks'
import { getEnglishHypher } from './hyphen'
import { getPrintFontForMeasurement } from './fonts'

export type PrintLine = {
  text: string
  xPt: number
  yPt: number
  fontSizePt: number
  chapterId: number
  kind: 'body' | 'header' | 'footer'
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

type HypherLike = { hyphenateText(str: string, minLength?: number): string }

function hardBreakLongWord(word: string, maxWidthPt: number, fontSizePt: number, font: FontMeasurer): string[] {
  const lines: string[] = []
  let chunk = ''
  for (const ch of word) {
    const cand = chunk + ch
    if (safeWidthOfTextAtSize(cand, fontSizePt, font) <= maxWidthPt) {
      chunk = cand
    } else {
      if (chunk) lines.push(chunk)
      chunk = ch
    }
  }
  if (chunk) lines.push(chunk)
  return lines.length ? lines : ['']
}

function hyphenationChunks(word: string, hyphenate: boolean, hypher: HypherLike | null): string[] {
  if (!hyphenate || !hypher || word.length < 5) return [word]
  const marked = hypher.hyphenateText(word, 5)
  const chunks = marked.split('\u00AD')
  return chunks.length > 1 ? chunks : [word]
}

function wrapText(
  text: string,
  maxWidthPt: number,
  fontSizePt: number,
  font: FontMeasurer,
  opts?: { hyphenate?: boolean; hypher?: HypherLike | null },
): string[] {
  const t = normalizeSpaces(text)
  if (t.length === 0) return ['']

  const words = t.split(' ')
  const lines: string[] = []
  let current = ''
  const hyphenateOn = Boolean(opts?.hyphenate && opts?.hypher)
  const hypher = opts?.hypher ?? null

  const widthOf = (s: string) => safeWidthOfTextAtSize(s, fontSizePt, font)

  for (const w of words) {
    const chunks = hyphenationChunks(w, hyphenateOn, hypher)
    const whole = chunks.join('')
    const candWhole = current ? `${current} ${whole}` : whole
    if (widthOf(candWhole) <= maxWidthPt) {
      current = candWhole
      continue
    }

    if (current) {
      lines.push(current)
      current = ''
    }

    if (chunks.length === 1) {
      const word = chunks[0]!
      if (widthOf(word) <= maxWidthPt) {
        current = word
        continue
      }
      const broken = hardBreakLongWord(word, maxWidthPt, fontSizePt, font)
      lines.push(...broken.slice(0, -1))
      current = broken[broken.length - 1] ?? ''
      continue
    }

    let ci = 0
    while (ci < chunks.length) {
      let bestJ = ci - 1
      let testAccum = ''
      for (let j = ci; j < chunks.length; j++) {
        testAccum += chunks[j]!
        const hyphenAfter = j < chunks.length - 1
        const piece = hyphenAfter ? `${testAccum}-` : testAccum
        const trial = current ? `${current} ${piece}` : piece
        if (widthOf(trial) <= maxWidthPt) bestJ = j
        else break
      }

      if (bestJ >= ci) {
        const merged = chunks.slice(ci, bestJ + 1).join('')
        const hyphenAfter = bestJ < chunks.length - 1
        const piece = hyphenAfter ? `${merged}-` : merged
        current = current ? `${current} ${piece}` : piece
        ci = bestJ + 1
        if (hyphenAfter) {
          lines.push(current)
          current = ''
        }
        continue
      }

      if (current) {
        lines.push(current)
        current = ''
        continue
      }

      const rest = chunks.slice(ci).join('')
      const broken = hardBreakLongWord(rest, maxWidthPt, fontSizePt, font)
      lines.push(...broken.slice(0, -1))
      current = broken[broken.length - 1] ?? ''
      break
    }
  }

  if (current) lines.push(current)
  return lines
}

function bodyStartsWithChapterHeading(bodyBlocks: PrintBlock[], chapterTitle: string): boolean {
  const t = normalizeSpaces(chapterTitle).toLowerCase()
  if (!t) return false
  for (const b of bodyBlocks) {
    if (b.type === 'pageBreak') continue
    if (b.type === 'heading' && b.level === 1 && normalizeSpaces(b.text).toLowerCase() === t) return true
    return false
  }
  return false
}

function emDashRuleLine(contentWidthPt: number, fontSizePt: number, font: FontMeasurer): string {
  const mdash = '\u2014'
  let lo = 1
  let hi = 240
  let best = 3
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const w = safeWidthOfTextAtSize(mdash.repeat(mid), fontSizePt, font)
    if (w <= contentWidthPt * 0.62) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return mdash.repeat(Math.max(3, best))
}

function buildChapterOpenerBlocks(
  opener: PrintChapterOpener,
  chapterTitle: string,
  chapterIndex: number,
  bodyBlocks: PrintBlock[],
  contentWidthPt: number,
  theme: PrintTheme,
  font: FontMeasurer,
): PrintBlock[] {
  if (opener === 'off') return []
  if (bodyStartsWithChapterHeading(bodyBlocks, chapterTitle)) return []

  const title = normalizeSpaces(chapterTitle) || `Chapter ${chapterIndex}`

  const banner = (txt: string): PrintBlock => ({
    type: 'heading',
    level: 1,
    text: txt,
    printRole: 'chapterBanner',
  })

  if (opener === 'titleOnly') {
    return [banner(title)]
  }

  const h2Size = theme.fontSizePt * 1.3
  const ruleText = emDashRuleLine(contentWidthPt, h2Size, font)
  return [
    { type: 'heading', level: 3, text: `Chapter ${chapterIndex}` },
    { type: 'heading', level: 2, text: ruleText },
    banner(title),
  ]
}

function contentBoxForPage(
  theme: PrintTheme,
  pageNumber: number,
  opts?: { headerReservePt?: number; footerReservePt?: number },
) {
  const trim = TRIM_PRESETS[theme.trimPreset]
  const widthPt = inToPt(trim.widthIn)
  const heightPt = inToPt(trim.heightIn)

  const isRight = pageNumber % 2 === 1
  const inner = inToPt(theme.marginInnerIn + theme.gutterIn)
  const outer = inToPt(theme.marginOuterIn)
  const top = inToPt(theme.marginTopIn) + (opts?.headerReservePt ?? 0)
  const bottom = inToPt(theme.marginBottomIn) + (opts?.footerReservePt ?? 0)

  const leftPt = isRight ? inner : outer
  const rightPt = isRight ? outer : inner
  const contentWidthPt = Math.max(1, widthPt - leftPt - rightPt)
  const contentHeightPt = Math.max(1, heightPt - top - bottom)

  return { widthPt, heightPt, leftPt, rightPt, topPt: top, bottomPt: bottom, contentWidthPt, contentHeightPt }
}

export async function paginateForPrintReview(
  chapters: Manuscript[],
  theme: Theme,
  ctx?: PrintLayoutContext,
): Promise<PrintPage[]> {
  // Use the same embedded Unicode font strategy as PDF export so Print Review
  // is a true WYSIWYG preview (including diacritics/symbols where glyphs exist).
  const { font } = await getPrintFontForMeasurement()
  return paginateWithFont(chapters, theme, font, ctx)
}

export type PrintLayoutContext = {
  bookTitle?: string
  authorName?: string
}

export type ChapterPaginationResult = {
  chapterId: number
  chapterIndex: number
  pages: PrintPage[]
  nextPageNumber: number
}

function applyPrintHeadersFooters(
  pages: PrintPage[],
  print: PrintTheme,
  font: FontMeasurer,
  ctx: PrintLayoutContext | undefined,
  chapterTitleById: Map<number, string>,
  fallbackChapterId: number,
  boxOpts: { headerReservePt: number; footerReservePt: number },
) {
  const resolveToken = (token: PrintHeaderFooterToken, page: PrintPage, chapterId: number | null): string => {
    switch (token) {
      case 'none':
        return ''
      case 'bookTitle':
        return ctx?.bookTitle?.trim() ?? ''
      case 'author':
        return ctx?.authorName?.trim() ?? ''
      case 'chapterTitle':
        return chapterId == null ? '' : (chapterTitleById.get(chapterId) ?? '')
      case 'pageNumber':
        return String(page.pageNumber)
    }
  }

  const placeSlot = (
    slot: keyof PrintHeaderFooterSlots,
    text: string,
    fontSizePt: number,
    page: PrintPage,
    pageBox: ReturnType<typeof contentBoxForPage>,
    yPt: number,
    chapterId: number,
    kind: 'header' | 'footer',
  ) => {
    if (!text) return
    const w = safeWidthOfTextAtSize(text, fontSizePt, font)
    const xPt =
      slot === 'left'
        ? pageBox.leftPt
        : slot === 'center'
          ? (page.widthPt - w) / 2
          : page.widthPt - pageBox.rightPt - w
    page.lines.push({ text, xPt, yPt, fontSizePt, chapterId, kind })
  }

  for (const p of pages) {
    if (p.isBlank) continue
    const pageBox = contentBoxForPage(print, p.pageNumber, boxOpts)
    const bodyChapterId = p.lines.find((l) => l.kind === 'body')?.chapterId ?? null
    const chapterIdForNav = bodyChapterId ?? fallbackChapterId

    const isOdd = p.pageNumber % 2 === 1
    const headerSlots = isOdd ? print.header.odd : print.header.even
    const footerSlots = isOdd ? print.footer.odd : print.footer.even

    if (print.header.enabled) {
      const yHeader = p.heightPt - inToPt(print.marginTopIn) + print.header.fontSizePt * 0.2
      placeSlot('left', resolveToken(headerSlots.left, p, bodyChapterId), print.header.fontSizePt, p, pageBox, yHeader, chapterIdForNav, 'header')
      placeSlot('center', resolveToken(headerSlots.center, p, bodyChapterId), print.header.fontSizePt, p, pageBox, yHeader, chapterIdForNav, 'header')
      placeSlot('right', resolveToken(headerSlots.right, p, bodyChapterId), print.header.fontSizePt, p, pageBox, yHeader, chapterIdForNav, 'header')
    }

    if (print.footer.enabled || print.pageNumbers === 'footerCenter') {
      const effectiveFooterSlots =
        print.footer.enabled
          ? footerSlots
          : print.pageNumbers === 'footerCenter'
            ? ({ left: 'none', center: 'pageNumber', right: 'none' } as const)
            : footerSlots
      const effectiveFooterFontSizePt =
        print.footer.enabled ? print.footer.fontSizePt : print.pageNumbers === 'footerCenter' ? 10 : print.footer.fontSizePt

      const minBaseline = effectiveFooterFontSizePt * 1.2
      const yFooter = Math.max(minBaseline, inToPt(print.marginBottomIn) - effectiveFooterFontSizePt * 0.2)
      placeSlot(
        'left',
        resolveToken(effectiveFooterSlots.left, p, bodyChapterId),
        effectiveFooterFontSizePt,
        p,
        pageBox,
        yFooter,
        chapterIdForNav,
        'footer',
      )
      placeSlot(
        'center',
        resolveToken(effectiveFooterSlots.center, p, bodyChapterId),
        effectiveFooterFontSizePt,
        p,
        pageBox,
        yFooter,
        chapterIdForNav,
        'footer',
      )
      placeSlot(
        'right',
        resolveToken(effectiveFooterSlots.right, p, bodyChapterId),
        effectiveFooterFontSizePt,
        p,
        pageBox,
        yFooter,
        chapterIdForNav,
        'footer',
      )
    }
  }
}

export async function paginateChapterWithFont(
  chapter: Manuscript,
  chapterIndex: number,
  theme: Theme,
  font: FontMeasurer,
  startPageNumber: number,
  ctx?: PrintLayoutContext,
): Promise<ChapterPaginationResult> {
  const print = theme.print
  const headerReservePt = print.header.enabled ? print.header.fontSizePt * 1.8 : 0
  const footerReservePt = print.footer.enabled ? print.footer.fontSizePt * 1.8 : 0
  const boxOpts = { headerReservePt, footerReservePt }

  const pages: PrintPage[] = []
  let pageNumber = startPageNumber

  const startNewPage = (blank = false) => {
    const box = contentBoxForPage(print, pageNumber, boxOpts)
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

  const chapterTitleById = new Map<number, string>([[chapter.id, chapter.title]])
  const hypher = print.hyphenation ? getEnglishHypher() : null
  const run = { chapterId: chapter.id, blocks: extractPrintBlocks(chapter.content as JSONContent) }

  ensurePage()

  if (print.chapterStartsOn === 'right' && pageNumber % 2 === 0) {
    pages[pages.length - 1]!.isBlank = true
    nextPage(false)
  }

  const boxStart = contentBoxForPage(print, pageNumber, boxOpts)
  const chapterTitle = chapter.title?.trim() ?? ''
  const openerBlocks = buildChapterOpenerBlocks(
    print.chapterOpener,
    chapterTitle,
    chapterIndex + 1,
    run.blocks,
    boxStart.contentWidthPt,
    print,
    font,
  )
  const blocksToLayout = [...openerBlocks, ...run.blocks]

  for (const block of blocksToLayout) {
    if (block.type === 'pageBreak') {
      nextPage(false)
      continue
    }

    const box = contentBoxForPage(print, pageNumber, boxOpts)
    ensurePage()
    const page = pages[pages.length - 1]!

    const isChapterBanner = block.type === 'heading' && block.printRole === 'chapterBanner'

    const fontSizePt =
      block.type === 'heading'
        ? isChapterBanner
          ? print.fontSizePt * 2.5
          : block.level === 1
            ? print.fontSizePt * 1.55
            : block.level === 2
              ? print.fontSizePt * 1.3
              : print.fontSizePt * 1.15
        : print.fontSizePt

    const blockLineHeightPt = isChapterBanner ? fontSizePt * 1.18 : fontSizePt * print.lineHeight
    const lines = wrapText(block.text, box.contentWidthPt, fontSizePt, font, {
      hyphenate: !isChapterBanner && print.hyphenation,
      hypher: isChapterBanner ? null : hypher,
    })

    const yStartPt =
      box.heightPt -
      box.topPt -
      (page.lines.length === 0 ? 0 : blockLineHeightPt * 0.4) -
      page.lines.reduce((acc, l) => Math.max(acc, box.heightPt - l.yPt), 0)

    const prevLine = page.lines.length ? page.lines[page.lines.length - 1]! : null
    let cursorYPt =
      page.lines.length === 0 ? box.heightPt - box.topPt : prevLine!.yPt - blockLineHeightPt

    const gapAfterBanner =
      prevLine && prevLine.kind === 'body' && prevLine.fontSizePt >= print.fontSizePt * 2.2
        ? print.fontSizePt * 1.35
        : 0
    cursorYPt -= gapAfterBanner

    if (isChapterBanner && page.lines.length === 0) {
      cursorYPt -= print.fontSizePt * 1.1
    }

    if (block.type === 'heading' && !isChapterBanner && page.lines.length > 0)
      cursorYPt -= blockLineHeightPt * 0.25
    void yStartPt

    for (const line of lines) {
      const minYPt = box.bottomPt + blockLineHeightPt
      if (cursorYPt <= minYPt) {
        nextPage(false)
        const nextBox = contentBoxForPage(print, pageNumber, boxOpts)
        const nextPageObj = pages[pages.length - 1]!
        cursorYPt = nextBox.heightPt - nextBox.topPt
        ;(void nextPageObj)
      }

      const boxNow = contentBoxForPage(print, pageNumber, boxOpts)
      const lineWidth = safeWidthOfTextAtSize(line, fontSizePt, font)
      const xPt =
        block.type === 'heading'
          ? boxNow.leftPt + Math.max(0, (boxNow.contentWidthPt - lineWidth) / 2)
          : boxNow.leftPt
      const pageNow = pages[pages.length - 1]!
      pageNow.lines.push({
        text: line,
        xPt,
        yPt: cursorYPt,
        fontSizePt,
        chapterId: run.chapterId,
        kind: 'body',
      })
      cursorYPt -= blockLineHeightPt
    }
  }

  if (pages.length === 0) {
    startNewPage(false)
  }

  const lastBeforeHeaderFooter = pages[pages.length - 1]!
  const nextPageNumber =
    pages.length > 0 && lastBeforeHeaderFooter.lines.length > 0 ? pageNumber + 1 : pageNumber

  applyPrintHeadersFooters(pages, print, font, ctx, chapterTitleById, chapter.id, boxOpts)

  return {
    chapterId: chapter.id,
    chapterIndex,
    pages,
    nextPageNumber,
  }
}

export async function paginateWithFont(
  chapters: Manuscript[],
  theme: Theme,
  font: FontMeasurer,
  ctx?: PrintLayoutContext,
): Promise<PrintPage[]> {
  const print = theme.print
  const headerReservePt = print.header.enabled ? print.header.fontSizePt * 1.8 : 0
  const footerReservePt = print.footer.enabled ? print.footer.fontSizePt * 1.8 : 0
  const boxOpts = { headerReservePt, footerReservePt }

  const pages: PrintPage[] = []
  let nextStart = 1

  for (let i = 0; i < chapters.length; i++) {
    const res = await paginateChapterWithFont(chapters[i]!, i, theme, font, nextStart, ctx)
    pages.push(...res.pages)
    nextStart = res.nextPageNumber
  }

  if (pages.length === 0) {
    const pageNumber = 1
    const box = contentBoxForPage(print, pageNumber, boxOpts)
    pages.push({
      pageNumber,
      widthPt: box.widthPt,
      heightPt: box.heightPt,
      lines: [],
      isBlank: false,
    })
    applyPrintHeadersFooters(
      pages,
      print,
      font,
      ctx,
      new Map<number, string>(),
      0,
      boxOpts,
    )
  }

  return pages
}

