import type { JSONContent } from '@tiptap/core'
import type {
  ChapterTitleStyleSpec,
  InkwellFontId,
  InkwellProject,
  Manuscript,
  PrintChapterOpener,
  PrintHeaderFooterSlots,
  PrintHeaderFooterToken,
  PrintTheme,
  Theme,
} from '../../types'
import { CHAPTER_TITLE_STYLES, TRIM_PRESETS } from '../../types'
import {
  buildPrintTocManuscript,
  insertPrintTocInSpine,
  layoutProfileForManuscript,
  manuscriptsForPrint,
  printContentWidthPt,
  stripSyntheticToc,
} from '../bookAssembly'
import { extractPrintBlocks, type PrintBlock } from './extractBlocks'
import { getEnglishHypher } from './hyphen'
import { getPrintFontPairForMeasurement } from './fonts'

export type PrintLine = {
  text: string
  xPt: number
  yPt: number
  fontSizePt: number
  chapterId: number
  kind: 'body' | 'header' | 'footer'
  /**
   * Optional font id used to draw this line in PDF/HTML output. When unset, renderers fall back
   * to the body font. Set on chapter banner / ornament lines so the title font is rendered.
   */
  fontId?: InkwellFontId
  /** Letter-spacing in em (chapter banner / ornament lines). */
  trackingEm?: number
}

/**
 * Print pipeline carries two `FontMeasurer` slots so chapter banners can use a
 * different display font from the body. When the user picks `inherit` for the
 * chapter title style, both slots resolve to the same font instance.
 */
export type PrintFontPair = { body: FontMeasurer; title: FontMeasurer }

