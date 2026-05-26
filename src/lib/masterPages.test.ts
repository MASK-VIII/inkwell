import { describe, expect, it } from 'vitest'
import { insertPrintTocInSpine, manuscriptsForPrint } from './bookAssembly'
import {
  addOptionalMasterPage,
  applyBookMasterPages,
  buildContentsDoc,
  canDeleteMasterPage,
  CONTENTS_MASTER_ID,
  ensureBuiltInContents,
  ensureBuiltInTitlePage,
  findContentsMaster,
  findTitleMaster,
  hasStoredContentsMaster,
  inkwellChapterLinkHref,
  isValidMasterReorder,
  syncContentsManuscript,
  syncTitlePageContentFromBook,
  syncBookMetaFromTitlePage,
  TITLE_MASTER_ID,
} from './masterPages'
import { defaultBookAssembly, defaultBookMeta, defaultTheme, defaultWritingGoals } from '../types'
import type { InkwellProject, Manuscript } from '../types'

function bookProject(chapters: Manuscript[]): InkwellProject {
  return {
    version: 3,
    id: 'test-book',
    kind: 'book',
    linkedBookId: null,
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters,
    theme: defaultTheme(),
    assembly: defaultBookAssembly(),
    seriesBible: [],
  }
}

describe('masterPages', () => {
  it('ensureBuiltInContents inserts before first body chapter when body exists', () => {
    const p = bookProject([{ id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } }])
    const once = ensureBuiltInContents(p)
    const twice = ensureBuiltInContents(once)
    expect(twice.chapters[0]?.id).toBe(CONTENTS_MASTER_ID)
    expect(twice.chapters[0]?.masterKind).toBe('contents')
    expect(twice.chapters[1]?.title).toBe('Chapter 1')
    expect(twice.chapters.filter((c) => c.id === CONTENTS_MASTER_ID).length).toBe(1)
    expect(twice.chapters.length).toBe(once.chapters.length)
  })

  it('ensureBuiltInContents defers until a body chapter exists', () => {
    const withTitle = ensureBuiltInTitlePage(bookProject([]))
    expect(findTitleMaster(withTitle.chapters)).toBeDefined()
    expect(findContentsMaster(ensureBuiltInContents(withTitle).chapters)).toBeUndefined()
    const withBody = {
      ...withTitle,
      chapters: [
        ...withTitle.chapters,
        { id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } },
      ],
    }
    expect(findContentsMaster(ensureBuiltInContents(withBody).chapters)).toBeDefined()
  })

  it('applyBookMasterPages preserves user-edited title page section label', () => {
    const withTitle = ensureBuiltInTitlePage(
      bookProject([{ id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } }]),
    )
    const renamed = {
      ...withTitle,
      chapters: withTitle.chapters.map((m) =>
        m.id === TITLE_MASTER_ID ? { ...m, title: 'My Title Page' } : m,
      ),
    }
    const after = applyBookMasterPages(renamed)
    expect(after.chapters.find((m) => m.id === TITLE_MASTER_ID)?.title).toBe('My Title Page')
  })

  it('syncBookMetaFromTitlePage prefers on-page section title over body text', () => {
    const withTitle = ensureBuiltInTitlePage(bookProject([]))
    const customized = {
      ...withTitle,
      book: { ...withTitle.book, title: 'Substack Series' },
      chapters: withTitle.chapters.map((m) =>
        m.id === TITLE_MASTER_ID
          ? {
              ...m,
              title: 'Donnie Fuckhead',
              content: {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    attrs: { textAlign: 'center' },
                    content: [{ type: 'text', text: 'Substack Series' }],
                  },
                  {
                    type: 'paragraph',
                    attrs: { textAlign: 'center' },
                    content: [{ type: 'text', text: 'Steven Spacek Jr' }],
                  },
                ],
              },
            }
          : m,
      ),
    }
    const synced = syncBookMetaFromTitlePage(customized)
    expect(synced.book.title).toBe('Donnie Fuckhead')
  })

  it('syncBookMetaFromTitlePage falls back to body when section label is still default', () => {
    const withTitle = ensureBuiltInTitlePage(bookProject([]))
    const customized = {
      ...withTitle,
      chapters: withTitle.chapters.map((m) =>
        m.id === TITLE_MASTER_ID
          ? {
              ...m,
              content: {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    attrs: { textAlign: 'center' },
                    content: [{ type: 'text', text: 'My Novel' }],
                  },
                ],
              },
            }
          : m,
      ),
    }
    const synced = syncBookMetaFromTitlePage(customized)
    expect(synced.book.title).toBe('My Novel')
  })

  it('syncTitlePageContentFromBook refreshes body from book meta without resetting section label', () => {
    const withTitle = ensureBuiltInTitlePage(bookProject([]))
    const customized = {
      ...withTitle,
      book: { ...withTitle.book, title: 'My Novel', authorName: 'Jane Doe' },
      chapters: withTitle.chapters.map((m) =>
        m.id === TITLE_MASTER_ID ? { ...m, title: 'Front' } : m,
      ),
    }
    const synced = syncTitlePageContentFromBook(customized)
    expect(synced.chapters.find((m) => m.id === TITLE_MASTER_ID)?.title).toBe('Front')
    const body = JSON.stringify(synced.chapters.find((m) => m.id === TITLE_MASTER_ID)?.content)
    expect(body).toContain('My Novel')
    expect(body).toContain('Jane Doe')
  })

  it('seeded new books get Title, Contents, then body chapters', () => {
    const withTitle = ensureBuiltInTitlePage(
      bookProject([{ id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } }]),
    )
    const seeded = applyBookMasterPages(withTitle)
    expect(seeded.chapters[0]?.id).toBe(TITLE_MASTER_ID)
    expect(seeded.chapters[1]?.id).toBe(CONTENTS_MASTER_ID)
    expect(seeded.chapters[2]?.title).toBe('Chapter 1')
    const toc = JSON.stringify(findContentsMaster(seeded.chapters)?.content)
    expect(toc).toContain('Chapter 1')
  })

  it('syncContentsManuscript lists optional front matter before body chapters', () => {
    const base = applyBookMasterPages(bookProject([{ id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } }]))
    const { project: withFront } = addOptionalMasterPage(base, 'copyright')
    const synced = syncContentsManuscript(withFront)
    const text = JSON.stringify(findContentsMaster(synced.chapters)?.content)
    expect(text).toContain('Copyright')
    expect(text).toContain('Chapter 1')
    const copyrightPos = text.indexOf('Copyright')
    const chapterPos = text.indexOf('Chapter 1')
    expect(copyrightPos).toBeGreaterThan(-1)
    expect(chapterPos).toBeGreaterThan(copyrightPos)
  })

  it('buildContentsDoc links body and front matter lines to chapter ids', () => {
    const base = applyBookMasterPages(
      bookProject([
        { id: 1, title: 'Alpha', content: { type: 'doc', content: [] } },
        { id: 2, title: 'Beta', content: { type: 'doc', content: [] } },
      ]),
    )
    const { project: withFront } = addOptionalMasterPage(base, 'disclaimer')
    const doc = buildContentsDoc(withFront)
    const json = JSON.stringify(doc)
    expect(json).toContain(inkwellChapterLinkHref(2))
    expect(json).toContain(inkwellChapterLinkHref(1))
    const disclaimerEntry = withFront.chapters.find((m) => m.masterKind === 'disclaimer')
    expect(disclaimerEntry).toBeDefined()
    expect(json).toContain(inkwellChapterLinkHref(disclaimerEntry!.id))
  })

  it('syncContentsManuscript reflects new and renamed body chapters', () => {
    const p = applyBookMasterPages(
      bookProject([
        { id: 1, title: 'Alpha', content: { type: 'doc', content: [] } },
        { id: 2, title: 'Beta', content: { type: 'doc', content: [] } },
      ]),
    )
    const synced = syncContentsManuscript(p)
    const text = JSON.stringify(findContentsMaster(synced.chapters)?.content)
    expect(text).toContain('Alpha')
    expect(text).toContain('Beta')

    const renamed = syncContentsManuscript({
      ...synced,
      chapters: synced.chapters.map((m) => (m.id === 1 ? { ...m, title: 'Gamma' } : m)),
    })
    const text2 = JSON.stringify(findContentsMaster(renamed.chapters)?.content)
    expect(text2).toContain('Gamma')
    expect(text2).not.toContain('Alpha')
  })

  it('addOptionalMasterPage inserts before first body chapter', () => {
    const base = applyBookMasterPages(bookProject([{ id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } }]))
    const { project: withCopyright, added } = addOptionalMasterPage(base, 'copyright')
    expect(added).toBe(true)
    const copyrightIdx = withCopyright.chapters.findIndex((m) => m.masterKind === 'copyright')
    const bodyIdx = withCopyright.chapters.findIndex((m) => m.id === 1)
    expect(copyrightIdx).toBeGreaterThan(0)
    expect(copyrightIdx).toBeLessThan(bodyIdx)
  })

  it('prevents duplicate optional master kinds', () => {
    const base = applyBookMasterPages(bookProject([{ id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } }]))
    const first = addOptionalMasterPage(base, 'copyright')
    const second = addOptionalMasterPage(first.project, 'copyright')
    expect(second.added).toBe(false)
    expect(second.reason).toBe('duplicate')
  })

  it('guards delete and reorder for built-in Contents', () => {
    const p = applyBookMasterPages(
      bookProject([
        { id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } },
        { id: 2, title: 'Chapter 2', content: { type: 'doc', content: [] } },
      ]),
    )
    const contents = findContentsMaster(p.chapters)!
    expect(canDeleteMasterPage(contents)).toBe(false)
    expect(isValidMasterReorder(p.chapters, CONTENTS_MASTER_ID, 1)).toBe(false)
    expect(isValidMasterReorder(p.chapters, 1, 2)).toBe(true)
  })

  it('does not insert synthetic print TOC when stored Contents exists', () => {
    const p = applyBookMasterPages(
      bookProject([{ id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } }]),
    )
    expect(hasStoredContentsMaster(p)).toBe(true)
    const spine = manuscriptsForPrint(p)
    const synthetic = {
      id: -9001,
      title: 'Contents',
      sectionRole: 'toc' as const,
      content: { type: 'doc' as const, content: [] },
    }
    const merged = insertPrintTocInSpine(p, spine, synthetic)
    expect(merged.filter((m) => m.sectionRole === 'toc').length).toBe(1)
    expect(merged.some((m) => m.id === CONTENTS_MASTER_ID)).toBe(true)
    expect(merged.some((m) => m.id === -9001)).toBe(false)
  })
})
