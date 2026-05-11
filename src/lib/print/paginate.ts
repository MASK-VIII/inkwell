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
  printContentWidthPt,
  printSpineBaseForExport,
} from '../bookAssembly'
import { extractPrintBlocks, type PrintBlock, type PrintTextRun } from './extractBlocks'
import { breakOptionalLigaturesForPrint } from './normalizePrintText'
import { figureDisplayPts } from './imageDims'
import { getEnglishHypher } from './hyphen'
import { getPrintFontPairForMeasurement } from './fonts'

/**
 * Yield so the browser can paint and handle input between CPU-heavy pagination chunks.
 * Workers have no main-thread UI to unblock — skipping the timer avoids adding tens of
 * milliseconds per chapter/TOC iteration during `resolvePrintSpine` and PDF layout.
 */
export async function yieldToMain(): Promise<void> {
  if (typeof document === 'undefined') return
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

/** Inline bold/italic segment on one visual line (PDF draws each at base xPt + xOffsetPt). */
export type PrintLineTextRun = {
  text: string
  xOffsetPt: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
}

export type PrintLine = {
  text: string
  xPt: number
  yPt: number
  fontSizePt: number
  chapterId: number
  kind: 'body' | 'header' | 'footer' | 'figure'
  /**
   * Optional font id used to draw this line in PDF/HTML output. When unset, renderers fall back
   * to the body font. Set on chapter banner / ornament lines so the title font is rendered.
   */
  fontId?: InkwellFontId
  /** Letter-spacing in em (chapter banner / ornament lines). */
  trackingEm?: number
  /** Additional left offset for hanging list lines (pt). */
  extraLeftPt?: number
  /** When set, PDF/preview draw segments with body bold/italic variants; `text` stays full-line plain. */
  textRuns?: PrintLineTextRun[]
  /** Raster figure (usually a data URL); PDF preview embeds when possible. */
  figureSrc?: string
  figureWidthPt?: number
  figureHeightPt?: number
}

/**
 * Print pipeline carries two `FontMeasurer` slots so chapter banners can use a
 * different display font from the body. When the user picks `inherit` for the
 * chapter title style, both slots resolve to the same font instance.
 */
export type PrintFontPair = {
  body: FontMeasurer
  title: FontMeasurer
  bodyBold?: FontMeasurer
  bodyItalic?: FontMeasurer
  bodyBoldItalic?: FontMeasurer
  /** See `PrintFontEmbeddingSet.bodyBoldIsSynthetic` in fonts.ts */
  bodyBoldIsSynthetic?: boolean
  /** See `PrintFontEmbeddingSet.bodyItalicIsSynthetic` in fonts.ts */
  bodyItalicIsSynthetic?: boolean
}

/** Layout width multiplier so pagination matches faux-bold PDF strokes when no bold font file exists. */
const FAUX_BOLD_LAYOUT_WIDTH_FACTOR = 1.06
/** Layout width multiplier for faux-italic (skew) when no italic font file exists. */
const FAUX_ITALIC_LAYOUT_WIDTH_FACTOR = 1.04

function isFontPair(x: FontMeasurer | PrintFontPair): x is PrintFontPair {
  return (
    typeof x === 'object' &&
    x !== null &&
    'body' in x &&
    'title' in x &&
    typeof (x as PrintFontPair).body === 'object' &&
    typeof (x as PrintFontPair).title === 'object'
  )
}

export function resolveBodyFontMeasure(fonts: PrintFontPair, bold?: boolean, italic?: boolean): FontMeasurer {
  if (bold && italic) {
    if (fonts.bodyBoldItalic) return fonts.bodyBoldItalic
    if (fonts.bodyBold) return fonts.bodyBold
    if (fonts.bodyItalic) return fonts.bodyItalic
    return fonts.body
  }
  if (bold) return fonts.bodyBold ?? fonts.body
  if (italic) return fonts.bodyItalic ?? fonts.body
  return fonts.body
}

/** Same as `resolveBodyFontMeasure`, but widens bold segments when the body font has no real bold file. */
function resolveBodyFontMeasureForWidth(fonts: PrintFontPair, bold?: boolean, italic?: boolean): FontMeasurer {
  const base = resolveBodyFontMeasure(fonts, bold, italic)
  let mult = 1
  if (bold && fonts.bodyBoldIsSynthetic) mult *= FAUX_BOLD_LAYOUT_WIDTH_FACTOR
  if (italic && fonts.bodyItalicIsSynthetic) mult *= FAUX_ITALIC_LAYOUT_WIDTH_FACTOR
  if (mult === 1) return base
  return {
    widthOfTextAtSize: (text: string, size: number) => base.widthOfTextAtSize(text, size) * mult,
  }
}

export type PrintPage = {
  pageNumber: number
  widthPt: number
  heightPt: number
  lines: PrintLine[]
  isBlank: boolean
}

/** Resolve owning manuscript id for grouping full-spine pagination into per-chapter previews. */
function previewPageOwnerChapterId(p: PrintPage): number | null {
  const body = p.lines.find((l) => l.kind === 'body' || l.kind === 'figure')
  if (body) return body.chapterId
  const hf = p.lines.find((l) => l.kind === 'header' || l.kind === 'footer')
  if (hf) return hf.chapterId
  return null
}

/**
 * Split `paginateSpineWithFont` output into chapter buckets (matches sequential chapter pagination,
 * including blanks before the next section's body).
 */
export function groupPrintPreviewPagesByChapter(spine: Manuscript[], pages: PrintPage[]): Map<number, PrintPage[]> {
  const map = new Map<number, PrintPage[]>()
  for (const m of spine) map.set(m.id, [])
  const pending: PrintPage[] = []
  const flush = (cid: number) => {
    const arr = map.get(cid)
    if (!arr) return
    arr.push(...pending)
    pending.length = 0
  }
  for (const p of pages) {
    const cid = previewPageOwnerChapterId(p)
    if (cid != null) {
      flush(cid)
      map.get(cid)!.push(p)
    } else {
      pending.push(p)
    }
  }
  const lastId = spine[spine.length - 1]?.id
  if (pending.length > 0 && lastId != null) flush(lastId)
  return map
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
  const t = breakOptionalLigaturesForPrint(text)
  try {
    return font.widthOfTextAtSize(t, size)
  } catch {
    // Fall back only if the font can't encode a character.
    return font.widthOfTextAtSize(toWinAnsiFallback(t), size)
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

/** Grapheme-safe splitting avoids splitting surrogate pairs; binary breaks preserve shaping context vs char-at-a-time. */
function graphemeSegments(s: string): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      return Array.from(seg.segment(s), (x) => x.segment)
    }
  } catch {
    /* ignore */
  }
  return [...s]
}

