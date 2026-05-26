import type { JSONContent } from '@tiptap/core'
import type { BookMeta, InkwellProject, Manuscript, MasterPageKind, ManuscriptSectionRole } from '../types'
import {
  displayChapterLabel,
  effectiveSectionRole,
  firstBodyIndex,
  includeInTocEntry,
  matterKind,
  tocLineText,
} from './bookAssembly'
function emptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/** Persisted built-in Contents page (never assigned by nextManuscriptId). */
export const CONTENTS_MASTER_ID = -9002

/** Persisted built-in Title page for newly seeded books (never assigned by nextManuscriptId). */
export const TITLE_MASTER_ID = -9003

/** Writer-only in-editor navigation from Contents TOC lines (stripped on export). */
export const INKWELL_CHAPTER_LINK_PREFIX = '#inkwell-chapter-'

export function inkwellChapterLinkHref(chapterId: number): string {
  return `${INKWELL_CHAPTER_LINK_PREFIX}${chapterId}`
}

export function parseInkwellChapterLinkHref(href: string): number | null {
  const m = new RegExp(`^${INKWELL_CHAPTER_LINK_PREFIX.replace('#', '\\#')}(\\d+)$`).exec(href.trim())
  if (!m?.[1]) return null
  const id = Number(m[1])
  return Number.isFinite(id) ? id : null
}

export function isInkwellChapterLinkHref(href: string): boolean {
  return parseInkwellChapterLinkHref(href) != null
}

export type MasterPageCatalogEntry = {
  kind: MasterPageKind
  label: string
  sectionRole: ManuscriptSectionRole
  defaultTitle: string
  /** Optional presets shown on the Contents hub. */
  addableFromContents: boolean
}

export const MASTER_PAGE_CATALOG: MasterPageCatalogEntry[] = [
  { kind: 'title_page', label: 'Title page', sectionRole: 'title_page', defaultTitle: 'Title page', addableFromContents: true },
  { kind: 'copyright', label: 'Copyright', sectionRole: 'copyright', defaultTitle: 'Copyright', addableFromContents: true },
  { kind: 'dedication', label: 'Dedication', sectionRole: 'dedication', defaultTitle: 'Dedication', addableFromContents: true },
  { kind: 'epigraph', label: 'Epigraph', sectionRole: 'epigraph', defaultTitle: 'Epigraph', addableFromContents: true },
  { kind: 'foreword', label: 'Foreword', sectionRole: 'foreword', defaultTitle: 'Foreword', addableFromContents: true },
  { kind: 'preface', label: 'Preface', sectionRole: 'preface', defaultTitle: 'Preface', addableFromContents: true },
  { kind: 'introduction', label: 'Introduction', sectionRole: 'introduction', defaultTitle: 'Introduction', addableFromContents: true },
  { kind: 'disclaimer', label: 'Disclaimer', sectionRole: 'disclaimer', defaultTitle: 'Disclaimer', addableFromContents: true },
  { kind: 'acknowledgments', label: 'Acknowledgments', sectionRole: 'acknowledgments', defaultTitle: 'Acknowledgments', addableFromContents: true },
]

const ADDABLE_KINDS = new Set(
  MASTER_PAGE_CATALOG.filter((e) => e.addableFromContents).map((e) => e.kind),
)

export function catalogEntryForKind(kind: MasterPageKind): MasterPageCatalogEntry | undefined {
  return MASTER_PAGE_CATALOG.find((e) => e.kind === kind)
}

export function isMasterPage(m: Manuscript): boolean {
  return m.masterKind != null || m.id === CONTENTS_MASTER_ID
}

export function isContentsPage(m: Manuscript): boolean {
  return m.masterKind === 'contents' || m.id === CONTENTS_MASTER_ID
}

export function isSystemManagedMaster(m: Manuscript): boolean {
  return m.isSystemManaged === true || isContentsPage(m)
}

export function findContentsMaster(chapters: Manuscript[]): Manuscript | undefined {
  return chapters.find((m) => isContentsPage(m))
}

export function findTitleMaster(chapters: Manuscript[]): Manuscript | undefined {
  return chapters.find((m) => m.masterKind === 'title_page' || m.id === TITLE_MASTER_ID)
}

export function isTitlePage(m: Manuscript): boolean {
  return m.masterKind === 'title_page' || m.id === TITLE_MASTER_ID
}

function plainTextFromDocNode(node: JSONContent): string {
  if (node.text) return node.text
  if (!node.content) return ''
  return node.content.map(plainTextFromDocNode).join('')
}

