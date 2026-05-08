import type { Theme } from '../types'
import { defaultTheme } from '../types'

export type ThemePresetId =
  | 'trade_default'
  | 'thriller_tight'
  | 'romance_open'
  | 'nonfiction_serious'
  | 'literary_garamond'
  | 'storybook_lora'
  | 'serious_baskerville'
  | 'ui_clean_sans'
  | 'readable_inter'
  | 'contemporary_dejavu_sans'
  | 'memoir_warm'
  | 'sf_crisp'

export type ThemePreset = {
  id: ThemePresetId
  label: string
  description: string
  /** Sidebar optgroup label */
  group: string
  patch: { print?: Partial<Theme['print']>; ebook?: Partial<Theme['ebook']> }
}

export const THEME_PRESET_GROUP_ORDER = ['Starter', 'Pacing & genre', 'Typography packs'] as const

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'trade_default',
    label: 'Trade default',
    description: 'Balanced trade paperback',
    group: 'Starter',
    patch: {},
  },
  {
    id: 'thriller_tight',
    label: 'Thriller (tight)',
    description: 'Condensed sans, smaller type, snug margins',
    group: 'Pacing & genre',
    patch: {
      print: {
        bodyFontId: 'dejavu_sans_condensed',
        fontSizePt: 10.5,
        lineHeight: 1.42,
        marginOuterIn: 0.55,
        marginInnerIn: 0.8,
        hyphenation: true,
        chapterTitleStyleId: 'condensed_thriller',
      },
      ebook: {
        bodyFontId: 'dejavu_sans_condensed',
        baseFontSizePx: 17,
        lineHeight: 1.62,
        maxWidthPx: 480,
        paragraphSpacingEm: 0.55,
        textAlign: 'justify',
        firstLineIndentEm: 0.2,
        chapterTitleStyleId: 'condensed_thriller',
      },
    },
  },
  {
    id: 'romance_open',
    label: 'Romance (open)',
    description: 'Lora, roomy paragraphs',
    group: 'Pacing & genre',
    patch: {
      print: {
        bodyFontId: 'lora',
        fontSizePt: 11.5,
        lineHeight: 1.58,
        marginTopIn: 0.8,
        marginBottomIn: 0.8,
        hyphenation: false,
        chapterTitleStyleId: 'literary_display',
      },
      ebook: {
        bodyFontId: 'lora',
        baseFontSizePx: 19,
        lineHeight: 1.75,
        maxWidthPx: 540,
        paragraphSpacingEm: 0.9,
        textAlign: 'left',
        firstLineIndentEm: 0,
        chapterTitleStyleId: 'literary_display',
      },
    },
  },
  {
    id: 'nonfiction_serious',
    label: 'Nonfiction',
    description: 'Libre Baskerville, justified, chapter opener with rule',
    group: 'Pacing & genre',
    patch: {
      print: {
        bodyFontId: 'libre_baskerville',
        fontSizePt: 11,
        lineHeight: 1.48,
        hyphenation: true,
        chapterOpener: 'numberRuleTitle',
        chapterTitleStyleId: 'classic_serif_caps',
      },
      ebook: {
        bodyFontId: 'libre_baskerville',
        baseFontSizePx: 18,
        lineHeight: 1.65,
        maxWidthPx: 560,
        paragraphSpacingEm: 0.65,
        textAlign: 'justify',
        firstLineIndentEm: 0.35,
        chapterTitleStyleId: 'classic_serif_caps',
      },
    },
  },
  {
    id: 'literary_garamond',
    label: 'Literary classic',
    description: 'EB Garamond, traditional serif book',
    group: 'Typography packs',
    patch: {
      print: {
        bodyFontId: 'eb_garamond',
        fontSizePt: 11,
        lineHeight: 1.52,
        hyphenation: true,
        chapterTitleStyleId: 'literary_display',
      },
      ebook: {
        bodyFontId: 'eb_garamond',
        baseFontSizePx: 18,
        lineHeight: 1.72,
        maxWidthPx: 520,
        paragraphSpacingEm: 0.65,
        textAlign: 'left',
        firstLineIndentEm: 0.15,
        chapterTitleStyleId: 'literary_display',
      },
    },
  },
  {
    id: 'storybook_lora',
    label: 'Warm serif',
    description: 'Lora for long reading sessions',
    group: 'Typography packs',
    patch: {
      print: {
        bodyFontId: 'lora',
        fontSizePt: 11,
        lineHeight: 1.55,
        hyphenation: true,
        chapterTitleStyleId: 'ornament_heart',
      },
      ebook: {
        bodyFontId: 'lora',
        baseFontSizePx: 18,
        lineHeight: 1.72,
        maxWidthPx: 540,
        paragraphSpacingEm: 0.72,
        textAlign: 'left',
        firstLineIndentEm: 0,
        chapterTitleStyleId: 'ornament_heart',
      },
    },
  },
  {
    id: 'serious_baskerville',
    label: 'Reference serif',
    description: 'Libre Baskerville, steady and legible',
    group: 'Typography packs',
    patch: {
      print: {
        bodyFontId: 'libre_baskerville',
        fontSizePt: 10.75,
        lineHeight: 1.5,
        hyphenation: true,
      },
      ebook: {
        bodyFontId: 'libre_baskerville',
        baseFontSizePx: 17,
        lineHeight: 1.68,
        maxWidthPx: 540,
        paragraphSpacingEm: 0.6,
        textAlign: 'justify',
        firstLineIndentEm: 0.25,
      },
    },
  },
  {
    id: 'ui_clean_sans',
    label: 'Clean sans',
    description: 'Source Sans 3, contemporary interior',
    group: 'Typography packs',
    patch: {
      print: {
        bodyFontId: 'source_sans_3',
        fontSizePt: 10.75,
        lineHeight: 1.48,
        hyphenation: false,
      },
      ebook: {
        bodyFontId: 'source_sans_3',
        baseFontSizePx: 17,
        lineHeight: 1.62,
        maxWidthPx: 520,
        paragraphSpacingEm: 0.55,
        textAlign: 'left',
        firstLineIndentEm: 0,
      },
    },
  },
  {
    id: 'readable_inter',
    label: 'Modern sans',
    description: 'Inter for crisp digital-first reading',
    group: 'Typography packs',
    patch: {
      print: {
        bodyFontId: 'inter',
        fontSizePt: 10.5,
        lineHeight: 1.46,
        hyphenation: false,
      },
      ebook: {
        bodyFontId: 'inter',
        baseFontSizePx: 17,
        lineHeight: 1.6,
        maxWidthPx: 500,
        paragraphSpacingEm: 0.5,
        textAlign: 'left',
        firstLineIndentEm: 0,
      },
    },
  },
  {
    id: 'contemporary_dejavu_sans',
    label: 'Neutral sans',
    description: 'DejaVu Sans, metric-stable workhorse',
    group: 'Typography packs',
    patch: {
      print: {
        bodyFontId: 'dejavu_sans',
        fontSizePt: 10.75,
        lineHeight: 1.48,
        hyphenation: true,
      },
      ebook: {
        bodyFontId: 'dejavu_sans',
        baseFontSizePx: 17,
        lineHeight: 1.62,
        maxWidthPx: 520,
        paragraphSpacingEm: 0.55,
        textAlign: 'left',
        firstLineIndentEm: 0,
      },
    },
  },
  {
    id: 'memoir_warm',
    label: 'Memoir (warm)',
    description: 'Relaxed Lora, roomy paragraphs',
    group: 'Pacing & genre',
    patch: {
      print: {
        bodyFontId: 'lora',
        fontSizePt: 11.25,
        lineHeight: 1.62,
        hyphenation: false,
        chapterTitleStyleId: 'literary_display',
      },
      ebook: {
        bodyFontId: 'lora',
        baseFontSizePx: 19,
        lineHeight: 1.78,
        maxWidthPx: 540,
        paragraphSpacingEm: 0.65,
        firstLineIndentEm: 0.35,
        chapterTitleStyleId: 'literary_display',
      },
    },
  },
  {
    id: 'sf_crisp',
    label: 'Sci‑fi (crisp)',
    description: 'Tight Inter, narrow measure',
    group: 'Pacing & genre',
    patch: {
      print: {
        bodyFontId: 'inter',
        fontSizePt: 10.5,
        lineHeight: 1.42,
        hyphenation: true,
        chapterTitleStyleId: 'modern_sans_tracked',
      },
      ebook: {
        bodyFontId: 'inter',
        baseFontSizePx: 17,
        lineHeight: 1.55,
        maxWidthPx: 460,
        paragraphSpacingEm: 0.45,
        textAlign: 'justify',
        firstLineIndentEm: 0,
        chapterTitleStyleId: 'modern_sans_tracked',
      },
    },
  },
]

