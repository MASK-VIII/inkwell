import type { JSONContent } from '@tiptap/core'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function openMarks(marks: { type: string }[] | undefined): string {
  if (!marks || marks.length === 0) return ''
  // Keep stable nesting order.
  const types = new Set(marks.map((m) => m.type))
  let out = ''
  if (types.has('bold')) out += '<strong>'
  if (types.has('italic')) out += '<em>'
  if (types.has('underline')) out += '<u>'
  return out
}

function closeMarks(marks: { type: string }[] | undefined): string {
  if (!marks || marks.length === 0) return ''
  const types = new Set(marks.map((m) => m.type))
  let out = ''
  // Reverse order of openMarks
  if (types.has('underline')) out += '</u>'
  if (types.has('italic')) out += '</em>'
  if (types.has('bold')) out += '</strong>'
  return out
}

function renderInline(node: JSONContent): string {
  if (node.type === 'text') {
    const t = esc(node.text ?? '')
    const open = openMarks(node.marks as { type: string }[] | undefined)
    const close = closeMarks(node.marks as { type: string }[] | undefined)
    return `${open}${t}${close}`
  }
  if (node.type === 'hardBreak') return '<br />'
  // Unknown inline: ignore.
  return ''
}

function renderChildren(nodes: JSONContent[] | undefined): string {
  if (!nodes || nodes.length === 0) return ''
  return nodes.map((n) => renderNode(n)).join('')
}

function renderInlineChildren(nodes: JSONContent[] | undefined): string {
  if (!nodes || nodes.length === 0) return ''
  return nodes.map((n) => renderInline(n)).join('')
}

function renderNode(node: JSONContent): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInlineChildren(node.content)}</p>`
    case 'heading': {
      const level = (node.attrs as { level?: number } | undefined)?.level ?? 2
      const l = level >= 1 && level <= 3 ? level : 2
      return `<h${l}>${renderInlineChildren(node.content)}</h${l}>`
    }
    case 'bulletList':
      return `<ul>${renderChildren(node.content)}</ul>`
    case 'orderedList':
      return `<ol>${renderChildren(node.content)}</ol>`
    case 'listItem':
      return `<li>${renderChildren(node.content)}</li>`
    case 'blockquote':
      return `<blockquote>${renderChildren(node.content)}</blockquote>`
    case 'horizontalRule':
      return `<hr />`
    case 'pageBreak':
      // Ebook: ignore hard breaks to avoid blank pages.
      return ''
    default:
      // For any unknown block, try to render its children.
      if (node.content?.length) return renderChildren(node.content)
      return ''
  }
}

export function tiptapDocToXhtmlBody(doc: JSONContent): string {
  if (!doc || doc.type !== 'doc') return ''
  const blocks = (doc.content ?? []).map((n) => renderNode(n)).join('')
  return blocks
}

