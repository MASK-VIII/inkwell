import { describe, expect, it } from 'vitest'
import {
  boldItalicFromMarks,
  inlineStyleFromMarks,
  marksIndicateBold,
  marksIndicateItalic,
  marksIndicateStrike,
  marksIndicateUnderline,
  markTypesBold,
  markTypesItalic,
} from './inlineMarks'

describe('inlineMarks', () => {
  it('detects bold from bold, strong, and b', () => {
    expect(marksIndicateBold([{ type: 'bold' }])).toBe(true)
    expect(marksIndicateBold([{ type: 'strong' }])).toBe(true)
    expect(marksIndicateBold([{ type: 'b' }])).toBe(true)
    expect(marksIndicateBold([{ type: 'italic' }])).toBe(false)
  })

  it('detects bold / italic from textStyle attrs (pasted / extension JSON)', () => {
    expect(marksIndicateBold([{ type: 'textStyle', attrs: { fontWeight: '700' } }])).toBe(true)
    expect(marksIndicateBold([{ type: 'textStyle', attrs: { fontWeight: 'bold' } }])).toBe(true)
    expect(marksIndicateBold([{ type: 'textStyle', attrs: { fontWeight: '400' } }])).toBe(false)
    expect(marksIndicateItalic([{ type: 'TextStyle', attrs: { fontStyle: 'italic' } }])).toBe(true)
    expect(marksIndicateItalic([{ type: 'textStyle', attrs: { fontStyle: 'oblique' } }])).toBe(true)
  })

  it('detects italic from italic, em, and i', () => {
    expect(marksIndicateItalic([{ type: 'italic' }])).toBe(true)
    expect(marksIndicateItalic([{ type: 'em' }])).toBe(true)
    expect(marksIndicateItalic([{ type: 'i' }])).toBe(true)
  })

  it('detects underline mark', () => {
    expect(marksIndicateUnderline([{ type: 'underline' }])).toBe(true)
    expect(marksIndicateUnderline([{ type: 'bold' }])).toBe(false)
  })

  it('detects strike mark', () => {
    expect(marksIndicateStrike([{ type: 'strike' }])).toBe(true)
    expect(marksIndicateStrike([{ type: 'bold' }])).toBe(false)
  })

  it('inlineStyleFromMarks includes underline', () => {
    expect(inlineStyleFromMarks([{ type: 'bold' }, { type: 'underline' }])).toEqual({
      bold: true,
      underline: true,
    })
  })

  it('boldItalicFromMarks matches combined marks', () => {
    expect(boldItalicFromMarks([{ type: 'bold' }, { type: 'em' }])).toEqual({ bold: true, italic: true })
  })

  it('inlineStyleFromMarks includes strike', () => {
    expect(inlineStyleFromMarks([{ type: 'strike' }])).toEqual({ strike: true })
  })

  it('mark type sets include TipTap and HTML aliases', () => {
    expect(markTypesBold().has('bold') && markTypesBold().has('strong') && markTypesBold().has('b')).toBe(true)
    expect(markTypesItalic().has('italic') && markTypesItalic().has('em') && markTypesItalic().has('i')).toBe(
      true,
    )
  })
})