function isFontPair(x: FontMeasurer | PrintFontPair): x is PrintFontPair {
  return typeof (x as PrintFontPair).body === 'object' && typeof (x as PrintFontPair).title === 'object'
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

/**
 * Width of a string at the given size with optional letter-spacing applied.
 * Letter-spacing in CSS / PDF `characterSpacing` adds `trackingEm * size` after each
 * character — i.e. `(L - 1)` extra gaps for an L-character string.
 */
function widthWithTracking(
  text: string,
  size: number,
  font: FontMeasurer,
  trackingEm: number | undefined,
): number {
  const base = safeWidthOfTextAtSize(text, size, font)
  if (!trackingEm) return base
  const len = [...text].length
  if (len <= 1) return base
  return base + (len - 1) * trackingEm * size
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
  opts?: { hyphenate?: boolean; hypher?: HypherLike | null; trackingEm?: number },
): string[] {
  const t = normalizeSpaces(text)
  if (t.length === 0) return ['']

  const words = t.split(' ')
  const lines: string[] = []
  let current = ''
  const hyphenateOn = Boolean(opts?.hyphenate && opts?.hypher)
  const hypher = opts?.hypher ?? null
  const trackingEm = opts?.trackingEm

  const widthOf = (s: string) => widthWithTracking(s, fontSizePt, font, trackingEm)

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

/** Title-case heuristic: capitalize the first letter of each whitespace-separated word. */
function toTitleCase(text: string): string {
  return text.replace(/\S+/g, (w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1).toLowerCase()))
}

function applyCaseTransform(text: string, mode: ChapterTitleStyleSpec['case']): string {
  if (mode === 'upper') return text.toLocaleUpperCase()
  if (mode === 'titleCase') return toTitleCase(text)
  return text
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

  const rawTitle = normalizeSpaces(chapterTitle) || `Chapter ${chapterIndex}`
  const spec = CHAPTER_TITLE_STYLES[theme.chapterTitleStyleId]
  const transformedTitle = applyCaseTransform(rawTitle, spec.case)

  const banner = (txt: string): PrintBlock => ({
    type: 'heading',
    level: 1,
    text: txt,
    printRole: 'chapterBanner',
    sizeMultiplier: spec.sizeMultiplier,
    trackingEm: spec.trackingEm || undefined,
    fontIdOverride: spec.fontId,
  })

  const ornament = (glyph: string): PrintBlock => ({
    type: 'heading',
    level: 2,
    text: glyph,
    printRole: 'chapterOrnament',
    sizeMultiplier: 1.4,
    fontIdOverride: spec.fontId,
  })

  const blocks: PrintBlock[] = []
  if (opener === 'titleOnly') {
    blocks.push(banner(transformedTitle))
  } else {
    const h2Size = theme.fontSizePt * 1.3
    const ruleText = emDashRuleLine(contentWidthPt, h2Size, font)
    blocks.push({ type: 'heading', level: 3, text: `Chapter ${chapterIndex}` })
    blocks.push({ type: 'heading', level: 2, text: ruleText })
    blocks.push(banner(transformedTitle))
  }
  if (spec.ornamentBelow) {
    blocks.push(ornament(spec.ornamentBelow))
  }
  return blocks
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

/** Resolve the chapter-title font id from the chosen chapter title style spec. */
export function resolvePrintTitleFontId(theme: PrintTheme): InkwellFontId {
  const spec = CHAPTER_TITLE_STYLES[theme.chapterTitleStyleId]
  return spec.fontId ?? theme.bodyFontId
}

export async function paginateForPrintReview(
  chapters: Manuscript[],
  theme: Theme,
  ctx?: PrintLayoutContext,
): Promise<PrintPage[]> {
  // Use the same embedded Unicode font strategy as PDF export so Print Review
  // is a true WYSIWYG preview (including diacritics/symbols where glyphs exist).
  const titleFontId = resolvePrintTitleFontId(theme.print)
  const { body, title } = await getPrintFontPairForMeasurement(theme.print.bodyFontId, titleFontId)
  return paginateWithFont(chapters, theme, { body, title }, ctx)
}

export type PrintLayoutContext = {
  bookTitle?: string
  authorName?: string
}

export type PrintLayoutKind = 'chapter' | 'matter' | 'part' | 'toc'

function firstPageByChapterId(pages: PrintPage[], spine: Manuscript[]): Map<number, number> {
  const map = new Map<number, number>()
  const want = new Set(spine.map((m) => m.id))
  for (const p of pages) {
    for (const line of p.lines) {
      if (line.kind !== 'body') continue
      if (!want.has(line.chapterId)) continue
      if (!map.has(line.chapterId)) map.set(line.chapterId, p.pageNumber)
    }
  }
  return map
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
  fontOrPair: FontMeasurer | PrintFontPair,
  startPageNumber: number,
  ctx?: PrintLayoutContext,
  layoutKind: PrintLayoutKind = layoutProfileForManuscript(chapter),
  chapterOrdinalForOpener: number = chapterIndex + 1,
): Promise<ChapterPaginationResult> {
  const print = theme.print
  const fonts: PrintFontPair = isFontPair(fontOrPair)
    ? fontOrPair
    : { body: fontOrPair, title: fontOrPair }
  const bodyFont = fonts.body
  const titleFont = fonts.title
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

  const forceRight = layoutKind === 'chapter' || layoutKind === 'part'
  if (forceRight && print.chapterStartsOn === 'right' && pageNumber % 2 === 0) {
    pages[pages.length - 1]!.isBlank = true
    nextPage(false)
  }

  const boxStart = contentBoxForPage(print, pageNumber, boxOpts)
  const chapterTitle = chapter.title?.trim() ?? ''
  const titleSpec = CHAPTER_TITLE_STYLES[print.chapterTitleStyleId]
  const openerBlocks: PrintBlock[] =
    layoutKind === 'matter' || layoutKind === 'toc'
      ? []
      : layoutKind === 'part'
        ? [
            {
              type: 'heading',
              level: 1,
              text: applyCaseTransform(
                chapterTitle || `Part ${chapterOrdinalForOpener}`,
                titleSpec.case,
              ),
              printRole: 'chapterBanner',
              sizeMultiplier: titleSpec.sizeMultiplier,
              trackingEm: titleSpec.trackingEm || undefined,
              fontIdOverride: titleSpec.fontId,
            },
          ]
        : buildChapterOpenerBlocks(
            print.chapterOpener,
            chapterTitle,
            chapterOrdinalForOpener,
            run.blocks,
            boxStart.contentWidthPt,
            print,
            bodyFont,
          )
  const blocksToLayout = [...openerBlocks, ...run.blocks]

  let prevBlockChapterIntro = false
  for (const block of blocksToLayout) {
    if (block.type === 'pageBreak') {
      nextPage(false)
      prevBlockChapterIntro = false
      continue
    }

    const box = contentBoxForPage(print, pageNumber, boxOpts)
    ensurePage()
    const page = pages[pages.length - 1]!

    const isChapterBanner = block.type === 'heading' && block.printRole === 'chapterBanner'
    const isChapterOrnament = block.type === 'heading' && block.printRole === 'chapterOrnament'
    const isSceneBreak = block.type === 'heading' && block.printRole === 'sceneBreak'
    const isChapterIntro = isChapterBanner || isChapterOrnament

    // Chapter banner / ornament use the title font; everything else uses the body font.
    const blockFont: FontMeasurer = isChapterIntro ? titleFont : bodyFont
    const blockFontId: InkwellFontId | undefined =
      block.type === 'heading' && isChapterIntro
        ? (block.fontIdOverride ?? print.bodyFontId)
        : undefined
    const blockTrackingEm =
      block.type === 'heading' && isChapterIntro ? (block.trackingEm ?? 0) : 0

    const headingMultiplier =
      block.type === 'heading' && (isChapterBanner || isChapterOrnament)
        ? (block.sizeMultiplier ?? (isChapterBanner ? 2.5 : 1.4))
        : null

    const fontSizePt =
      block.type === 'heading'
        ? headingMultiplier != null
          ? print.fontSizePt * headingMultiplier
          : isSceneBreak
            ? print.fontSizePt * 1.08
            : block.level === 1
              ? print.fontSizePt * 1.55
              : block.level === 2
                ? print.fontSizePt * 1.3
                : print.fontSizePt * 1.15
        : print.fontSizePt

    const blockLineHeightPt =
      isChapterBanner
        ? fontSizePt * 1.18
        : isChapterOrnament
          ? fontSizePt * 1.25
          : isSceneBreak
            ? fontSizePt * 1.35
            : fontSizePt * print.lineHeight
    const lines = wrapText(block.text, box.contentWidthPt, fontSizePt, blockFont, {
      hyphenate: !isChapterIntro && !isSceneBreak && print.hyphenation,
      hypher: isChapterIntro || isSceneBreak ? null : hypher,
      trackingEm: blockTrackingEm || undefined,
    })

    const yStartPt =
      box.heightPt -
      box.topPt -
      (page.lines.length === 0 ? 0 : blockLineHeightPt * 0.4) -
      page.lines.reduce((acc, l) => Math.max(acc, box.heightPt - l.yPt), 0)

    const prevLine = page.lines.length ? page.lines[page.lines.length - 1]! : null
    let cursorYPt: number
    if (page.lines.length === 0) {
      cursorYPt = box.heightPt - box.topPt
    } else if (isChapterOrnament && prevBlockChapterIntro && prevLine != null) {
      // The ornament's own (small) line-height is too tight to clear the title's
      // descenders; drop a body-leading instead so the glyph sits cleanly below
      // the title rather than tucked under it. Proportional to body line height
      // so the gap stays consistent across themes.
      const ornamentLeadPt = print.fontSizePt * print.lineHeight * 1.6
      const drop = Math.max(blockLineHeightPt, ornamentLeadPt)
      cursorYPt = prevLine.yPt - drop
    } else {
      cursorYPt = prevLine!.yPt - blockLineHeightPt
    }

    // After the chapter banner / ornament block, drop ~2 body line-heights of breathing
    // room before the first paragraph. Combined with the natural blockLineHeightPt drop
    // above, this gives ~3 body lines of empty space between the title baseline and the
    // first body baseline, matching mainstream print interiors (e.g. Atticus). Tied to
    // `print.lineHeight` so the gap stays proportional when the user changes line
    // spacing in the print theme. Skipped when the current block is the chapter ornament
    // itself (we want the ornament tucked tight under the title).
    const shouldGapAfterBanner =
      prevBlockChapterIntro && !isChapterIntro && prevLine != null && prevLine.kind === 'body'
    const gapAfterBanner = shouldGapAfterBanner ? print.fontSizePt * print.lineHeight * 2 : 0
    cursorYPt -= gapAfterBanner

    if (isChapterBanner && page.lines.length === 0) {
      cursorYPt -= print.fontSizePt * 1.1
    }

    if (block.type === 'heading' && !isChapterIntro && page.lines.length > 0)
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
      const lineWidth = widthWithTracking(line, fontSizePt, blockFont, blockTrackingEm || undefined)
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
        ...(blockFontId ? { fontId: blockFontId } : {}),
        ...(blockTrackingEm ? { trackingEm: blockTrackingEm } : {}),
      })
      cursorYPt -= blockLineHeightPt
    }

    prevBlockChapterIntro = isChapterIntro
  }

  if (pages.length === 0) {
    startNewPage(false)
  }

  const lastBeforeHeaderFooter = pages[pages.length - 1]!
  const nextPageNumber =
    pages.length > 0 && lastBeforeHeaderFooter.lines.length > 0 ? pageNumber + 1 : pageNumber

  applyPrintHeadersFooters(pages, print, bodyFont, ctx, chapterTitleById, chapter.id, boxOpts)

  return {
    chapterId: chapter.id,
    chapterIndex,
    pages,
    nextPageNumber,
  }
}