/** On-page chapter title when the writer has replaced the default "Title page" label. */
export function extractBookTitleFromTitlePageManuscript(manuscript: Manuscript): string | null {
  const label = manuscript.title?.trim() ?? ''
  const defaultLabel = catalogEntryForKind('title_page')?.defaultTitle ?? 'Title page'
  if (!label || label === defaultLabel) return null
  return label
}

/** Fallback when the section label is still the default: first non-empty body line. */
export function extractBookTitleFromTitlePageContent(content: JSONContent | undefined): string | null {
  if (!content || content.type !== 'doc' || !Array.isArray(content.content)) return null
  for (const block of content.content) {
    const text = plainTextFromDocNode(block).trim()
    if (text) return text
  }
  return null
}

/** Mirror title page edits into book meta for shelf/header/export. */
export function syncBookMetaFromTitlePage(project: InkwellProject): InkwellProject {
  if (project.kind !== 'book') return project
  const titleMaster = findTitleMaster(project.chapters)
  if (!titleMaster) return project
  const extracted =
    extractBookTitleFromTitlePageManuscript(titleMaster) ??
    extractBookTitleFromTitlePageContent(titleMaster.content)?.trim() ??
    ''
  if (extracted === project.book.title.trim()) return project
  return { ...project, book: { ...project.book, title: extracted } }
}

export function hasStoredContentsMaster(project: InkwellProject): boolean {
  return findContentsMaster(project.chapters) != null
}

export function canDeleteMasterPage(m: Manuscript): boolean {
  return !isContentsPage(m)
}

/** Master rows must stay before the first body chapter. */
export function isValidMasterReorder(chapters: Manuscript[], draggedId: number, targetId: number): boolean {
  const dragged = chapters.find((c) => c.id === draggedId)
  const target = chapters.find((c) => c.id === targetId)
  if (!dragged || !target) return false
  if (!isMasterPage(dragged) && !isMasterPage(target)) return true
  if (!isMasterPage(dragged)) return false
  if (!isMasterPage(target)) return false
  const bodyStart = firstBodyIndex(chapters)
  const draggedIdx = chapters.findIndex((c) => c.id === draggedId)
  const targetIdx = chapters.findIndex((c) => c.id === targetId)
  if (draggedIdx < 0 || targetIdx < 0) return false
  if (isContentsPage(dragged)) {
    const newDraggedIdx = targetIdx
    return newDraggedIdx === bodyStart - 1
  }
  const newDraggedIdx = targetIdx
  return newDraggedIdx < bodyStart
}

function paragraph(text: string, attrs?: Record<string, unknown>): JSONContent {
  return {
    type: 'paragraph',
    ...(attrs ? { attrs } : {}),
    content: text ? [{ type: 'text', text }] : [],
  }
}

type ContentsEntry = {
  text: string
  chapterId?: number
}

function paragraphFromEntry(entry: ContentsEntry): JSONContent {
  if (!entry.text) return paragraph('')
  if (entry.chapterId == null) return paragraph(entry.text)
  return {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: entry.text,
        marks: [
          {
            type: 'link',
            attrs: { href: inkwellChapterLinkHref(entry.chapterId), target: null },
          },
        ],
      },
    ],
  }
}

