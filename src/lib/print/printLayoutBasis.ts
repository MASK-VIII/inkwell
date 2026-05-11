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

/** Assembly + print TOC flags without chapter bodies (theme-independent spine metadata). */
export function computePrintAssemblyKey(project: InkwellProject): string {
  const a = project.assembly
  return hashStringDjb2(
    JSON.stringify({
      includePrintToc: a.includePrintToc,
      printTocTitle: a.printTocTitle,
      chapterNumberMode: a.chapterNumberMode,
      chapterIds: project.chapters.map((c) => c.id),
      includeInPrint: project.chapters.map((c) => c.includeInPrint !== false),
      includeInPrintToc: project.chapters.map((c) => c.includeInPrintToc !== false),
      sectionRoles: project.chapters.map((c) => c.sectionRole ?? 'chapter'),
    }),
  )
}

/** Book title + author only (rare edits vs chapter bodies). */
export function computePrintBookMetaKey(project: InkwellProject): string {
  return hashStringDjb2(
    JSON.stringify({
      title: project.book.title,
      authorName: project.book.authorName,
    }),
  )
}

export function computePrintThemeKey(theme: Theme): string {
  return hashStringDjb2(JSON.stringify(theme.print))
}

export type PrintLayoutBasisParts = {
  contentKey: string
  themeKey: string
  assemblyKey: string
  bookMetaKey: string
  /** Same as `computePrintLayoutBasisKey` before this refactor; stable for caches + React deps. */
  combinedKey: string
}

/** Granular keys for future incremental invalidation (preview currently still uses `combinedKey`). */
export function computePrintLayoutBasisParts(project: InkwellProject, theme: Theme): PrintLayoutBasisParts {
  const contentKey = computePrintContentLayoutKey(project)
  const themeKey = computePrintThemeKey(theme)
  const assemblyKey = computePrintAssemblyKey(project)
  const bookMetaKey = computePrintBookMetaKey(project)
  return {
    contentKey,
    themeKey,
    assemblyKey,
    bookMetaKey,
    combinedKey: `${contentKey}|${themeKey}`,
  }
}

/** Full layout fingerprint for print preview + PDF reuse (content + serialized print theme). */
export function computePrintLayoutBasisKey(project: InkwellProject, theme: Theme): string {
  return computePrintLayoutBasisParts(project, theme).combinedKey
}
