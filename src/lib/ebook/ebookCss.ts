import type { EbookTheme } from '../../types'
import { CHAPTER_TITLE_STYLES } from '../../types'
import {
  DEFAULT_BODY_FONT_ID,
  FONT_CATALOG,
  genericFontFallback,
  isInkwellFontId,
  type InkwellFontId,
} from '../fonts/fontCatalog'

function formatForFilename(filename: string): 'woff2' | 'truetype' {
  return filename.endsWith('.woff2') ? 'woff2' : 'truetype'
}

function formatForUrl(url: string): 'woff2' | 'truetype' {
  return url.endsWith('.woff2') || url.includes('.woff2?') ? 'woff2' : 'truetype'
}

function resolvedBodyFontId(theme: EbookTheme): InkwellFontId {
  return isInkwellFontId(theme.bodyFontId) ? theme.bodyFontId : DEFAULT_BODY_FONT_ID
}

export function resolveEbookTitleFontId(theme: EbookTheme): InkwellFontId {
  const spec = CHAPTER_TITLE_STYLES[theme.chapterTitleStyleId]
  return spec.fontId ?? resolvedBodyFontId(theme)
}

export type EbookCssContext =
  | { kind: 'preview' }
  | {
      kind: 'epub'
      embedFont: boolean
      bundledFontHref?: string
      /** When provided, emits an additional @font-face for the chapter title font. */
      bundledTitleFontHref?: string
      bundledTitleFontFilename?: string
    }

