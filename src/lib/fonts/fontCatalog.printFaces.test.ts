import { describe, expect, it } from 'vitest'
import { getPrintFaceAvailability } from './fontCatalog'

describe('getPrintFaceAvailability', () => {
  it('reports full faces for DejaVu Serif', () => {
    const f = getPrintFaceAvailability('dejavu_serif')
    expect(f.hasDedicatedBold).toBe(true)
    expect(f.hasDedicatedItalic).toBe(true)
    expect(f.hasDedicatedBoldItalic).toBe(true)
  })

  it('reports missing bold and italic for Great Vibes', () => {
    const f = getPrintFaceAvailability('great_vibes')
    expect(f.hasDedicatedBold).toBe(false)
    expect(f.hasDedicatedItalic).toBe(false)
  })

  it('reports Cinzel has bold but no italic file', () => {
    const f = getPrintFaceAvailability('cinzel')
    expect(f.hasDedicatedBold).toBe(true)
    expect(f.hasDedicatedItalic).toBe(false)
  })
})
