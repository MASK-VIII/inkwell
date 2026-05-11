import type { JSONContent } from '@tiptap/core'

/** Marks on TipTap `text` nodes as stored in JSON (attrs optional). */
export type TipTapMarkJson = { type: string; attrs?: Record<string, unknown> }

function attrsFontWeightBold(attrs: Record<string, unknown> | undefined): boolean {
  if (!attrs) return false
  const fw = attrs.fontWeight ?? attrs['font-weight']
  if (typeof fw === 'number') return fw >= 600
  if (typeof fw === 'string') {
    const s = fw.toLowerCase().trim()
    if (s === 'bold' || s === 'bolder') return true
    const n = parseInt(s, 10)
    return Number.isFinite(n) && n >= 600
  }
  return false
}

function attrsFontStyleItalic(attrs: Record<string, unknown> | undefined): boolean {
  if (!attrs) return false
  const fs = attrs.fontStyle ?? attrs['font-style']
  if (typeof fs !== 'string') return false
  const s = fs.toLowerCase().trim()
  return s === 'italic' || s === 'oblique'
}

/**
 * Single source of truth for which TipTap / import marks count as bold or italic
 * in export pipelines (print blocks, EPUB HTML, DOCX).
 */
export function marksIndicateBold(marks: TipTapMarkJson[] | undefined): boolean {
  if (!marks?.length) return false
  if (marks.some((m) => m.type === 'bold' || m.type === 'strong' || m.type === 'b')) return true
  return marks.some((m) => {
    if (m.type !== 'textStyle' && m.type !== 'TextStyle') return false
    return attrsFontWeightBold(m.attrs)
  })
}

export function marksIndicateItalic(marks: TipTapMarkJson[] | undefined): boolean {
  if (!marks?.length) return false
  if (marks.some((m) => m.type === 'italic' || m.type === 'em' || m.type === 'i')) return true
  return marks.some((m) => {
    if (m.type !== 'textStyle' && m.type !== 'TextStyle') return false
    return attrsFontStyleItalic(m.attrs)
  })
}

export function marksIndicateUnderline(marks: TipTapMarkJson[] | undefined): boolean {
  if (!marks?.length) return false
  return marks.some((m) => m.type === 'underline')
}

export function marksIndicateStrike(marks: TipTapMarkJson[] | undefined): boolean {
  if (!marks?.length) return false
  return marks.some((m) => m.type === 'strike')
}

/** Bold / italic / underline / strike from TipTap text-node marks (single source for print + export). */
export function inlineStyleFromMarks(marks: TipTapMarkJson[] | undefined): {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
} {
  if (!marks?.length) return {}
  return {
    bold: marksIndicateBold(marks) ? true : undefined,
    italic: marksIndicateItalic(marks) ? true : undefined,
    underline: marksIndicateUnderline(marks) ? true : undefined,
    strike: marksIndicateStrike(marks) ? true : undefined,
  }
}

export function boldItalicFromMarks(marks: { type: string }[] | undefined): {
  bold?: boolean
  italic?: boolean
  strike?: boolean
} {
  const s = inlineStyleFromMarks(marks)
  return { bold: s.bold, italic: s.italic, strike: s.strike }
}

/** Mark types treated as bold for closing-tag order in HTML emitters. */
export function markTypesBold(): Set<string> {
  return new Set(['bold', 'strong', 'b'])
}

/** Mark types treated as italic for closing-tag order in HTML emitters. */
export function markTypesItalic(): Set<string> {
  return new Set(['italic', 'em', 'i'])
}

/** Parse marks from a TipTap text node's JSON (same shape as JSONContent['marks']). */
export function textNodeMarks(node: JSONContent): TipTapMarkJson[] | undefined {
  return node.marks as TipTapMarkJson[] | undefined
}