export function ebookCss(theme: EbookTheme, ctx: EbookCssContext = { kind: 'preview' }): string {
  const id = resolvedBodyFontId(theme)
  const entry = FONT_CATALOG[id]

  let faceBlock = ''
  let fontStack: string

  if (ctx.kind === 'preview') {
    const fmt = formatForUrl(entry.ebookFontUrl)
    faceBlock = `@font-face{font-family:${JSON.stringify(entry.cssFamily)};src:url(${JSON.stringify(entry.ebookFontUrl)}) format('${fmt}');font-weight:400;font-style:normal;font-display:swap;}`
    fontStack = `${JSON.stringify(entry.cssFamily)}, ${genericFontFallback(entry.stackKind)}`
  } else if (ctx.embedFont && ctx.bundledFontHref) {
    const fmt = formatForFilename(entry.epubFilename)
    faceBlock = `@font-face{font-family:${JSON.stringify(entry.cssFamily)};src:url(${JSON.stringify(ctx.bundledFontHref)}) format('${fmt}');font-weight:400;font-style:normal;font-display:swap;}`
    fontStack = `${JSON.stringify(entry.cssFamily)}, ${genericFontFallback(entry.stackKind)}`
  } else {
    fontStack = genericFontFallback(entry.stackKind)
  }

  // Chapter title style: independent font + case + tracking + size knob.
  const titleSpec = CHAPTER_TITLE_STYLES[theme.chapterTitleStyleId]
  const titleFontId = titleSpec.fontId ?? id
  const titleEntry = FONT_CATALOG[titleFontId]
  const titleIsDistinct = titleFontId !== id

  let titleFaceBlock = ''
  let titleFontStack: string = fontStack

  if (titleIsDistinct) {
    if (ctx.kind === 'preview') {
      const fmt = formatForUrl(titleEntry.ebookFontUrl)
      titleFaceBlock = `@font-face{font-family:${JSON.stringify(titleEntry.cssFamily)};src:url(${JSON.stringify(titleEntry.ebookFontUrl)}) format('${fmt}');font-weight:400;font-style:normal;font-display:swap;}`
      titleFontStack = `${JSON.stringify(titleEntry.cssFamily)}, ${genericFontFallback(titleEntry.stackKind)}`
    } else if (ctx.embedFont && ctx.bundledTitleFontHref && ctx.bundledTitleFontFilename) {
      const fmt = formatForFilename(ctx.bundledTitleFontFilename)
      titleFaceBlock = `@font-face{font-family:${JSON.stringify(titleEntry.cssFamily)};src:url(${JSON.stringify(ctx.bundledTitleFontHref)}) format('${fmt}');font-weight:400;font-style:normal;font-display:swap;}`
      titleFontStack = `${JSON.stringify(titleEntry.cssFamily)}, ${genericFontFallback(titleEntry.stackKind)}`
    } else {
      titleFontStack = genericFontFallback(titleEntry.stackKind)
    }
  }

  const titleCaseCss =
    titleSpec.case === 'upper'
      ? 'uppercase'
      : titleSpec.case === 'titleCase'
        ? 'capitalize'
        : 'none'

  // Script display fonts (e.g. Great Vibes) need extra leading or ascenders/descenders clash.
  const titleLineHeight =
    titleEntry.cssFamily.toLowerCase().includes('great vibes') ? 1.4 : 1.15

  const base = Math.max(12, Math.min(28, theme.baseFontSizePx))
  const lh = Math.max(1.1, Math.min(2.4, theme.lineHeight))
  const maxWidthPx = Math.max(280, Math.min(900, theme.maxWidthPx))
  const paraSpaceEm = Math.max(0, Math.min(3, theme.paragraphSpacingEm))
  const indentEm = Math.max(0, Math.min(6, theme.firstLineIndentEm))
  const align = theme.textAlign === 'justify' ? 'justify' : 'left'

  // Chapter title selectors. Preview is scoped under .inkwell-ebook-preview so the
  // styling doesn't leak elsewhere. EPUB chapter XHTML (no wrapper class) uses the
  // bare `.chapter > h1:first-of-type` selector so reflowable readers pick it up.
  const titleSelector =
    ctx.kind === 'epub'
      ? '.chapter > h1:first-of-type, .inkwell-ebook-preview .chapter > h1:first-of-type'
      : '.inkwell-ebook-preview .chapter > h1:first-of-type'

  const ornamentSelector =
    ctx.kind === 'epub'
      ? '.chapter > .inkwell-ch-ornament, .inkwell-ebook-preview .chapter .inkwell-ch-ornament'
      : '.inkwell-ebook-preview .chapter .inkwell-ch-ornament'

  const dropCapCss =
    ctx.kind === 'epub'
      ? `p.inkwell-drop-cap::first-letter {
  float: left;
  font-size: 3.1em;
  line-height: 0.82;
  padding-right: 0.06em;
  margin-top: 0.05em;
  font-weight: 600;
}`
      : `.inkwell-ebook-preview p.inkwell-drop-cap::first-letter {
  float: left;
  font-size: 3.1em;
  line-height: 0.82;
  padding-right: 0.06em;
  margin-top: 0.05em;
  font-weight: 600;
}`

  const chapterTitleStyleCss =
    theme.chapterTitleStyleId === 'inherit'
      ? `${titleSelector} { text-align: center; }`
      : `${titleSelector} {
  text-align: center;
  font-family: ${titleFontStack};
  text-transform: ${titleCaseCss};
  letter-spacing: ${titleSpec.trackingEm}em;
  font-size: calc(1em * ${titleSpec.sizeMultiplier.toFixed(3)});
  line-height: ${titleLineHeight};
}
${ornamentSelector} {
  text-align: center;
  font-family: ${titleFontStack};
  font-size: calc(1em * ${(titleSpec.sizeMultiplier * 0.55).toFixed(3)});
  line-height: 1;
  margin: 0.25em 0 1.25em;
}`

  return `
${faceBlock}
${titleFaceBlock}
.inkwell-ebook-preview {
  -webkit-text-size-adjust: 100%;
  margin: 0;
  padding: 0;
  font-family: ${fontStack};
  font-size: ${base}px;
  line-height: ${lh};
  color: var(--color-ink);
}
.dark .inkwell-ebook-preview {
  color: var(--color-ink-dark);
}
.inkwell-ebook-preview .chapter {
  padding: 0 0.9rem;
  max-width: ${maxWidthPx}px;
  margin: 0 auto;
}
.inkwell-ebook-preview h1, 
.inkwell-ebook-preview h2, 
.inkwell-ebook-preview h3 {
  font-weight: 700;
  line-height: 1.2;
  margin: 1.2em 0 0.6em;
}
.inkwell-ebook-preview h1 { font-size: 1.6em; }
.inkwell-ebook-preview h2 { font-size: 1.35em; }
.inkwell-ebook-preview h3 { font-size: 1.15em; }
/* Chapter title style (independent knob, see CHAPTER_TITLE_STYLES). */
${chapterTitleStyleCss}
.inkwell-ebook-preview p {
  margin: ${paraSpaceEm}em 0;
  text-align: ${align};
  text-indent: ${indentEm}em;
  white-space: break-spaces;
  tab-size: 8;
}
.inkwell-ebook-preview a {
  color: var(--color-walnut);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.dark .inkwell-ebook-preview a {
  color: var(--color-accent-warm);
}
.inkwell-ebook-preview s {
  text-decoration-thickness: 2px;
}
.inkwell-ebook-preview blockquote {
  margin: 0.9em 0;
  padding-left: 1em;
  border-left: 3px solid #c8bdb7;
}
.dark .inkwell-ebook-preview blockquote {
  border-left-color: color-mix(in srgb, var(--color-accent-warm) 55%, transparent);
}
.inkwell-ebook-preview ul, 
.inkwell-ebook-preview ol { margin: 0.75em 0 0.75em 1.25em; padding: 0; }
.inkwell-ebook-preview li { margin: 0.25em 0; }
.inkwell-ebook-preview hr { border: 0; border-top: 1px solid #c8bdb7; margin: 1.25em 0; }
.inkwell-ebook-preview .inkwell-scene-break {
  text-align: center;
  font-size: 1.05em;
  letter-spacing: 0.04em;
  margin: 1.35em 0;
}
.inkwell-ebook-preview .inkwell-figure { margin: 1em auto; text-align: center; max-width: 100%; }
.inkwell-ebook-preview .inkwell-figure img { max-width: 100%; height: auto; }
.inkwell-ebook-preview .inkwell-export-comment {
  background: color-mix(in srgb, var(--color-walnut) 12%, transparent);
}
.dark .inkwell-ebook-preview .inkwell-export-comment {
  background: color-mix(in srgb, var(--color-accent-warm) 14%, transparent);
}
.inkwell-ebook-preview .inkwell-mention-export { font-weight: 600; color: var(--color-walnut); }
.dark .inkwell-ebook-preview .inkwell-mention-export { color: var(--color-accent-warm); }
.inkwell-ebook-preview .inkwell-fn-ref { font-size: 0.85em; }
.inkwell-ebook-preview .inkwell-footnotes { margin-top: 2em; font-size: 0.9em; }
.inkwell-ebook-preview .inkwell-footnotes ol { padding-left: 1.25em; }
.inkwell-ebook-preview .inkwell-footnotes li { margin: 0.5em 0; }
${dropCapCss}
`
    .trim()
    .replace(/\n{3,}/g, '\n\n')
}