export function isThemePresetId(id: string): id is ThemePresetId {
  return THEME_PRESETS.some((p) => p.id === id)
}

export function themePresetsGrouped(): { group: string; presets: ThemePreset[] }[] {
  const byKey = new Map<string, ThemePreset[]>()
  for (const p of THEME_PRESETS) {
    if (!byKey.has(p.group)) byKey.set(p.group, [])
    byKey.get(p.group)!.push(p)
  }
  const orderSet = new Set<string>(THEME_PRESET_GROUP_ORDER)
  const ordered: { group: string; presets: ThemePreset[] }[] = []
  for (const g of THEME_PRESET_GROUP_ORDER) {
    const list = byKey.get(g)
    if (list?.length) ordered.push({ group: g, presets: list })
  }
  for (const [group, presets] of byKey) {
    if (!orderSet.has(group)) ordered.push({ group, presets })
  }
  return ordered
}

export type ThemePresetScope = 'print' | 'ebook'

/** Apply a preset to print or ebook only, depending on which Format tab is active. */
export function applyThemePreset(
  current: Theme,
  presetId: ThemePresetId,
  scope: ThemePresetScope,
): Theme {
  const d = defaultTheme()
  if (presetId === 'trade_default') {
    if (scope === 'print') {
      return {
        ...current,
        print: {
          ...d.print,
          trimPreset: current.print.trimPreset,
          bodyFontId: current.print.bodyFontId,
        },
        lastPrintInteriorPresetId: presetId,
      }
    }
    return {
      ...current,
      ebook: { ...d.ebook, bodyFontId: current.ebook.bodyFontId },
      lastEbookInteriorPresetId: presetId,
    }
  }
  const preset = THEME_PRESETS.find((p) => p.id === presetId)
  if (!preset) return current
  const p = preset.patch
  if (scope === 'print') {
    return {
      ...current,
      print: p.print ? { ...current.print, ...p.print } : current.print,
      lastPrintInteriorPresetId: presetId,
    }
  }
  return {
    ...current,
    ebook: p.ebook ? { ...current.ebook, ...p.ebook } : current.ebook,
    lastEbookInteriorPresetId: presetId,
  }
}
