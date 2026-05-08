import type { JSONContent } from '@tiptap/core'
import type { InkwellFontId } from './lib/fonts/fontCatalog'
import { DEFAULT_BODY_FONT_ID } from './lib/fonts/fontCatalog'

export type { InkwellFontId } from './lib/fonts/fontCatalog'

export type ManuscriptSectionRole =
  | 'chapter'
  | 'part'
  | 'title_page'
  | 'copyright'
  | 'dedication'
  | 'epigraph'
  | 'foreword'
  | 'preface'
  | 'introduction'
  | 'toc'
  | 'acknowledgments'
  | 'about_author'
  | 'also_by'
  | 'appendix'
  | 'other_front'
  | 'other_back'

export type ChapterNumberMode = 'title_only' | 'chapter_n'

export type Manuscript = {
  id: number
  title: string
  content: JSONContent
  /** Spine / export role; default chapter */
  sectionRole?: ManuscriptSectionRole
  includeInPrintToc?: boolean
  includeInEpub?: boolean
  includeInPrint?: boolean
}

export type SeriesBibleEntry = {
  id: string
  kind: 'character' | 'place' | 'thread' | 'other'
  name: string
  notes: string
}

export type BookAssembly = {
  includePrintToc: boolean
  printTocTitle: string
  chapterNumberMode: ChapterNumberMode
}

export type ExportExtras = {
  /** Plain text fallback bundled in export zip if enabled */
  includeTxtExport?: boolean
}

export type BookMeta = {
  title: string
  subtitle: string
  authorName: string
  series: string
  /** JPEG data URL; shown on bookshelf and optional future export use */
  coverImageDataUrl?: string
  /** BCP-47 language tag for EPUB/metadata */
  language?: string
  isbn?: string
  /** Series installment number for EPUB calibre-style meta */
  seriesIndex?: number | null
  description?: string
  publisher?: string
}

export type WritingGoals = {
  manuscriptTargetWords: number | null
  dailyWordGoal: number | null
  /** YYYY-MM-DD (local) when dailyBaselineWordCount was fixed */
  dailyProgressDate: string
  /** Total book words at start of dailyProgressDate */
  dailyBaselineWordCount: number
}

export type TrimPresetId = 'kdp_6x9' | 'kdp_5x8' | 'kdp_5_5x8_5'

export type TrimPreset = {
  id: TrimPresetId
  label: string
  /** Inches */
  widthIn: number
  /** Inches */
  heightIn: number
}

export const TRIM_PRESETS: Record<TrimPresetId, TrimPreset> = {
  kdp_6x9: { id: 'kdp_6x9', label: 'KDP • 6" × 9"', widthIn: 6, heightIn: 9 },
  kdp_5x8: { id: 'kdp_5x8', label: 'KDP • 5" × 8"', widthIn: 5, heightIn: 8 },
  kdp_5_5x8_5: { id: 'kdp_5_5x8_5', label: 'KDP • 5.5" × 8.5"', widthIn: 5.5, heightIn: 8.5 },
}

export function trimLabel(id: TrimPresetId): string {
  return TRIM_PRESETS[id]?.label ?? id
}

/** Synthetic chapter opening lines in print layout (see paginate). */
export type PrintChapterOpener = 'off' | 'titleOnly' | 'numberRuleTitle'

export type PrintBinding = 'paperback' | 'hardcover'

/**
 * Chapter title style: an independent knob (separate from interior preset) that controls
 * how the chapter title block is rendered in both print and ebook. `inherit` means
 * "use the interior preset's defaults" (today's behavior — body font, 2.5x size, no tracking).
 */
export type ChapterTitleStyleId =
  | 'inherit'
  | 'classic_serif_caps'
  | 'engraved_roman_caps'
  | 'literary_display'
  | 'modern_sans_tracked'
  | 'condensed_thriller'
  | 'minimalist'
  | 'ornament_heart'