function hardBreakLongWord(word: string, maxWidthPt: number, fontSizePt: number, font: FontMeasurer): string[] {
  const lines: string[] = []
  let rest = word
  while (rest.length > 0) {
    const segs = graphemeSegments(rest)
    if (segs.length === 0) break
    let lo = 1
    let hi = segs.length
    let best = 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const slice = segs.slice(0, mid).join('')
      if (safeWidthOfTextAtSize(slice, fontSizePt, font) <= maxWidthPt) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    const take = Math.max(1, best)
    const line = segs.slice(0, take).join('')
    lines.push(line)
    rest = segs.slice(take).join('')
  }
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

function mergePrintRuns(runs: PrintTextRun[]): PrintTextRun[] {
  const out: PrintTextRun[] = []
  for (const r of runs) {
    if (!r.text) continue
    const prev = out[out.length - 1]
    if (
      prev &&
      prev.bold === r.bold &&
      prev.italic === r.italic &&
      prev.underline === r.underline &&
      prev.strike === r.strike
    ) {
      prev.text += r.text
    } else out.push({ ...r })
  }
  return out
}

/** Word fragment or literal whitespace from the manuscript (preserves adjacency across styles). */
type LinePiece =
  | { kind: 'w'; text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }
  | { kind: 'sp'; text: string }

function linePiecesFromRuns(runs: PrintTextRun[]): LinePiece[] {
  const out: LinePiece[] = []
  for (const r of mergePrintRuns(runs)) {
    const parts = r.text.split(/(\s+)/)
    for (const p of parts) {
      if (!p) continue
      if (/^\s+$/.test(p)) out.push({ kind: 'sp', text: p })
      else
        out.push({
          kind: 'w',
          text: p,
          bold: r.bold,
          italic: r.italic,
          underline: r.underline,
          strike: r.strike,
        })
    }
  }
  return out
}

function widthOfLinePieces(
  pieces: LinePiece[],
  fontSizePt: number,
  fonts: PrintFontPair,
  trackingEm?: number,
): number {
  let sum = 0
  for (const pc of pieces) {
    if (pc.kind === 'sp') {
      sum += safeWidthOfTextAtSize(pc.text, fontSizePt, fonts.body)
    } else {
      const f = resolveBodyFontMeasureForWidth(fonts, pc.bold, pc.italic)
      sum += widthWithTracking(pc.text, fontSizePt, f, trackingEm)
    }
  }
  return sum
}

function trimEdgeSpacePieces(pieces: LinePiece[]): LinePiece[] {
  let a = 0
  let b = pieces.length
  while (a < b && pieces[a]!.kind === 'sp') a++
  while (b > a && pieces[b - 1]!.kind === 'sp') b--
  return pieces.slice(a, b)
}

function buildLineTextRunsFromPieces(pieces: LinePiece[], fontSizePt: number, fonts: PrintFontPair): PrintLineTextRun[] {
  const out: PrintLineTextRun[] = []
  let x = 0
  for (const pc of pieces) {
    if (pc.kind === 'sp') {
      out.push({ text: pc.text, xOffsetPt: x })
      x += safeWidthOfTextAtSize(pc.text, fontSizePt, fonts.body)
    } else {
      const f = resolveBodyFontMeasureForWidth(fonts, pc.bold, pc.italic)
      out.push({
        text: pc.text,
        xOffsetPt: x,
        bold: pc.bold,
        italic: pc.italic,
        underline: pc.underline,
        strike: pc.strike,
      })
      x += safeWidthOfTextAtSize(pc.text, fontSizePt, f)
    }
  }
  return out
}

function plainFromPieces(pieces: LinePiece[]): string {
  return pieces.map((pc) => pc.text).join('')
}

function wordPiece(
  text: string,
  bold?: boolean,
  italic?: boolean,
  underline?: boolean,
  strike?: boolean,
): LinePiece {
  return { kind: 'w', text, bold, italic, underline, strike }
}

function wrapStyledLinePieces(
  pieces: LinePiece[],
  maxWidthPt: number,
  fontSizePt: number,
  fonts: PrintFontPair,
  opts?: { hyphenate?: boolean; hypher?: HypherLike | null; trackingEm?: number },
): Array<{ text: string; extraLeftPt: number; textRuns: PrintLineTextRun[] }> {
  if (pieces.length === 0) return [{ text: '', extraLeftPt: 0, textRuns: [] }]

  const hyphenateOn = Boolean(opts?.hyphenate && opts?.hypher)
  const hypher = opts?.hypher ?? null
  const trackingEm = opts?.trackingEm

  const lines: Array<{ text: string; extraLeftPt: number; textRuns: PrintLineTextRun[] }> = []
  let current: LinePiece[] = []

  const flushLine = (raw: LinePiece[]) => {
    const trimmed = trimEdgeSpacePieces(raw)
    if (trimmed.length === 0) return
    lines.push({
      text: plainFromPieces(trimmed),
      extraLeftPt: 0,
      textRuns: buildLineTextRunsFromPieces(trimmed, fontSizePt, fonts),
    })
  }

  let pi = 0
  while (pi < pieces.length) {
    const pc = pieces[pi]!
    if (pc.kind === 'sp') {
      if (current.length === 0) {
        pi++
        continue
      }
      const trial = [...current, pc]
      if (widthOfLinePieces(trial, fontSizePt, fonts, trackingEm) <= maxWidthPt) {
        current = trial
        pi++
        continue
      }
      flushLine(current)
      current = []
      pi++
      continue
    }

    const w = pc
    const chunks = hyphenationChunks(w.text, hyphenateOn, hypher)
    const whole = chunks.join('')
    const wordAsPiece = wordPiece(whole, w.bold, w.italic, w.underline, w.strike)
    const cand = [...current, wordAsPiece]
    if (widthOfLinePieces(cand, fontSizePt, fonts, trackingEm) <= maxWidthPt) {
      current = cand
      pi++
      continue
    }

    if (current.length > 0) {
      flushLine(current)
      current = []
    }

    if (chunks.length === 1) {
      const single = wordPiece(whole, w.bold, w.italic, w.underline, w.strike)
      if (widthOfLinePieces([single], fontSizePt, fonts, trackingEm) <= maxWidthPt) {
        current = [single]
        pi++
        continue
      }
      const fw = resolveBodyFontMeasureForWidth(fonts, w.bold, w.italic)
      const broken = hardBreakLongWord(whole, maxWidthPt, fontSizePt, fw)
      for (let bi = 0; bi < broken.length; bi++) {
        const part = broken[bi]!
        const piece = wordPiece(part, w.bold, w.italic, w.underline, w.strike)
        if (bi < broken.length - 1) {
          flushLine([piece])
        } else {
          current = [piece]
        }
      }
      pi++
      continue
    }

    let ci = 0
    while (ci < chunks.length) {
      let bestJ = ci - 1
      let testAccum = ''
      for (let j = ci; j < chunks.length; j++) {
        testAccum += chunks[j]!
        const hyphenAfter = j < chunks.length - 1
        const pieceText = hyphenAfter ? `${testAccum}-` : testAccum
        const trial = [...current, wordPiece(pieceText, w.bold, w.italic, w.underline, w.strike)]
        if (widthOfLinePieces(trial, fontSizePt, fonts, trackingEm) <= maxWidthPt) bestJ = j
        else break
      }

      if (bestJ >= ci) {
        const merged = chunks.slice(ci, bestJ + 1).join('')
        const hyphenAfter = bestJ < chunks.length - 1
        const pieceText = hyphenAfter ? `${merged}-` : merged
        current = [...current, wordPiece(pieceText, w.bold, w.italic, w.underline, w.strike)]
        ci = bestJ + 1
        if (hyphenAfter) {
          flushLine(current)
          current = []
        }
        continue
      }

      if (current.length > 0) {
        flushLine(current)
        current = []
        continue
      }

      const rest = chunks.slice(ci).join('')
      const fw = resolveBodyFontMeasureForWidth(fonts, w.bold, w.italic)
      const broken = hardBreakLongWord(rest, maxWidthPt, fontSizePt, fw)
      for (let bi = 0; bi < broken.length; bi++) {
        const part = broken[bi]!
        const piece = wordPiece(part, w.bold, w.italic, w.underline, w.strike)
        if (bi < broken.length - 1) flushLine([piece])
        else current = [piece]
      }
      break
    }
    pi++
  }

  if (current.length > 0) flushLine(current)
  return lines
}

function wrapStyledWords(
  runs: PrintTextRun[],
  maxWidthPt: number,
  fontSizePt: number,
  fonts: PrintFontPair,
  opts?: { hyphenate?: boolean; hypher?: HypherLike | null; trackingEm?: number },
): Array<{ text: string; extraLeftPt: number; textRuns: PrintLineTextRun[] }> {
  return wrapStyledLinePieces(linePiecesFromRuns(runs), maxWidthPt, fontSizePt, fonts, opts)
}

function wrapHangParagraphRuns(
  prefix: string,
  runs: PrintTextRun[],
  maxWidthPt: number,
  fontSizePt: number,
  fonts: PrintFontPair,
  opts?: { hyphenate?: boolean; hypher?: HypherLike | null; trackingEm?: number },
): Array<{ text: string; extraLeftPt: number; textRuns: PrintLineTextRun[] }> {
  const pieces = linePiecesFromRuns(runs)
  if (!prefix) return wrapStyledLinePieces(pieces, maxWidthPt, fontSizePt, fonts, opts)

  const gap = fontSizePt * 0.35
  const hang = safeWidthOfTextAtSize(prefix, fontSizePt, fonts.body) + gap
  const firstInnerW = Math.max(40, maxWidthPt - hang)
  const restInnerW = Math.max(40, maxWidthPt - hang)

  let i = 0
  let firstInner: LinePiece[] = []
  while (i < pieces.length) {
    const next = pieces[i]!
    const trial = [...firstInner, next]
    if (widthOfLinePieces(trial, fontSizePt, fonts, opts?.trackingEm) <= firstInnerW) {
      firstInner = trial
      i++
    } else break
  }

  if (firstInner.length === 0 && i < pieces.length && pieces[i]!.kind === 'w') {
    const w0 = pieces[i] as Extract<LinePiece, { kind: 'w' }>
    const fw = resolveBodyFontMeasureForWidth(fonts, w0.bold, w0.italic)
    const broken = hardBreakLongWord(w0.text, firstInnerW, fontSizePt, fw)
    firstInner = [wordPiece(broken[0]!, w0.bold, w0.italic, w0.underline, w0.strike)]
    const restJoin = broken.slice(1).join('')
    if (restJoin) pieces[i] = wordPiece(restJoin, w0.bold, w0.italic, w0.underline, w0.strike)
    else i++
  }

  const prefixW = safeWidthOfTextAtSize(prefix, fontSizePt, fonts.body)
  const innerOffset = prefixW + gap
  const innerRuns = buildLineTextRunsFromPieces(trimEdgeSpacePieces(firstInner), fontSizePt, fonts).map((r) => ({
    ...r,
    xOffsetPt: r.xOffsetPt + innerOffset,
  }))
  const firstTextRuns: PrintLineTextRun[] = [{ text: prefix, xOffsetPt: 0 }, ...innerRuns]
  const firstPlain = `${prefix}${plainFromPieces(trimEdgeSpacePieces(firstInner))}`

  const lines: Array<{ text: string; extraLeftPt: number; textRuns: PrintLineTextRun[] }> = [
    { text: firstPlain, extraLeftPt: 0, textRuns: firstTextRuns },
  ]

  const remainder = pieces.slice(i)
  if (trimEdgeSpacePieces(remainder).length === 0) return lines

  const tailLines = wrapStyledLinePieces(remainder, restInnerW, fontSizePt, fonts, opts)
  for (const tl of tailLines) {
    lines.push({
      text: tl.text,
      extraLeftPt: hang,
      textRuns: tl.textRuns,
    })
  }
  return lines
}

function paragraphRuns(block: Extract<PrintBlock, { type: 'paragraph' }>): PrintTextRun[] {
  return block.runs && block.runs.length > 0 ? block.runs : [{ text: block.text }]
}

function blockHasStyledRuns(block: { runs?: PrintTextRun[] }): boolean {
  return Boolean(block.runs?.some((r) => r.bold || r.italic || r.underline || r.strike))
}

function bodyStartsWithChapterHeading(bodyBlocks: PrintBlock[], chapterTitle: string): boolean {
  const t = normalizeSpaces(chapterTitle).toLowerCase()
  if (!t) return false
  for (const b of bodyBlocks) {
    if (b.type === 'pageBreak' || b.type === 'figure') continue
    if (b.type === 'heading' && b.level === 1 && normalizeSpaces(b.text).toLowerCase() === t) return true
    return false
  }
  return false
}

const BLOCKQUOTE_INDENT_PT = 28

/** First line includes prefix; continuation lines use hanging indent via extraLeftPt in layout. */
function wrapHangParagraph(
  prefix: string,
  body: string,
  maxWidthPt: number,
  fontSizePt: number,
  font: FontMeasurer,
  opts?: { hyphenate?: boolean; hypher?: HypherLike | null },
): Array<{ text: string; extraLeftPt: number }> {
  const t = normalizeSpaces(body)
  if (!prefix) {
    return wrapText(t, maxWidthPt, fontSizePt, font, opts).map((line) => ({
      text: line,
      extraLeftPt: 0,
    }))
  }

  const gap = fontSizePt * 0.35
  const hang = safeWidthOfTextAtSize(prefix, fontSizePt, font) + gap
  const firstInnerW = Math.max(40, maxWidthPt - hang)
  const restInnerW = Math.max(40, maxWidthPt - hang)

  const words = t.length ? t.split(' ') : ['']
  let i = 0
  let firstInner = ''
  while (i < words.length) {
    const w = words[i]!
    const trial = firstInner ? `${firstInner} ${w}` : w
    if (safeWidthOfTextAtSize(trial, fontSizePt, font) <= firstInnerW) {
      firstInner = trial
      i++
    } else break
  }
  if (!firstInner && i < words.length) {
    const broken = hardBreakLongWord(words[i]!, firstInnerW, fontSizePt, font)
    firstInner = broken[0]!
    const rest = broken.slice(1).join('')
    if (rest) words[i] = rest
    else i++
  }

  const lines: Array<{ text: string; extraLeftPt: number }> = []
  lines.push({ text: `${prefix}${firstInner}`, extraLeftPt: 0 })

  const remainder = words.slice(i).join(' ')
  if (!remainder.trim()) return lines

  const tailLines = wrapText(remainder.trim(), restInnerW, fontSizePt, font, opts)
  for (const tl of tailLines) {
    lines.push({ text: tl, extraLeftPt: hang })
  }
  return lines
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
  const {
    body,
    title,
    bodyBold,
    bodyItalic,
    bodyBoldItalic,
    bodyBoldIsSynthetic,
    bodyItalicIsSynthetic,
  } = await getPrintFontPairForMeasurement(theme.print.bodyFontId, titleFontId)
  return paginateWithFont(
    chapters,
    theme,
    {
      body,
      title,
      bodyBold,
      bodyItalic,
      bodyBoldItalic,
      bodyBoldIsSynthetic,
      bodyItalicIsSynthetic,
    },
    ctx,
  )
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
    const bodyChapterId =
      p.lines.find((l) => l.kind === 'body' || l.kind === 'figure')?.chapterId ?? null
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

function lineVisualWidth(
  line: { text: string; textRuns?: PrintLineTextRun[] },
  fontSizePt: number,
  measureFont: FontMeasurer,
  fonts: PrintFontPair,
  trackingEm?: number,
): number {
  if (!line.textRuns?.length) {
    return widthWithTracking(line.text, fontSizePt, measureFont, trackingEm)
  }
  let sum = 0
  for (const tr of line.textRuns) {
    const f =
      tr.bold || tr.italic ? resolveBodyFontMeasureForWidth(fonts, tr.bold, tr.italic) : measureFont
    sum += widthWithTracking(tr.text, fontSizePt, f, trackingEm)
  }
  return sum
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
  for (let bi = 0; bi < blocksToLayout.length; bi++) {
    if (bi > 0 && bi % 32 === 0) await yieldToMain()
    const block = blocksToLayout[bi]!
    if (block.type === 'pageBreak') {
      nextPage(false)
      prevBlockChapterIntro = false
      continue
    }

    const box = contentBoxForPage(print, pageNumber, boxOpts)
    ensurePage()
    const page = pages[pages.length - 1]!

    if (block.type === 'figure') {
      const dims = figureDisplayPts(block.src, Math.max(40, box.contentWidthPt))
      const figW = dims.widthPt
      const figH = dims.heightPt
      const vGap = print.fontSizePt * print.lineHeight * 0.5
      const prevLineFig = page.lines.length ? page.lines[page.lines.length - 1]! : null
      let topFig: number
      if (!prevLineFig) {
        topFig = box.heightPt - box.topPt - figH
      } else if (prevLineFig.kind === 'figure') {
        topFig = prevLineFig.yPt - vGap - figH
      } else {
        topFig = prevLineFig.yPt - print.fontSizePt * print.lineHeight * 0.85 - figH
      }
      let bottomFig = topFig - figH
      if (bottomFig < box.bottomPt) {
        nextPage(false)
        const nb = contentBoxForPage(print, pageNumber, boxOpts)
        topFig = nb.heightPt - nb.topPt - figH
        bottomFig = topFig - figH
      }
      const boxNow = contentBoxForPage(print, pageNumber, boxOpts)
      const pageNow = pages[pages.length - 1]!
      const xFig = boxNow.leftPt + Math.max(0, (boxNow.contentWidthPt - figW) / 2)
      pageNow.lines.push({
        text: block.alt,
        xPt: xFig,
        yPt: bottomFig,
        fontSizePt: print.fontSizePt,
        chapterId: run.chapterId,
        kind: 'figure',
        figureSrc: block.src ?? '',
        figureWidthPt: figW,
        figureHeightPt: figH,
      })
      prevBlockChapterIntro = false
      continue
    }

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

    const quotePad = block.type === 'paragraph' && block.blockquote ? BLOCKQUOTE_INDENT_PT : 0
    const listInd = block.type === 'paragraph' ? (block.listIndentPt ?? 0) : 0
    const innerWidth = Math.max(36, box.contentWidthPt - quotePad - listInd)

    const hyphenOpts =
      block.type === 'heading' ?
        {
          hyphenate: !isChapterIntro && !isSceneBreak && print.hyphenation,
          hypher: isChapterIntro || isSceneBreak ? null : hypher,
          trackingEm: blockTrackingEm || undefined,
        }
      : {
          hyphenate: print.hyphenation,
          hypher,
          trackingEm: undefined as number | undefined,
        }

    let wrappedLines: Array<{ text: string; extraLeftPt?: number; textRuns?: PrintLineTextRun[] }>
    if (block.type === 'paragraph') {
      if (block.listPrefix) {
        wrappedLines =
          blockHasStyledRuns(block) ?
            wrapHangParagraphRuns(block.listPrefix, paragraphRuns(block), innerWidth, fontSizePt, fonts, hyphenOpts)
          : wrapHangParagraph(block.listPrefix, block.text, innerWidth, fontSizePt, bodyFont, hyphenOpts)
      } else if (blockHasStyledRuns(block)) {
        wrappedLines = wrapStyledWords(paragraphRuns(block), innerWidth, fontSizePt, fonts, hyphenOpts)
      } else {
        wrappedLines = wrapText(block.text, innerWidth, fontSizePt, bodyFont, hyphenOpts).map((t) => ({
          text: t,
          extraLeftPt: 0,
        }))
      }
    } else if (
      block.type === 'heading' &&
      isChapterIntro &&
      blockHasStyledRuns(block) &&
      block.runs?.length
    ) {
      wrappedLines = wrapStyledWords(block.runs, box.contentWidthPt, fontSizePt, fonts, hyphenOpts)
    } else if (!isChapterIntro && blockHasStyledRuns(block) && block.runs?.length) {
      wrappedLines = wrapStyledWords(block.runs, box.contentWidthPt, fontSizePt, fonts, hyphenOpts)
    } else {
      wrappedLines = wrapText(block.text, box.contentWidthPt, fontSizePt, blockFont, hyphenOpts).map((t) => ({
        text: t,
        extraLeftPt: 0,
      }))
    }

    const prevLine = page.lines.length ? page.lines[page.lines.length - 1]! : null
    let cursorYPt: number
    if (page.lines.length === 0) {
      cursorYPt = box.heightPt - box.topPt
    } else if (isChapterOrnament && prevBlockChapterIntro && prevLine != null) {
      const ornamentLeadPt = print.fontSizePt * print.lineHeight * 1.6
      const drop = Math.max(blockLineHeightPt, ornamentLeadPt)
      cursorYPt = prevLine.yPt - drop
    } else {
      cursorYPt = prevLine!.yPt - blockLineHeightPt
    }

    const shouldGapAfterBanner =
      prevBlockChapterIntro && !isChapterIntro && prevLine != null && prevLine.kind === 'body'
    const gapAfterBanner = shouldGapAfterBanner ? print.fontSizePt * print.lineHeight * 2 : 0
    cursorYPt -= gapAfterBanner

    if (isChapterBanner && page.lines.length === 0) {
      cursorYPt -= print.fontSizePt * 1.1
    }

    if (block.type === 'heading' && !isChapterIntro && page.lines.length > 0)
      cursorYPt -= blockLineHeightPt * 0.25

    if (
      block.type === 'heading' &&
      !isChapterIntro &&
      print.avoidLonelyHeading !== false &&
      wrappedLines.length > 0
    ) {
      const boxLive = contentBoxForPage(print, pageNumber, boxOpts)
      const fitBefore = Math.max(0, Math.floor((cursorYPt - boxLive.bottomPt) / blockLineHeightPt))
      if (fitBefore <= 1) {
        nextPage(false)
        const nb = contentBoxForPage(print, pageNumber, boxOpts)
        cursorYPt = nb.heightPt - nb.topPt
      }
    }

    let shortParagraphSplitAdvances = 0
    for (let li = 0; li < wrappedLines.length; li++) {
      const line = wrappedLines[li]!
      const remainingAfter = wrappedLines.length - li - 1
      const boxLive = contentBoxForPage(print, pageNumber, boxOpts)
      const linesFit = Math.max(0, Math.floor((cursorYPt - boxLive.bottomPt) / blockLineHeightPt))

      if (
        print.avoidShortParagraphSplit !== false &&
        block.type === 'paragraph' &&
        wrappedLines.length >= 2 &&
        remainingAfter >= 1 &&
        linesFit === 1 &&
        shortParagraphSplitAdvances < 32
      ) {
        shortParagraphSplitAdvances++
        nextPage(false)
        const nb = contentBoxForPage(print, pageNumber, boxOpts)
        cursorYPt = nb.heightPt - nb.topPt
        li -= 1
        continue
      }

      const minYPt = boxLive.bottomPt + blockLineHeightPt
      if (cursorYPt <= minYPt) {
        nextPage(false)
        const nextBox = contentBoxForPage(print, pageNumber, boxOpts)
        cursorYPt = nextBox.heightPt - nextBox.topPt
      }

      const boxNow = contentBoxForPage(print, pageNumber, boxOpts)
      const baseLeftNow = boxNow.leftPt + quotePad + listInd
      const lineWidth = lineVisualWidth(
        line,
        fontSizePt,
        blockFont,
        fonts,
        blockTrackingEm || undefined,
      )
      const hang = line.extraLeftPt ?? 0
      const xHeading = boxNow.leftPt + Math.max(0, (boxNow.contentWidthPt - lineWidth) / 2)
      const xPara = baseLeftNow + hang
      const pageNow = pages[pages.length - 1]!
      pageNow.lines.push({
        text: line.text,
        xPt: block.type === 'heading' ? xHeading : xPara,
        yPt: cursorYPt,
        fontSizePt,
        chapterId: run.chapterId,
        kind: 'body',
        ...(blockFontId ? { fontId: blockFontId } : {}),
        ...(blockTrackingEm ? { trackingEm: blockTrackingEm } : {}),
        ...(line.textRuns?.length ? { textRuns: line.textRuns } : {}),
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

export type PaginateSpineWithFontOptions = {
  /** Fires after each manuscript in `spine` is paginated (used for progressive print preview). */
  onChapterComplete?: (info: {
    chapterIndex: number
    chapterId: number
    spine: Manuscript[]
    pagesSoFar: PrintPage[]
  }) => void | Promise<void>
}

export async function paginateSpineWithFont(
  spine: Manuscript[],
  theme: Theme,
  fontOrPair: FontMeasurer | PrintFontPair,
  ctx?: PrintLayoutContext,
  opts?: PaginateSpineWithFontOptions,
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
    if (i > 0) await yieldToMain()
    const ch = spine[i]!
    const layout = layoutProfileForManuscript(ch)
    if (layout === 'chapter') bodyOrd += 1
    const ordinal = layout === 'chapter' ? bodyOrd : Math.max(1, bodyOrd)
    const res = await paginateChapterWithFont(ch, i, theme, fonts, nextStart, ctx, layout, ordinal)
    pages.push(...res.pages)
    nextStart = res.nextPageNumber
    await opts?.onChapterComplete?.({
      chapterIndex: i,
      chapterId: ch.id,
      spine,
      pagesSoFar: pages.slice(),
    })
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

/** Drop one trailing leaf only when marked blank and carrying no body/figure lines (mid-spread blanks unchanged). */
export function trimTrailingBlankPrintPage(pages: PrintPage[]): PrintPage[] {
  if (pages.length === 0) return pages
  const last = pages[pages.length - 1]!
  if (!last.isBlank) return pages
  const hasBody = last.lines.some((l) => l.kind === 'body' || l.kind === 'figure')
  if (hasBody) return pages
  return pages.slice(0, -1)
}

async function paginatePrintExportInner(
  project: InkwellProject,
  fonts: PrintFontPair,
  ctx?: PrintLayoutContext,
): Promise<{ pages: PrintPage[]; finalSpine: Manuscript[] }> {
  const theme = project.theme
  const spine = printSpineBaseForExport(project)
  if (!project.assembly.includePrintToc) {
    const pages = await paginateSpineWithFont(spine, theme, fonts, ctx)
    return { pages, finalSpine: spine }
  }

  const cw = printContentWidthPt(theme.print)
  const fs = theme.print.fontSizePt
  let tocMs: Manuscript | null = null

  for (let iter = 0; iter < 12; iter++) {
    if (iter > 0) await yieldToMain()
    const withToc =
      tocMs != null ? insertPrintTocInSpine(project, spine, tocMs) : spine
    const pages = await paginateSpineWithFont(withToc, theme, fonts, ctx)
    const starts = firstPageByChapterId(pages, withToc)
    const nextToc = buildPrintTocManuscript(project, starts, cw, fonts.body, fs)
    const prevSig = tocMs ? JSON.stringify(tocMs.content) : ''
    const nextSig = JSON.stringify(nextToc.content)
    if (prevSig === nextSig) return { pages, finalSpine: withToc }
    tocMs = nextToc
  }
  const finalSpine = tocMs != null ? insertPrintTocInSpine(project, spine, tocMs) : spine
  const pages = await paginateSpineWithFont(finalSpine, theme, fonts, ctx)
  return { pages, finalSpine }
}

/** Manuscript spine used for PDF export and print preview (includes converged synthetic TOC when enabled). */
export async function resolvedPrintSpineManuscriptsForExport(
  project: InkwellProject,
  fontOrPair: FontMeasurer | PrintFontPair,
  ctx?: PrintLayoutContext,
): Promise<Manuscript[]> {
  const fonts: PrintFontPair = isFontPair(fontOrPair)
    ? fontOrPair
    : { body: fontOrPair, title: fontOrPair }
  const { finalSpine } = await paginatePrintExportInner(project, fonts, ctx)
  return finalSpine
}

/** Full book for KDP PDF: optional printable TOC with page numbers (iterative layout). */
export async function paginateProjectForPrintExport(
  project: InkwellProject,
  fontOrPair: FontMeasurer | PrintFontPair,
  ctx?: PrintLayoutContext,
): Promise<PrintPage[]> {
  const fonts: PrintFontPair = isFontPair(fontOrPair)
    ? fontOrPair
    : { body: fontOrPair, title: fontOrPair }
  const { pages } = await paginatePrintExportInner(project, fonts, ctx)
  return trimTrailingBlankPrintPage(pages)
}


