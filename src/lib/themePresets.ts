import type { Theme } from '../types'
import { defaultTheme } from '../types'

export type ThemePresetId = 'trade_default' | 'thriller_tight' | 'romance_open' | 'nonfiction_serious'

export type ThemePreset = {
  id: ThemePresetId
  label: string
  description: string
  patch: { print?: Partial<Theme['print']>; ebook?: Partial<Theme['ebook']> }
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'trade_default',
    label: 'Trade default',
    description: 'Balanced trade paperback',
    patch: {},
  },
  {
    id: 'thriller_tight',
    label: 'Thriller (tight)',
    description: 'Slightly smaller type, snug margins',
    patch: {
      print: {
        fontSizePt: 10.5,
        lineHeight: 1.42,
        marginOuterIn: 0.55,
        marginInnerIn: 0.8,
        hyphenation: true,
      },
      ebook: {
        baseFontSizePx: 17,
        lineHeight: 1.62,
        maxWidthPx: 480,
        paragraphSpacingEm: 0.55,
        textAlign: 'justify',
        firstLineIndentEm: 0.2,
      },
    },
  },
  {
    id: 'romance_open',
    label: 'Romance (open)',
    description: 'Roomy, generous paragraph space',
    patch: {
      print: {
        fontSizePt: 11.5,
        lineHeight: 1.58,
        marginTopIn: 0.8,
        marginBottomIn: 0.8,
        hyphenation: false,
      },
      ebook: {
        baseFontSizePx: 19,
        lineHeight: 1.75,
        maxWidthPx: 540,
        paragraphSpacingEm: 0.9,
        textAlign: 'left',
        firstLineIndentEm: 0,
      },
    },
  },
  {
    id: 'nonfiction_serious',
    label: 'Nonfiction',
    description: 'Justified, indent, reference-friendly',
    patch: {
      print: {
        fontSizePt: 11,
        lineHeight: 1.48,
        hyphenation: true,
        chapterOpener: 'numberRuleTitle',
      },
      ebook: {
        baseFontSizePx: 18,
        lineHeight: 1.65,
        maxWidthPx: 560,
        paragraphSpacingEm: 0.65,
        textAlign: 'justify',
        firstLineIndentEm: 0.35,
      },
    },
  },
]

export function applyThemePreset(current: Theme, presetId: ThemePresetId): Theme {
  const d = defaultTheme()
  if (presetId === 'trade_default') {
    return {
      print: { ...d.print, trimPreset: current.print.trimPreset },
      ebook: { ...d.ebook },
    }
  }
  const preset = THEME_PRESETS.find((p) => p.id === presetId)
  if (!preset) return current
  const p = preset.patch
  return {
    print: { ...current.print, ...p.print },
    ebook: { ...current.ebook, ...p.ebook },
  }
}