export async function paginateSpineWithFont(
  spine: Manuscript[],
  theme: Theme,
  fontOrPair: FontMeasurer | PrintFontPair,
  ctx?: PrintLayoutContext,
): Promise<PrintPage[]> {
  const print = theme.print
  const fonts: PrintFontPair = isFontPair(fontOrPair)
    ? fontOrPair
    : { body: fontOrPair, title: fontOrPair }
  const headerReservePt = print.header.enabled ? print.header.fontSizePt * 1.8 : 0
  const footerReservePt = print.footer.enabled ? print.footer.fontSizePt * 1.8 : 0
  const boxOpts = { headerReservePt, footerReservePt }

  const pages: PrintPage[] = []
  let nextStart = 1
  let bodyOrd = 0

  for (let i = 0; i < spine.length; i++) {
    const ch = spine[i]!
    const layout = layoutProfileForManuscript(ch)
    if (layout === 'chapter') bodyOrd += 1
    const ordinal = layout === 'chapter' ? bodyOrd : Math.max(1, bodyOrd)
    const res = await paginateChapterWithFont(ch, i, theme, fonts, nextStart, ctx, layout, ordinal)
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
      fonts.body,
      ctx,
      new Map<number, string>(),
      0,
      boxOpts,
    )
  }

  return pages
}

