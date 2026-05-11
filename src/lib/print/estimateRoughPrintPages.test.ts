import { describe, expect, it } from 'vitest'
import type { Manuscript, PrintTheme } from '../../types'
import { defaultTheme } from '../../types'
import {
  estimateRoughPrintInteriorPages,
  roughInteriorPagesForWordCount,
  roughPrintStartPageForSpineIndex,
} from './estimateRoughPrintPages'

const print: PrintTheme = defaultTheme().print

function docWithWords(n: number) {
  const text = Array.from({ length: n }, () => 'word').join(' ')
  return {
    type: 'doc' as const,
    content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] }],
  }
}

function fakeMs(id: number, wordCount: number): Manuscript {
  return {
    id,
    title: `M${id}`,
    sectionRole: 'chapter',
    content: docWithWords(wordCount),
    includeInPrint: true,
    includeInPrintToc: true,
  }
}

describe('roughInteriorPagesForWordCount', () => {
  it('returns at least 1 for zero words', () => {
    expect(roughInteriorPagesForWordCount(0, print)).toBe(1)
  })
})

describe('estimateRoughPrintInteriorPages', () => {
  it('matches sum of per-manuscript rough pages for disjoint manuscripts', () => {
    const a = fakeMs(1, 500)
    const b = fakeMs(2, 300)
    const combined = estimateRoughPrintInteriorPages([a, b], print)
    const sum =
      roughInteriorPagesForWordCount(500, print) + roughInteriorPagesForWordCount(300, print)
    expect(combined).toBe(sum)
  })
})

describe('roughPrintStartPageForSpineIndex', () => {
  it('returns 1 for first section', () => {
    const spine = [fakeMs(1, 100), fakeMs(2, 200)]
    expect(roughPrintStartPageForSpineIndex(spine, 0, print)).toBe(1)
  })

  it('adds prior rough page counts', () => {
    const spine = [fakeMs(1, 500), fakeMs(2, 300), fakeMs(3, 100)]
    const p0 = roughInteriorPagesForWordCount(500, print)
    expect(roughPrintStartPageForSpineIndex(spine, 1, print)).toBe(1 + p0)
    expect(roughPrintStartPageForSpineIndex(spine, 2, print)).toBe(
      1 + p0 + roughInteriorPagesForWordCount(300, print),
    )
  })
})