export type ChapterTitleStyleSpec = {
  /** undefined = use book body font */
  fontId?: InkwellFontId
  case: 'asis' | 'upper' | 'titleCase'
  /** letter-spacing in em units */
  trackingEm: number
  /** multiplier applied to body fontSizePt for the chapter title (default banner is 2.5) */
  sizeMultiplier: number
  /** Single Unicode glyph rendered centered below the title when set */
  ornamentBelow?: string
  /** Short human-readable description shown under the picker */
  label: string
  /** Optional family-grouping label for the picker UI */
  group?: 'Serif caps' | 'Display' | 'Sans' | 'Minimal'
}

export const CHAPTER_TITLE_STYLES: Readonly<Record<ChapterTitleStyleId, ChapterTitleStyleSpec>> =
  Object.freeze({
    inherit: {
      case: 'asis',
      trackingEm: 0,
      sizeMultiplier: 2.5,
      label: 'Use interior preset (default)',
    },
    classic_serif_caps: {
      fontId: 'libre_baskerville',
      case: 'upper',
      trackingEm: 0.18,
      sizeMultiplier: 2.0,
      label: 'Classic serif caps · Libre Baskerville',
      group: 'Serif caps',
    },
    engraved_roman_caps: {
      fontId: 'cinzel',
      case: 'upper',
      trackingEm: 0.06,
      sizeMultiplier: 2.4,
      label: 'Engraved Roman caps · Cinzel',
      group: 'Serif caps',
    },
    literary_display: {
      fontId: 'playfair_display',
      case: 'titleCase',
      trackingEm: 0.02,
      sizeMultiplier: 2.6,
      label: 'Literary display · Playfair Display',
      group: 'Display',
    },
    modern_sans_tracked: {
      fontId: 'inter',
      case: 'upper',
      trackingEm: 0.32,
      sizeMultiplier: 1.6,
      label: 'Modern sans, wide-tracked · Inter',
      group: 'Sans',
    },
    condensed_thriller: {
      fontId: 'dejavu_sans_condensed',
      case: 'upper',
      trackingEm: 0.12,
      sizeMultiplier: 2.1,
      label: 'Condensed thriller · DejaVu Sans Condensed',
      group: 'Sans',
    },
    minimalist: {
      case: 'asis',
      trackingEm: 0,
      sizeMultiplier: 1.8,
      label: 'Minimalist · body font, calm',
      group: 'Minimal',
    },
    ornament_heart: {
      fontId: 'eb_garamond',
      case: 'upper',
      trackingEm: 0.18,
      sizeMultiplier: 2.0,
      ornamentBelow: '\u2766',
      label: 'Ornamental · EB Garamond with heart',
      group: 'Serif caps',
    },
  })

export function isChapterTitleStyleId(id: unknown): id is ChapterTitleStyleId {
  return typeof id === 'string' && id in CHAPTER_TITLE_STYLES
}

export function coerceChapterTitleStyleId(id: unknown): ChapterTitleStyleId {
  return isChapterTitleStyleId(id) ? id : 'inherit'
}

export type PrintTheme = {
  trimPreset: TrimPresetId
  /** Inches */
  marginTopIn: number
  marginBottomIn: number
  marginInnerIn: number
  marginOuterIn: number
  /** Additional inside margin for binding */
  gutterIn: number
  /** Extra trim for print bleed (KDP); added to width/height in PDF export when > 0 */
  bleedIn: number
  binding: PrintBinding
  /** Shown after export: bundled body font is embedded in PDF; KDP may require embedding for other custom fonts */
  showEmbedFontNote: boolean
  bodyFontId: InkwellFontId
  fontSizePt: number
  lineHeight: number
  hyphenation: boolean
  /** Legacy quick toggle; header/footer config is the preferred system. */
  pageNumbers: 'footerCenter' | 'none'
  chapterStartsOn: 'either' | 'right'
  /** Centered opener before chapter body; skipped when body already starts with an H1 matching the chapter title. */
  chapterOpener: PrintChapterOpener
  /** Independent chapter title style; `inherit` defers to the interior preset's defaults. */
  chapterTitleStyleId: ChapterTitleStyleId
  header: PrintHeaderFooterTheme
  footer: PrintHeaderFooterTheme
}

export type PrintHeaderFooterToken = 'none' | 'bookTitle' | 'author' | 'chapterTitle' | 'pageNumber'

export type PrintHeaderFooterSlots = {
  left: PrintHeaderFooterToken
  center: PrintHeaderFooterToken
  right: PrintHeaderFooterToken
}

