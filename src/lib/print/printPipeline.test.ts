import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { extractPrintBlocks } from './extractBlocks'
import { paginateChapterWithFont } from './paginate'
import { defaultTheme } from '../../types'
import {
  aliasMarkDoc,
  headingItalicDoc,
  listStyledDoc,
  styledParagraphDoc,
  underlineParagraphDoc,
  wrapperBoldNodeDoc,
} from './__fixtures__/styledPipelineDocs'

const fakeFont = {
  widthOfTextAtSize: (text: string, size: number) =>
    Math.min(8000, [...text].length * size * 0.52),
}

const baseTh = defaultTheme()
const fakeTheme = {
  ...baseTh,
  print: {
    ...baseTh.print,
    chapterOpener: 'off' as const,
    avoidShortParagraphSplit: false,
    avoidLonelyHeading: false,
    hyphenation: false,
  },
}

function minimalChapter(id: number, title: string, content: JSONContent) {
  return {
    id,
    title,
    sectionRole: 'chapter' as const,
    content,
  }
}

describe('print pipeline extract → paginate (diagnostics)', () => {
  it('preserves bold and italic marks through blocks and PrintLine.textRuns', async () => {
    const blocks = extractPrintBlocks(styledParagraphDoc)
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para?.runs?.some((r) => r.bold && r.text.includes('Bold'))).toBe(true)
    expect(para?.runs?.some((r) => r.italic && r.text.includes('Italic'))).toBe(true)

    const ch = minimalChapter(1, 'One', styledParagraphDoc)
    const res = await paginateChapterWithFont(ch, 0, fakeTheme, fakeFont, 1, undefined, 'chapter', 1)
    const bodyLines = res.pages.flatMap((p) => p.lines).filter((l) => l.kind === 'body')
    const styled = bodyLines.find((l) => l.textRuns?.some((tr) => tr.bold) && l.textRuns.some((tr) => tr.italic))
    expect(styled).toBeTruthy()
    expect(styled!.textRuns!.some((tr) => tr.bold)).toBe(true)
    expect(styled!.textRuns!.some((tr) => tr.italic)).toBe(true)
  })

  it('maps b / i marks to bold / italic runs', () => {
    const blocks = extractPrintBlocks(aliasMarkDoc)
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para?.runs?.some((r) => r.bold && r.text.includes('X'))).toBe(true)
    expect(para?.runs?.some((r) => r.italic && r.text.includes('Y'))).toBe(true)
  })

  it('inherits bold from wrapper bold nodes onto plain text children', () => {
    const blocks = extractPrintBlocks(wrapperBoldNodeDoc)
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para?.runs?.some((r) => r.bold && r.text.includes('WrappedBold'))).toBe(true)
  })

  it('carries underline through to paginated textRuns', async () => {
    const blocks = extractPrintBlocks(underlineParagraphDoc)
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para?.runs?.some((r) => r.underline)).toBe(true)

    const ch = minimalChapter(1, 'One', underlineParagraphDoc)
    const res = await paginateChapterWithFont(ch, 0, fakeTheme, fakeFont, 1, undefined, 'chapter', 1)
    const u = res.pages
      .flatMap((p) => p.lines)
      .flatMap((l) => l.textRuns ?? [])
      .some((tr) => tr.underline)
    expect(u).toBe(true)
  })

  it('styled bullet list paragraph yields textRuns with bold', async () => {
    const blocks = extractPrintBlocks(listStyledDoc)
    expect(blocks.some((b) => b.type === 'paragraph' && b.runs?.some((r) => r.bold))).toBe(true)

    const ch = minimalChapter(1, 'One', listStyledDoc)
    const res = await paginateChapterWithFont(ch, 0, fakeTheme, fakeFont, 1, undefined, 'chapter', 1)
    const hasBoldRun = res.pages.some((p) =>
      p.lines.some((l) => l.kind === 'body' && l.textRuns?.some((tr) => tr.bold)),
    )
    expect(hasBoldRun).toBe(true)
  })

  it('styled heading yields italic textRuns', async () => {
    const blocks = extractPrintBlocks(headingItalicDoc)
    const h = blocks.find((b) => b.type === 'heading')
    expect(h?.runs?.some((r) => r.italic)).toBe(true)

    const ch = minimalChapter(1, 'One', headingItalicDoc)
    const res = await paginateChapterWithFont(ch, 0, fakeTheme, fakeFont, 1, undefined, 'chapter', 1)
    const hasItalic = res.pages.some((p) =>
      p.lines.some((l) => l.kind === 'body' && l.textRuns?.some((tr) => tr.italic)),
    )
    expect(hasItalic).toBe(true)
  })
})
