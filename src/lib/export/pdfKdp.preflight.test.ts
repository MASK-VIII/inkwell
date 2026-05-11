import { describe, expect, it } from 'vitest'
import { validateKdpPdfProject } from './pdfKdp'
import {
  defaultBookAssembly,
  defaultBookMeta,
  defaultTheme,
  defaultWritingGoals,
  type InkwellProject,
} from '../../types'

function baseProject(): InkwellProject {
  return {
    version: 3,
    id: 'preflight',
    kind: 'book',
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters: [],
    theme: defaultTheme(),
    assembly: defaultBookAssembly(),
    seriesBible: [],
  }
}

describe('validateKdpPdfProject', () => {
  it('accepts default theme', () => {
    expect(() => validateKdpPdfProject(baseProject())).not.toThrow()
  })

  it('rejects negative bleed', () => {
    const p = baseProject()
    p.theme = { ...p.theme, print: { ...p.theme.print, bleedIn: -0.1 } }
    expect(() => validateKdpPdfProject(p)).toThrow(/bleed/i)
  })
})
