import type { JSONContent } from '@tiptap/core'

/**
 * Single source of truth for which TipTap / import marks count as bold or italic
 * in export pipelines (print blocks, EPUB HTML, DOCX).
 */
export function marksIndicateBold(marks: { type: string }[] | undefined): boolean {
  if (!marks?.length) return false
  return marks.some((m) => m.type === 'bold' || m.type === 'strong' || m.type === 'b')
}

export function marksIndicateItalic(marks: { type: string }[] | undefined): boolean {
  if (!marks?.length) return false
  return marks.some((m) => m.type === 'italic' || m.type === 'em' || m.type === 'i')
}

export function marksIndicateUnderline(marks: { type: string }[] | undefined): boolean {
  if (!marks?.length) return false
  return marks.some((m) => m.type === 'underline')
}

/** Bold / italic / underline from TipTap text-node marks (single source for print + export). */
export function inlineStyleFromMarks(marks: { type: string }[] | undefined): {
  bold?: boolean
  italic?: boolean
  underline?: boolean
} {
  if (!marks?.length) return {}
  return {
    bold: marksIndicateBold(marks) ? true : undefined,
    italic: marksIndicateItalic(marks) ? true : undefined,
    underline: marksIndicateUnderline(marks) ? true : undefined,
  }
}

export function boldItalicFromMarks(marks: { type: string }[] | undefined): {
  bold?: boolean
  italic?: boolean
} {
  const s = inlineStyleFromMarks(marks)
  return { bold: s.bold, italic: s.italic }
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
export function textNodeMarks(node: JSONContent): { type: string }[] | undefined {
  return node.marks as { type: string }[] | undefined
}
