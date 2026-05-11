/** Invisible join breaker — suppresses common Latin ligatures (fi, fl, ff, …) in PDF/fontkit shaping. */
const ZWNJ = '\u200c'

/**
 * Print/PDF-only normalization: avoid OpenType `liga` glyphs whose cmap often maps to wrong Unicode
 * in pdf-lib viewers (e.g. "fi" shown as "Œ").
 *
 * Does not alter stored manuscript JSON; call at measure and draw time only.
 */
export function breakOptionalLigaturesForPrint(text: string): string {
  let t = text.normalize('NFC')
  t = t
    .replace(/\ufb00/g, 'ff')
    .replace(/\ufb01/g, 'fi')
    .replace(/\ufb02/g, 'fl')
    .replace(/\ufb03/g, 'ffi')
    .replace(/\ufb04/g, 'ffl')
  return t.replace(/f(?=[fil])/gi, (ch) => `${ch}${ZWNJ}`)
}
