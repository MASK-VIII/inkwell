import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { extractPrintBlocks } from '../print/extractBlocks'
import { paginateProjectForPrintExport } from '../print/paginate'
import {
  defaultBookAssembly,
  defaultBookMeta,
  defaultTheme,
  defaultWritingGoals,
  type InkwellProject,
  type Manuscript,
} from '../../types'

function minimalManuscript(id: number, title: string, content: JSONContent): Manuscript {
  return {
    id,
    title,
    sectionRole: 'chapter',
    content,
  }
}

const fakeFont = {
  widthOfTextAtSize: (text: string, size: number) =>
    Math.min(8000, [...text].length * size * 0.52),
}

function minimalProject(chapters: Manuscript[]): InkwellProject {
  const th = defaultTheme()
  return {
    version: 3,
    id: 'pdf-tr-test',
    kind: 'book',
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters,
    theme: {
      ...th,
      print: {
        ...th.print,
        avoidShortParagraphSplit: false,
        avoidLonelyHeading: false,
      },
    },
    assembly: { ...defaultBookAssembly(), includePrintToc: false },
    seriesBible: [],
  }
}

describe('print PDF pipeline styled runs', () => {
  it('extractPrintBlocks preserves bold + italic for pagination', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Plain ' },
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'Ital', marks: [{ type: 'em' }] },
          ],
        },
      ],
    }
    const blocks = extractPrintBlocks(doc)
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para?.runs?.some((r) => r.bold && r.text.includes('Bold'))).toBe(true)
    expect(para?.runs?.some((r) => r.italic && r.text.includes('Ital'))).toBe(true)
  })

  it('paginateProjectForPrintExport emits body lines with textRuns for mixed styles', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'A ' },
            { type: 'text', text: 'B', marks: [{ type: 'strong' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'C', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    }
    const project = minimalProject([minimalManuscript(1, 'One', doc)])
    const pages = await paginateProjectForPrintExport(project, fakeFont)
    const bodyLine = pages
      .flatMap((p) => p.lines)
      .find((l) => l.kind === 'body' && l.textRuns && l.textRuns.length > 1)
    expect(bodyLine).toBeTruthy()
    expect(bodyLine!.textRuns!.some((r) => r.bold)).toBe(true)
    expect(bodyLine!.textRuns!.some((r) => r.italic)).toBe(true)
  })
})
