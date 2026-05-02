import type { JSONContent } from '@tiptap/core'

export type Manuscript = {
  id: number
  title: string
  content: JSONContent
}

export type BookMeta = {
  title: string
  subtitle: string
  authorName: string
  series: string
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

export type PrintTheme = {
  trimPreset: TrimPresetId
  /** Inches */
  marginTopIn: number
  marginBottomIn: number
  marginInnerIn: number
  marginOuterIn: number
  /** Additional inside margin for binding */
  gutterIn: number
  fontFamily: 'serif'
  fontSizePt: number
  lineHeight: number
  hyphenation: boolean
  /** Legacy quick toggle; header/footer config is the preferred system. */
  pageNumbers: 'footerCenter' | 'none'
  chapterStartsOn: 'either' | 'right'
  /** Centered opener before chapter body; skipped when body already starts with an H1 matching the chapter title. */
  chapterOpener: PrintChapterOpener
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
  fontFamily: 'serif'
  baseFontSizePx: number
  lineHeight: number
  /** Reader column width within the preview/export */
  maxWidthPx: number
  /** Space between paragraphs */
  paragraphSpacingEm: number
  textAlign: 'left' | 'justify'
  /** First-line indentation for paragraphs */
  firstLineIndentEm: number
}

export type Theme = {
  print: PrintTheme
  ebook: EbookTheme
}

export type ProjectKind = 'book' | 'note'

export type ProjectMeta = {
  id: string
  title: string
  updatedAt: number
  createdAt: number
  kind: ProjectKind
  /** When kind is note: optional attachment to a book project id */
  linkedBookId?: string | null
}

export type ProjectIndex = {
  version: 1
  projects: ProjectMeta[]
}

export type InkwellProject = {
  version: 3
  id: string
  kind: ProjectKind
  linkedBookId?: string | null
  book: BookMeta
  goals: WritingGoals
  chapters: Manuscript[]
  theme: Theme
}

export function defaultBookMeta(): BookMeta {
  return {
    title: '',
    subtitle: '',
    authorName: '',
    series: '',
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
      fontFamily: 'serif',
      fontSizePt: 11,
      lineHeight: 1.5,
      hyphenation: true,
      pageNumbers: 'footerCenter',
      chapterStartsOn: 'right',
      chapterOpener: 'titleOnly',
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
      fontFamily: 'serif',
      baseFontSizePx: 18,
      lineHeight: 1.7,
      maxWidthPx: 520,
      paragraphSpacingEm: 0.75,
      textAlign: 'left',
      firstLineIndentEm: 0,
    },
  }
}
