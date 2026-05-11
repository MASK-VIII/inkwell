import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { printSpineBaseForExport } from '../bookAssembly'
import { extractPrintBlocks } from './extractBlocks'
import { paginateProjectForPrintExport } from './paginate'
import {
  defaultBookAssembly,
  defaultBookMeta,
  defaultTheme,
  defaultWritingGoals,
  type InkwellProject,
  type Manuscript,
} from '../../types'

function paraDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }
}

function minimalManuscript(id: number, title: string, text: string): Manuscript {
  return {
    id,
    title,
    sectionRole: 'chapter',
    content: paraDoc(text),
  }
}

/** Deterministic width curve so pagination runs without embedding PDF fonts. */
const fakeFont = {
  widthOfTextAtSize: (text: string, size: number) =>
    Math.min(8000, [...text].length * size * 0.52),
}

function baseProject(printPatch?: Partial<InkwellProject['theme']['print']>): InkwellProject {
  const th = defaultTheme()
  const filler = `${'Word '.repeat(500)} end.`
  return {
    version: 3,
    id: 'test-print',
    kind: 'book',
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters: [minimalManuscript(1, 'Chapter One', filler), minimalManuscript(2, 'Chapter Two', filler)],
    theme: {
      ...th,
      print: {
        ...th.print,
        avoidShortParagraphSplit: false,
        avoidLonelyHeading: false,
        ...printPatch,
      },
    },
    assembly: { ...defaultBookAssembly(), includePrintToc: false },
    seriesBible: [],
  }
}

function countBlankPages(pages: { isBlank: boolean }[]) {
  return pages.filter((p) => p.isBlank).length
}

describe('printSpineBaseForExport', () => {
  it('excludes manuscripts with includeInPrint false', () => {
    const p = baseProject()
    p.chapters = [
      { ...minimalManuscript(1, 'A', 'x'), includeInPrint: true },
      { ...minimalManuscript(2, 'B', 'y'), includeInPrint: false },
    ]
    expect(printSpineBaseForExport(p).map((m) => m.id)).toEqual([1])
  })
})

describe('paginateProjectForPrintExport', () => {
  it('uses no more blank recto sheets when chapterStartsOn is either than when right', async () => {
    const right = await paginateProjectForPrintExport(
      baseProject({ chapterStartsOn: 'right' }),
      fakeFont,
    )
    const either = await paginateProjectForPrintExport(
      baseProject({ chapterStartsOn: 'either' }),
      fakeFont,
    )
    expect(countBlankPages(either)).toBeLessThanOrEqual(countBlankPages(right))
  })

  it('paginates with printable TOC enabled', async () => {
    const p = baseProject()
    p.assembly.includePrintToc = true
    const pages = await paginateProjectForPrintExport(p, fakeFont)
    expect(pages.length).toBeGreaterThan(0)
  })

  it('keeps ligature-prone words intact on body lines', async () => {
    const p = baseProject()
    p.chapters = [minimalManuscript(1, 'Chapter One', "That's right! She finishes her work.")]
    const pages = await paginateProjectForPrintExport(p, fakeFont)
    const bodyText = pages
      .flatMap((pg) => pg.lines)
      .filter((l) => l.kind === 'body')
      .map((l) => l.text)
      .join('\n')
    expect(bodyText).toContain('finishes')
  })

  it('paginates a chapter containing fictitious without throwing', async () => {
    const p = baseProject()
    p.chapters = [
      minimalManuscript(1, 'Chapter One', 'A fictitious opening line with enough words to wrap.'),
    ]
    const pages = await paginateProjectForPrintExport(p, fakeFont)
    expect(pages.length).toBeGreaterThan(0)
    const bodyText = pages
      .flatMap((pg) => pg.lines)
      .filter((l) => l.kind === 'body')
      .map((l) => l.text)
      .join('\n')
    expect(bodyText).toContain('fictitious')
  })

  it('does not insert a gap between adjacent styled fragments (e.g. bold F + normal ire → Fire)', async () => {
    const p = baseProject()
    p.chapters = [
      {
        ...minimalManuscript(1, 'Chapter One', ''),
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'a ' },
                { type: 'text', text: 'F', marks: [{ type: 'bold' }] },
                { type: 'text', text: 'ire' },
                { type: 'text', text: ' here' },
              ],
            },
          ],
        },
      },
    ]
    const pages = await paginateProjectForPrintExport(p, fakeFont)
    const line = pages
      .flatMap((pg) => pg.lines)
      .filter((l) => l.kind === 'body')
      .find((l) => l.text.includes('Fire') && l.textRuns && l.textRuns.length > 1)
    expect(line).toBeTruthy()
    expect(line!.text).not.toContain('F ire')
    const runs = line!.textRuns!
    const iF = runs.findIndex((r) => r.text === 'F')
    const iIre = runs.findIndex((r) => r.text === 'ire')
    expect(iF).toBeGreaterThanOrEqual(0)
    expect(iIre).toBe(iF + 1)
  })

  it('paginates inline bold using textRuns', async () => {
    const p = baseProject()
    p.chapters = [
      {
        ...minimalManuscript(1, 'Chapter One', ''),
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Plain ' },
                { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
              ],
            },
          ],
        },
      },
    ]
    const pages = await paginateProjectForPrintExport(p, fakeFont)
    const hasBoldRun = pages.some((pg) =>
      pg.lines.some((l) => l.kind === 'body' && l.textRuns?.some((r) => r.bold)),
    )
    expect(hasBoldRun).toBe(true)
  })
})

describe('extractPrintBlocks inline styles', () => {
  it('treats legacy strong / em marks like bold / italic', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'A ', marks: [{ type: 'strong' }] },
            { type: 'text', text: 'B', marks: [{ type: 'em' }] },
          ],
        },
      ],
    }
    const blocks = extractPrintBlocks(doc)
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para?.runs?.some((r) => r.bold && r.text.includes('A'))).toBe(true)
    expect(para?.runs?.some((r) => r.italic && r.text === 'B')).toBe(true)
  })

  it('preserves bold marks as runs', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hi ' },
            { type: 'text', text: 'there', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    }
    const blocks = extractPrintBlocks(doc)
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para?.runs?.some((r) => r.bold && r.text.includes('there'))).toBe(true)
  })
})
