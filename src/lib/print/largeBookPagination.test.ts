import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { paginateSpineWithFont } from './paginate'
import { defaultTheme, type Manuscript } from '../../types'

const fakeFont = {
  widthOfTextAtSize: (text: string, size: number) =>
    Math.min(8000, [...text].length * size * 0.52),
}

const shortDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Short section body for pagination harness.' }],
    },
  ],
}

describe('paginateSpineWithFont large spine', () => {
  it('invokes onChapterComplete once per manuscript (progressive full-book layout)', async () => {
    const n = 22
    const spine: Manuscript[] = Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      title: `Chapter ${i + 1}`,
      sectionRole: 'chapter' as const,
      content: shortDoc,
    }))
    const theme = {
      ...defaultTheme(),
      print: {
        ...defaultTheme().print,
        chapterOpener: 'off' as const,
        avoidShortParagraphSplit: false,
        avoidLonelyHeading: false,
        hyphenation: false,
      },
    }
    let progress = 0
    await paginateSpineWithFont(spine, theme, fakeFont, undefined, {
      onChapterComplete: () => {
        progress += 1
      },
    })
    expect(progress).toBe(n)
  })

  it('finishes multi-chapter spine within a reasonable wall time (regression guard)', async () => {
    const spine: Manuscript[] = Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      title: `C${i + 1}`,
      sectionRole: 'chapter' as const,
      content: shortDoc,
    }))
    const theme = {
      ...defaultTheme(),
      print: {
        ...defaultTheme().print,
        chapterOpener: 'off' as const,
        avoidShortParagraphSplit: false,
        avoidLonelyHeading: false,
        hyphenation: false,
      },
    }
    const t0 = performance.now()
    const pages = await paginateSpineWithFont(spine, theme, fakeFont)
    const ms = performance.now() - t0
    expect(pages.length).toBeGreaterThan(0)
    expect(ms).toBeLessThan(120_000)
  })
})
