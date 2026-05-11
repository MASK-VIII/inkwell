import { describe, expect, it } from 'vitest'
import {
  computePrintAssemblyKey,
  computePrintLayoutBasisKey,
  computePrintLayoutBasisParts,
} from './printLayoutBasis'
import {
  defaultBookAssembly,
  defaultBookMeta,
  defaultTheme,
  defaultWritingGoals,
  type InkwellProject,
  type Manuscript,
} from '../../types'

function minimalProject(chapters: Manuscript[]): InkwellProject {
  return {
    version: 3,
    id: 'basis-test',
    kind: 'book',
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters,
    theme: defaultTheme(),
    assembly: defaultBookAssembly(),
    seriesBible: [],
  }
}

describe('computePrintLayoutBasisParts', () => {
  it('combinedKey matches computePrintLayoutBasisKey', () => {
    const p = minimalProject([
      { id: 1, title: 'A', content: { type: 'doc', content: [] } },
    ])
    const theme = defaultTheme()
    const parts = computePrintLayoutBasisParts(p, theme)
    expect(parts.combinedKey).toBe(computePrintLayoutBasisKey(p, theme))
    expect(parts.themeKey.length).toBeGreaterThan(0)
    expect(parts.contentKey.length).toBeGreaterThan(0)
    expect(parts.assemblyKey.length).toBeGreaterThan(0)
    expect(parts.bookMetaKey.length).toBeGreaterThan(0)
  })

  it('assemblyKey changes when chapter order changes without touching bodies', () => {
    const mk = (id: number): Manuscript => ({
      id,
      title: `T${id}`,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
    })
    const a = minimalProject([mk(1), mk(2)])
    const b = minimalProject([mk(2), mk(1)])
    expect(computePrintAssemblyKey(a)).not.toBe(computePrintAssemblyKey(b))
  })
})
