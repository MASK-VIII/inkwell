import type { JSONContent } from '@tiptap/core'

export type PrintBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'pageBreak' }

function textFromNode(node: JSONContent | null | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  const parts = (node.content ?? []).map(textFromNode)
  return parts.join('')
}

function visit(node: JSONContent, out: PrintBlock[]) {
  if (node.type === 'pageBreak') {
    out.push({ type: 'pageBreak' })
    return
  }

  if (node.type === 'paragraph') {
    const text = textFromNode(node).trimEnd()
    out.push({ type: 'paragraph', text })
    return
  }

  if (node.type === 'heading') {
    const levelRaw = (node.attrs?.level ?? 1) as number
    const level = (levelRaw === 1 || levelRaw === 2 || levelRaw === 3 ? levelRaw : 1) as 1 | 2 | 3
    const text = textFromNode(node).trimEnd()
    out.push({ type: 'heading', level, text })
    return
  }

  ;(node.content ?? []).forEach((child) => visit(child, out))
}

export function extractPrintBlocks(doc: JSONContent): PrintBlock[] {
  const out: PrintBlock[] = []
  visit(doc, out)
  // Keep layout stable: normalize empty paragraphs away unless they are the only content.
  const filtered = out.filter((b) => (b.type === 'paragraph' ? b.text.trim().length > 0 : true))
  return filtered.length > 0 ? filtered : [{ type: 'paragraph', text: '' }]
}