export async function paginateWithFont(
  chapters: Manuscript[],
  theme: Theme,
  fontOrPair: FontMeasurer | PrintFontPair,
  ctx?: PrintLayoutContext,
): Promise<PrintPage[]> {
  return paginateSpineWithFont(chapters, theme, fontOrPair, ctx)
}

/** Full book for KDP PDF: optional printable TOC with page numbers (iterative layout). */
export async function paginateProjectForPrintExport(
  project: InkwellProject,
  fontOrPair: FontMeasurer | PrintFontPair,
  ctx?: PrintLayoutContext,
): Promise<PrintPage[]> {
  const theme = project.theme
  const fonts: PrintFontPair = isFontPair(fontOrPair)
    ? fontOrPair
    : { body: fontOrPair, title: fontOrPair }
  const spine = stripSyntheticToc(manuscriptsForPrint(project))
  if (!project.assembly.includePrintToc) {
    return paginateSpineWithFont(spine, theme, fonts, ctx)
  }

  const cw = printContentWidthPt(theme.print)
  const fs = theme.print.fontSizePt
  let tocMs: Manuscript | null = null

  for (let iter = 0; iter < 12; iter++) {
    const withToc =
      tocMs != null ? insertPrintTocInSpine(project, spine, tocMs) : spine
    const pages = await paginateSpineWithFont(withToc, theme, fonts, ctx)
    const starts = firstPageByChapterId(pages, withToc)
    // TOC entries are body-text rows, so measure them with the body font.
    const nextToc = buildPrintTocManuscript(project, starts, cw, fonts.body, fs)
    const prevSig = tocMs ? JSON.stringify(tocMs.content) : ''
    const nextSig = JSON.stringify(nextToc.content)
    if (prevSig === nextSig) return pages
    tocMs = nextToc
  }
  const finalSpine = tocMs != null ? insertPrintTocInSpine(project, spine, tocMs) : spine
  return paginateSpineWithFont(finalSpine, theme, fonts, ctx)
}