export type PrintHeaderFooterTheme = {
  enabled: boolean
  fontSizePt: number
  odd: PrintHeaderFooterSlots
  even: PrintHeaderFooterSlots
}

export type EbookTheme = {
  bodyFontId: InkwellFontId
  /** When false, EPUB uses generic system serif/sans stacks only (maximum reader compatibility). */
  embedFontsInEpub: boolean
  baseFontSizePx: number
  lineHeight: number
  /** Reader column width within the preview/export */
  maxWidthPx: number
  /** Space between paragraphs */
  paragraphSpacingEm: number
  textAlign: 'left' | 'justify'
  /** First-line indentation for paragraphs */
  firstLineIndentEm: number
  /** Independent chapter title style; `inherit` defers to the interior preset's defaults. */
  chapterTitleStyleId: ChapterTitleStyleId
}

export type Theme = {
  print: PrintTheme
  ebook: EbookTheme
  /** Last interior preset applied while Print format tab was active (dropdown; matches ThemePresetId). */
  lastPrintInteriorPresetId?: string
  /** Last interior preset applied while Ebook format tab was active. */
  lastEbookInteriorPresetId?: string
}

export type ProjectKind = 'book' | 'note'

export type ProjectMeta = {
  id: string
  title: string
  updatedAt: number
  createdAt: number
  kind: ProjectKind
  /** When kind is note: optional parent on the shelf (book or note project id) */
  linkedBookId?: string | null
  /** Denormalized from book.coverImageDataUrl for bookshelf thumbnails */
  coverImageDataUrl?: string
}

export type ProjectIndex = {
  version: 1
  projects: ProjectMeta[]
}

export type InkwellProject = {
  version: 3
  id: string
  kind: ProjectKind
  /** When kind is note: parent book or note project id */
  linkedBookId?: string | null
  book: BookMeta
  goals: WritingGoals
  chapters: Manuscript[]
  theme: Theme
  assembly: BookAssembly
  seriesBible: SeriesBibleEntry[]
  exportExtras?: ExportExtras
}

export function defaultBookMeta(): BookMeta {
  return {
    title: '',
    subtitle: '',
    authorName: '',
    series: '',
    language: 'en',
  }
}

export function defaultBookAssembly(): BookAssembly {
  return {
    includePrintToc: true,
    printTocTitle: 'Contents',
    chapterNumberMode: 'title_only',
  }
}

export function defaultWritingGoals(): WritingGoals {
  return {
    manuscriptTargetWords: null,
    dailyWordGoal: null,
    dailyProgressDate: '',
    dailyBaselineWordCount: 0,
  }
}

export function defaultTheme(): Theme {
  return {
    print: {
      trimPreset: 'kdp_6x9',
      marginTopIn: 0.75,
      marginBottomIn: 0.75,
      marginInnerIn: 0.875,
      marginOuterIn: 0.625,
      gutterIn: 0.125,
      bleedIn: 0,
      binding: 'paperback',
      showEmbedFontNote: true,
      bodyFontId: DEFAULT_BODY_FONT_ID,
      fontSizePt: 11,
      lineHeight: 1.5,
      hyphenation: true,
      pageNumbers: 'footerCenter',
      chapterStartsOn: 'right',
      chapterOpener: 'titleOnly',
      chapterTitleStyleId: 'inherit',
      header: {
        enabled: true,
        fontSizePt: 9,
        odd: { left: 'bookTitle', center: 'none', right: 'chapterTitle' },
        even: { left: 'chapterTitle', center: 'none', right: 'bookTitle' },
      },
      footer: {
        enabled: true,
        fontSizePt: 10,
        odd: { left: 'none', center: 'pageNumber', right: 'none' },
        even: { left: 'none', center: 'pageNumber', right: 'none' },
      },
    },
    ebook: {
      bodyFontId: DEFAULT_BODY_FONT_ID,
      embedFontsInEpub: true,
      baseFontSizePx: 18,
      lineHeight: 1.7,
      maxWidthPx: 520,
      paragraphSpacingEm: 0.75,
      textAlign: 'left',
      firstLineIndentEm: 0,
      chapterTitleStyleId: 'inherit',
    },
  }
}
