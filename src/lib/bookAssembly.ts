import type { JSONContent } from '@tiptap/core'
import type { InkwellProject, Manuscript, ManuscriptSectionRole } from '../types'
import { TRIM_PRESETS } from '../types'

export const TOC_SYNTHETIC_ID = -9001

const FRONT_ROLES: ManuscriptSectionRole[] = [
  'title_page',
  'copyright',
  'dedication',
  'epigraph',
  'foreword',
  'preface',
  'introduction',
  'other_front',
]

const BACK_ROLES: ManuscriptSectionRole[] = [
  'acknowledgments',
  'about_author',
  'also_by',
  'appendix',
  'other_back',
]

export function effectiveSectionRole(m: Manuscript): ManuscriptSectionRole {
  return m.sectionRole ?? 'chapter'
}

export function matterKind(role: ManuscriptSectionRole): 'front' | 'body' | 'back' {
  if (FRONT_ROLES.includes(role) || role === 'toc') return 'front'
  if (BACK_ROLES.includes(role)) return 'back'
  return 'body'
}

export function layoutProfileForManuscript(m: Manuscript): 'chapter' | 'matter' | 'part' | 'toc' {
  const r = effectiveSectionRole(m)
  if (r === 'toc') return 'toc'
  if (r === 'part') return 'part'
  if (matterKind(r) === 'front' || matterKind(r) === 'back') return 'matter'
  return 'chapter'
}

export function includeManuscriptInPrint(m: Manuscript): boolean {
  return m.includeInPrint !== false
}

export function includeManuscriptInEpub(m: Manuscript): boolean {
  return m.includeInEpub !== false
}

export function includeInTocEntry(m: Manuscript): boolean {
  const r = effectiveSectionRole(m)
  if (r === 'toc') return false
  if (m.includeInPrintToc === false) return false
  return r === 'chapter' || r === 'part'
}

/** Ordered spine for print / EPUB (user order); filter by medium. */
export function manuscriptsForEpub(project: InkwellProject): Manuscript[] {
  return project.chapters.filter(includeManuscriptInEpub)
}

export function manuscriptsForPrint(project: InkwellProject): Manuscript[] {
  return project.chapters.filter(includeManuscriptInPrint)
}

export function firstBodyIndex(chapters: Manuscript[]): number {
  const idx = chapters.findIndex((m) => matterKind(effectiveSectionRole(m)) === 'body')
  return idx < 0 ? chapters.length : idx
}

export function displayChapterLabel(
  project: InkwellProject,
  m: Manuscript,
  bodyIndexOneBased: number,
): string {
  const title = m.title?.trim() || 'Untitled'
  const mode = project.assembly.chapterNumberMode
  const r = effectiveSectionRole(m)
  if (r === 'part') return title
  if (mode === 'chapter_n') return `Chapter ${bodyIndexOneBased}: ${title}`
  return title
}

function tocLineText(
  title: string,
  page: number,
  contentWidthPt: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSizePt: number,
): string {
  const t = title.trim()
  const num = String(page)
  let dots = ' '
  for (let i = 0; i < 400; i++) {
    const line = `${t}${dots}${num}`
    if (font.widthOfTextAtSize(line, fontSizePt) >= contentWidthPt) return line
    dots += '.'
  }
  return `${t}${dots}${num}`
}

export function printContentWidthPt(print: import('../types').PrintTheme): number {
  const trim = TRIM_PRESETS[print.trimPreset]
  const widthPt = trim.widthIn * 72
  const isRight = true
  const inner = (print.marginInnerIn + print.gutterIn) * 72
  const outer = print.marginOuterIn * 72
  const leftPt = isRight ? inner : outer
  const rightPt = isRight ? outer : inner
  return Math.max(1, widthPt - leftPt - rightPt)
}

export function buildPrintTocManuscript(
  project: InkwellProject,
  pageByManuscriptId: Map<number, number>,
  contentWidthPt: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSizePt: number,
): Manuscript {
  const printChapters = manuscriptsForPrint(project)
  const lines: string[] = [project.assembly.printTocTitle || 'Contents', '']
  let bodyN = 0
  for (const m of printChapters) {
    const r = effectiveSectionRole(m)
    if (!includeInTocEntry(m)) continue
    if (matterKind(r) !== 'body') continue
    bodyN++
    const pg = pageByManuscriptId.get(m.id)
    if (pg == null) continue
    const label = displayChapterLabel(project, m, bodyN)
    lines.push(tocLineText(label, pg, contentWidthPt, font, fontSizePt))
  }
  const paragraphs: JSONContent[] = lines.map((text) => ({
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : [],
  }))
  return {
    id: TOC_SYNTHETIC_ID,
    title: project.assembly.printTocTitle || 'Contents',
    sectionRole: 'toc',
    content: { type: 'doc', content: paragraphs },
  }
}

/** Insert synthetic TOC after front matter when enabled. */
export function insertPrintTocInSpine(project: InkwellProject, spine: Manuscript[], toc: Manuscript | null): Manuscript[] {
  if (!toc || !project.assembly.includePrintToc) return spine
  const idx = firstBodyIndex(spine)
  return [...spine.slice(0, idx), toc, ...spine.slice(idx)]
}

export function stripSyntheticToc(spine: Manuscript[]): Manuscript[] {
  return spine.filter((m) => m.id !== TOC_SYNTHETIC_ID)
}
