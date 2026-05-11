import type { InkwellProject, Theme } from '../../types'
import { hashStringDjb2 } from '../hash'

/** Manuscript + assembly + meta only (no print theme). Matches legacy PrintReview `contentLayoutKey`. */
export function computePrintContentLayoutKey(project: InkwellProject): string {
  const meta = { bookTitle: project.book.title, authorName: project.book.authorName }
  const chapterSig = project.chapters
    .map((c) => `${c.id}:${hashStringDjb2(JSON.stringify(c.content))}:${hashStringDjb2(c.title)}`)
    .join('|')
  const asm = `${project.assembly.includePrintToc}:${hashStringDjb2(project.assembly.printTocTitle ?? '')}`
  return `${chapterSig}|${asm}|${meta.bookTitle}|${meta.authorName}`
}

export function computePrintThemeKey(theme: Theme): string {
  return hashStringDjb2(JSON.stringify(theme.print))
}

/** Full layout fingerprint for print preview + PDF reuse (content + serialized print theme). */
export function computePrintLayoutBasisKey(project: InkwellProject, theme: Theme): string {
  const contentLayoutKey = computePrintContentLayoutKey(project)
  const printThemeKey = computePrintThemeKey(theme)
  return `${contentLayoutKey}|${printThemeKey}`
}
