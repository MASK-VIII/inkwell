import type { JSONContent } from '@tiptap/core'

function escPipe(s: string): string {
  return s.replace(/\|/g, '\\|')
}

type FootAccum = { id: string; content: string }[]

function openMdMarks(marks: { type: string; attrs?: Record<string, unknown> }[] | undefined): string {
  if (!marks?.length) return ''
  let out = ''
  const link = marks.find((m) => m.type === 'link')
  const href = String((link?.attrs as { href?: unknown } | undefined)?.href ?? '')
  if (link && href) out += '['

  const types = new Set(marks.map((m) => m.type))
  if (types.has('bold')) out += '**'
  if (types.has('italic')) out += '*'
  if (types.has('strike')) out += '~~'
  return out
}

function closeMdMarks(marks: { type: string; attrs?: Record<string, unknown> }[] | undefined): string {
  if (!marks?.length) return ''
  let out = ''
  const link = marks.find((m) => m.type === 'link')
  const href = String((link?.attrs as { href?: unknown } | undefined)?.href ?? '')
  const types = new Set(marks.map((m) => m.type))
  if (types.has('strike')) out += '~~'
  if (types.has('italic')) out += '*'
  if (types.has('bold')) out += '**'
  if (link && href) out += `](${href.replace(/[()]/g, '\\$&')})`
  return out
}

function renderInlineMd(node: JSONContent, _footDefs: FootAccum): string {
  void _footDefs
  if (node.type === 'text') {
    const t = escPipe(node.text ?? '')
    const open = openMdMarks(node.marks as { type: string }[] | undefined)
    const close = closeMdMarks(node.marks as { type: string }[] | undefined)
    return `${open}${t}${close}`
  }
  if (node.type === 'hardBreak') return '  \n'
  if (node.type === 'mention') {
    const label = String(node.attrs?.label ?? node.attrs?.id ?? '')
    return `@${label}`
  }
  return ''
}

function renderInlineChildrenMd(nodes: JSONContent[] | undefined, footDefs: FootAccum): string {
  if (!nodes?.length) return ''
  return nodes.map((n) => renderInlineMd(n, footDefs)).join('')
}

type Ctx = { footDefs: FootAccum; listDepth: number; tight: boolean }

function renderBlockMd(node: JSONContent, ctx: Ctx): string {
  const { footDefs, tight } = ctx
  const paraSep = tight ? '\n' : '\n\n'

  switch (node.type) {
    case 'paragraph': {
      const inner = renderInlineChildrenMd(node.content, footDefs).trim()
      return inner + paraSep
    }
    case 'heading': {
      const level = (node.attrs as { level?: number } | undefined)?.level ?? 2
      const l = level >= 1 && level <= 6 ? level : 2
      const hashes = '#'.repeat(l)
      return `${hashes} ${renderInlineChildrenMd(node.content, footDefs).trim()}${paraSep}`
    }
    case 'bulletList': {
      return (node.content ?? []).map((li) => renderListItemMd(li, ctx, '-')).join('')
    }
    case 'orderedList': {
      let i = 0
      return (node.content ?? [])
        .map((li) => {
          i += 1
          return renderListItemMd(li, ctx, `${i}.`)
        })
        .join('')
    }
    case 'blockquote': {
      const inner = (node.content ?? [])
        .map((c) => renderBlockMd(c, { ...ctx, listDepth: 0, tight: false }))
        .join('')
        .trimEnd()
      const lines = inner.split('\n').filter((line) => line.trim().length > 0)
      return lines.map((line) => `> ${line}\n`).join('') + '\n'
    }
    case 'horizontalRule': {
      return '---\n\n'
    }
    case 'pageBreak':
      return '\n'
    case 'image': {
      const src = String((node.attrs as { src?: string } | undefined)?.src ?? '')
      const alt = String((node.attrs as { alt?: string } | undefined)?.alt ?? '')
      if (!src) return ''
      return `![${alt.replace(/]/g, '\\]')}](${src})${paraSep}`
    }
    default:
      if (node.content?.length) {
        return (node.content ?? []).map((c) => renderBlockMd(c, ctx)).join('')
      }
      return ''
  }
}

function renderListItemMd(node: JSONContent, ctx: Ctx, marker: string): string {
  if (node.type !== 'listItem') return renderBlockMd(node, ctx)
  const { footDefs, listDepth } = ctx
  const pad = '  '.repeat(listDepth)
  const inner = (node.content ?? [])
    .map((c) => renderBlockMd(c, { footDefs, listDepth: listDepth + 1, tight: true }))
    .join('')
    .trimEnd()
  const lines = inner.split('\n').filter((l) => l.length > 0)
  if (lines.length === 0) return `${pad}${marker}\n`
  const body =
    `${pad}${marker} ${lines[0]}\n` +
    lines
      .slice(1)
      .map((line) => `${pad}  ${line}\n`)
      .join('')
  return body
}

/** Best-effort Markdown for note / article workflows. */
export function tiptapDocToMarkdown(doc: JSONContent): string {
  if (!doc || doc.type !== 'doc') return ''
  const footDefs: FootAccum = []
  const blocks = (doc.content ?? [])
    .map((n) => renderBlockMd(n, { footDefs, listDepth: 0, tight: false }))
    .join('')
  return blocks.trim() + '\n'
}
