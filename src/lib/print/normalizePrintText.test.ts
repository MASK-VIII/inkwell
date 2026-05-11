import { describe, expect, it } from 'vitest'
import { breakOptionalLigaturesForPrint } from './normalizePrintText'

const ZWNJ = '\u200c'

describe('breakOptionalLigaturesForPrint', () => {
  it('inserts ZWNJ after leading f before i in fictitious', () => {
    const out = breakOptionalLigaturesForPrint('fictitious')
    expect(out).toBe(`f${ZWNJ}ictitious`)
  })

  it('expands compatibility ligature U+FB01 then breaks cluster', () => {
    const out = breakOptionalLigaturesForPrint('\ufb01lm')
    expect(out).toBe(`f${ZWNJ}ilm`)
  })

  it('expands all U+FB00–U+FB04', () => {
    expect(breakOptionalLigaturesForPrint('\ufb00')).toBe(`f${ZWNJ}f`)
    expect(breakOptionalLigaturesForPrint('\ufb02')).toBe(`f${ZWNJ}l`)
    expect(breakOptionalLigaturesForPrint('\ufb03')).toBe(`f${ZWNJ}f${ZWNJ}i`)
    expect(breakOptionalLigaturesForPrint('\ufb04')).toBe(`f${ZWNJ}f${ZWNJ}l`)
  })

  it('leaves text without f-before-f/i/l clusters unchanged', () => {
    expect(breakOptionalLigaturesForPrint('hello world')).toBe('hello world')
    expect(breakOptionalLigaturesForPrint('café')).toBe('café')
  })

  it('applies NFC before processing', () => {
    const eAcuteNFD = 'caf\u0065\u0301'
    expect(breakOptionalLigaturesForPrint(eAcuteNFD)).toBe('café')
  })
})
