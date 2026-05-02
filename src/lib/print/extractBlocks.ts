import type { JSONContent } from '@tiptap/core'

export type PrintBlock =
  | { type: 'paragraph'; text: string }
  /** printRole: synthetic chapter opener title — larger centered type in paginate */
  | { type: 'heading'; level: 1 | 2 | 3; text: string; printRole?: 'chapterBanner' }
  | { type: 'pageBreak' }

function textFromNode(node: JSONContent | null | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return ' '
  if (node.type === 'mention') {
    const label =
      (node.attrs as { label?: string; id?: string } | undefined)?.label ??
      (node.attrs as { id?: string } | undefined)?.id ??
      ''
    return `@${label}`
  }
  const parts = (node.content ?? []).map(textFromNode)
  return parts.join('')
}

function visit(node: JSONContent, out: PrintBlock[]) {
  if (node.type === 'pageBreak') {
    out.push({ type: 'pageBreak' })
    return
  }

  if (node.type === 'image') {
    const alt = String((node.attrs as { alt?: string } | undefined)?.alt ?? 'Image').trim() || 'Image'
    out.push({ type: 'paragraph', text: `[${alt}]` })
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

/** Collapse consecutive page breaks; strip leading/trailing breaks per chapter doc. */
export function normalizePrintPageBreaks(blocks: PrintBlock[]): PrintBlock[] {
  const collapsed: PrintBlock[] = []
  for (const b of blocks) {
    if (b.type === 'pageBreak') {
      if (collapsed.length === 0) continue
      const prev = collapsed[collapsed.length - 1]
      if (prev?.type === 'pageBreak') continue
      collapsed.push(b)
    } else {
      collapsed.push(b)
    }
  }
  while (collapsed.length > 0 && collapsed[collapsed.length - 1]!.type === 'pageBreak') {
    collapsed.pop()
  }
  return collapsed
}

export function extractPrintBlocks(doc: JSONContent): PrintBlock[] {
  const out: PrintBlock[] = []
  visit(doc, out)
  // Keep layout stable: normalize empty paragraphs away unless they are the only content.
  const filtered = out.filter((b) => (b.type === 'paragraph' ? b.text.trim().length > 0 : true))
  const blocks: PrintBlock[] = filtered.length > 0 ? filtered : [{ type: 'paragraph', text: '' }]
  return normalizePrintPageBreaks(blocks)
}

