import type { EbookTheme } from '../../types'

export function ebookCss(theme: EbookTheme): string {
  const fontStack = theme.fontFamily === 'serif' ? 'serif' : 'serif'
  const base = Math.max(12, Math.min(28, theme.baseFontSizePx))
  const lh = Math.max(1.1, Math.min(2.4, theme.lineHeight))

  // Keep CSS intentionally conservative (EPUB readers vary a lot).
  return `
.inkwell-ebook-preview {
  -webkit-text-size-adjust: 100%;
  margin: 0;
  padding: 0;
  font-family: ${fontStack};
  font-size: ${base}px;
  line-height: ${lh};
  color: #1f1917;
}
.inkwell-ebook-preview .chapter {
  padding: 0 0.9rem;
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
.inkwell-ebook-preview p {
  margin: 0.75em 0;
}
.inkwell-ebook-preview blockquote {
  margin: 0.9em 0;
  padding-left: 1em;
  border-left: 3px solid #c8bdb7;
}
.inkwell-ebook-preview ul, 
.inkwell-ebook-preview ol { margin: 0.75em 0 0.75em 1.25em; padding: 0; }
.inkwell-ebook-preview li { margin: 0.25em 0; }
.inkwell-ebook-preview hr { border: 0; border-top: 1px solid #c8bdb7; margin: 1.25em 0; }
`
    .trim()
    .replace(/\n{3,}/g, '\n\n')
}