function heading(level: 1 | 2, text: string): JSONContent {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

function centeredParagraph(text: string): JSONContent {
  return paragraph(text, { textAlign: 'center' })
}

function buildMasterTemplate(kind: MasterPageKind, book: BookMeta): JSONContent {
  const title = book.title?.trim() || 'Untitled'
  const subtitle = book.subtitle?.trim()
  const author = book.authorName?.trim() || 'Author Name'
  const year = String(new Date().getFullYear())
  const isbn = book.isbn?.trim()

  switch (kind) {
    case 'title_page':
      return {
        type: 'doc',
        content: [
          centeredParagraph(''),
          centeredParagraph(title),
          ...(subtitle ? [centeredParagraph(subtitle)] : []),
          centeredParagraph(''),
          centeredParagraph(author),
        ],
      }
    case 'copyright':
      return {
        type: 'doc',
        content: [
          paragraph(''),
          paragraph(`Copyright © ${year} by ${author}`),
          paragraph('All rights reserved.'),
          paragraph(
            'No part of this book may be reproduced or transmitted in any form without written permission from the publisher, except for brief quotations in reviews.',
          ),
          ...(isbn ? [paragraph(''), paragraph(`ISBN: ${isbn}`)] : []),
        ],
      }
    case 'dedication':
      return {
        type: 'doc',
        content: [centeredParagraph(''), centeredParagraph('For ______.')],
      }
    case 'epigraph':
      return {
        type: 'doc',
        content: [
          centeredParagraph(''),
          centeredParagraph('“Quote.”'),
          centeredParagraph('— Attribution'),
        ],
      }
    case 'disclaimer':
      return {
        type: 'doc',
        content: [
          heading(1, 'Disclaimer'),
          paragraph(
            'This is a work of fiction. Names, characters, places, and incidents are the product of the author’s imagination or are used fictitiously. Any resemblance to actual persons, living or dead, events, or locales is entirely coincidental.',
          ),
        ],
      }
    case 'foreword':
    case 'preface':
    case 'introduction':
    case 'acknowledgments': {
      const entry = catalogEntryForKind(kind)
      return {
        type: 'doc',
        content: [heading(1, entry?.defaultTitle ?? kind), paragraph('')],
      }
    }
    default:
      return emptyDoc()
  }
}

export type SyncContentsOptions = {
  pageByManuscriptId?: Map<number, number>
  contentWidthPt?: number
  font?: { widthOfTextAtSize: (t: string, s: number) => number }
  fontSizePt?: number
}

function masterPageTocLabel(m: Manuscript): string {
  return m.title?.trim() || catalogEntryForKind(m.masterKind!)?.defaultTitle || 'Untitled'
}

function buildContentsEntries(project: InkwellProject, opts?: SyncContentsOptions): ContentsEntry[] {
  const tocTitle = project.assembly.printTocTitle?.trim() || 'Contents'
  const entries: ContentsEntry[] = [{ text: tocTitle }, { text: '' }]
  const usePageNumbers =
    project.assembly.includePrintToc &&
    opts?.pageByManuscriptId != null &&
    opts.contentWidthPt != null &&
    opts.font != null &&
    opts.fontSizePt != null

  const bodyStart = firstBodyIndex(project.chapters)

  for (let i = 0; i < bodyStart; i++) {
    const m = project.chapters[i]!
    if (isContentsPage(m)) continue
    if (!isMasterPage(m) || m.masterKind === 'contents') continue
    entries.push({ text: masterPageTocLabel(m), chapterId: m.id })
  }

  let bodyN = 0
  for (const m of project.chapters) {
    const r = effectiveSectionRole(m)
    if (!includeInTocEntry(m)) continue
    if (matterKind(r) !== 'body') continue
    bodyN++
    const label = displayChapterLabel(project, m, bodyN)
    if (usePageNumbers) {
      const pg = opts!.pageByManuscriptId!.get(m.id)
      if (pg == null) continue
      entries.push({
        text: tocLineText(label, pg, opts!.contentWidthPt!, opts!.font!, opts!.fontSizePt!),
        chapterId: m.id,
      })
    } else {
      entries.push({ text: label, chapterId: m.id })
    }
  }
  return entries
}

function entriesToDoc(entries: ContentsEntry[]): JSONContent {
  return {
    type: 'doc',
    content: entries.map((entry) => paragraphFromEntry(entry)),
  }
}

export function buildContentsDoc(project: InkwellProject, opts?: SyncContentsOptions): JSONContent {
  return entriesToDoc(buildContentsEntries(project, opts))
}

/** Demote legacy user-authored toc sections so we do not duplicate the built-in Contents page. */
function demoteLegacyTocSections(chapters: Manuscript[]): Manuscript[] {
  let hasBuiltIn = false
  return chapters.map((m) => {
    if (isContentsPage(m)) {
      hasBuiltIn = true
      return m
    }
    if (effectiveSectionRole(m) === 'toc' && !m.masterKind) {
      if (hasBuiltIn) {
        return { ...m, sectionRole: 'other_front' as ManuscriptSectionRole, includeInPrintToc: false }
      }
      return {
        ...m,
        id: CONTENTS_MASTER_ID,
        masterKind: 'contents',
        sectionRole: 'toc',
        isSystemManaged: true,
        includeInPrintToc: false,
      }
    }
    return m
  })
}

export function ensureBuiltInContents(project: InkwellProject): InkwellProject {
  if (project.kind !== 'book') return project

  let chapters = demoteLegacyTocSections([...project.chapters])
  const bodyStart = firstBodyIndex(chapters)
  if (bodyStart >= chapters.length) {
    return { ...project, chapters }
  }

  if (findContentsMaster(chapters)) {
    return syncContentsManuscript({ ...project, chapters })
  }

  const tocTitle = project.assembly.printTocTitle?.trim() || 'Contents'
  const contents: Manuscript = {
    id: CONTENTS_MASTER_ID,
    title: tocTitle,
    masterKind: 'contents',
    sectionRole: 'toc',
    isSystemManaged: true,
    includeInPrintToc: false,
    includeInPrint: true,
    includeInEpub: true,
    content: emptyDoc(),
  }

  chapters.splice(bodyStart, 0, contents)
  return syncContentsManuscript({ ...project, chapters })
}

/** Refresh title page body from book meta (e.g. BookTools). Preserves the section title label. */
export function syncTitlePageContentFromBook(project: InkwellProject): InkwellProject {
  if (project.kind !== 'book') return project
  const titleMaster = findTitleMaster(project.chapters)
  if (!titleMaster) return project
  const content = buildMasterTemplate('title_page', project.book)
  const chapters = project.chapters.map((m) =>
    m.masterKind === 'title_page' || m.id === TITLE_MASTER_ID ? { ...m, content } : m,
  )
  return { ...project, chapters }
}

/** Seed new books only — not called from applyBookMasterPages (legacy books unchanged). */
export function ensureBuiltInTitlePage(project: InkwellProject): InkwellProject {
  if (project.kind !== 'book') return project
  if (findTitleMaster(project.chapters)) return project

  const entry = catalogEntryForKind('title_page')
  const titlePage: Manuscript = {
    id: TITLE_MASTER_ID,
    title: entry?.defaultTitle ?? 'Title page',
    masterKind: 'title_page',
    sectionRole: 'title_page',
    includeInPrint: true,
    includeInEpub: true,
    includeInPrintToc: false,
    content: buildMasterTemplate('title_page', project.book),
  }

  return { ...project, chapters: [titlePage, ...project.chapters] }
}

export function syncContentsManuscript(project: InkwellProject, opts?: SyncContentsOptions): InkwellProject {
  if (project.kind !== 'book') return project
  const contents = findContentsMaster(project.chapters)
  if (!contents) return project

  const tocTitle = project.assembly.printTocTitle?.trim() || 'Contents'
  const content = buildContentsDoc(project, opts)
  const chapters = project.chapters.map((m) =>
    isContentsPage(m) ? { ...m, title: tocTitle, content } : m,
  )
  return { ...project, chapters }
}

export function applyBookMasterPages(project: InkwellProject, opts?: SyncContentsOptions): InkwellProject {
  if (project.kind !== 'book') return project
  return syncContentsManuscript(ensureBuiltInContents(project), opts)
}

export function nextOptionalMasterId(chapters: Manuscript[]): number {
  const positive = chapters.filter((c) => c.id > 0).map((c) => c.id)
  const max = positive.length > 0 ? Math.max(...positive) : 0
  return max + 1
}

export function addOptionalMasterPage(
  project: InkwellProject,
  kind: MasterPageKind,
): { project: InkwellProject; added: boolean; reason?: string } {
  if (project.kind !== 'book') return { project, added: false, reason: 'not_a_book' }
  if (kind === 'contents') return { project, added: false, reason: 'contents_builtin' }
  if (!ADDABLE_KINDS.has(kind)) return { project, added: false, reason: 'not_addable' }

  const entry = catalogEntryForKind(kind)
  if (!entry) return { project, added: false, reason: 'unknown_kind' }

  const existing = project.chapters.some((m) => m.masterKind === kind)
  if (existing) return { project, added: false, reason: 'duplicate' }

  const withContents = ensureBuiltInContents(project)
  const chapters = [...withContents.chapters]
  const insertAt = Math.max(1, firstBodyIndex(chapters))

  const manuscript: Manuscript = {
    id: nextOptionalMasterId(chapters),
    title: entry.defaultTitle,
    masterKind: kind,
    sectionRole: entry.sectionRole,
    includeInPrint: true,
    includeInEpub: true,
    includeInPrintToc: false,
    content: buildMasterTemplate(kind, withContents.book),
  }

  chapters.splice(insertAt, 0, manuscript)
  return { project: syncContentsManuscript({ ...withContents, chapters }), added: true }
}

export type PartitionedChapters = {
  masterPages: Manuscript[]
  bodyChapters: Manuscript[]
}

export function partitionChaptersForSidebar(chapters: Manuscript[]): PartitionedChapters {
  const bodyStart = firstBodyIndex(chapters)
  const masterPages = chapters.slice(0, bodyStart)
  const bodyChapters = chapters.slice(bodyStart)
  return { masterPages, bodyChapters }
}

export function listAddableMasterKinds(project: InkwellProject): MasterPageCatalogEntry[] {
  const present = new Set(project.chapters.map((m) => m.masterKind).filter(Boolean))
  return MASTER_PAGE_CATALOG.filter(
    (e) => e.addableFromContents && e.kind !== 'contents' && !present.has(e.kind),
  )
}
