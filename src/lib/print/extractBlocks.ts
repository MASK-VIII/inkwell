import type { JSONContent } from '@tiptap/core'
import type { InkwellFontId } from '../fonts/fontCatalog'

/**
 * `chapterBanner`     — synthetic chapter opener title (centered, multiplied size)
 * `chapterOrnament`   — small centered glyph rendered immediately under the title
 * `sceneBreak`        — synthetic scene-break ornament inside chapter body
 */
export type PrintHeadingRole = 'chapterBanner' | 'chapterOrnament' | 'sceneBreak'

export type PrintBlock =
  | {
      type: 'paragraph'
      text: string
      /** Indented quote body */
      blockquote?: boolean
      /** Ordered / bullet prefix on first line only (e.g. "1. " or "• "); pagination handles hanging indent */
      listPrefix?: string
      /** Extra left indent for nested lists (pt) */
      listIndentPt?: number
    }
  | {
      type: 'heading'
      level: 1 | 2 | 3
      text: string
      printRole?: PrintHeadingRole
      sizeMultiplier?: number
      trackingEm?: number
      fontIdOverride?: InkwellFontId
    }
  | { type: 'pageBreak' }
  | { type: 'figure'; src: string | null; alt: string }

type FootnoteBuf = {
  order: string[]
  contentById: Map<string, string>
}

function registerFootnote(buf: FootnoteBuf, id: string, content: string) {
  if (!buf.contentById.has(id)) {
    buf.order.push(id)
    buf.contentById.set(id, content)
  }
}

function textFromInline(nodes: JSONContent[] | undefined, buf: FootnoteBuf): string {
  if (!nodes) return ''
  let s = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      const marks = node.marks as { type: string; attrs?: Record<string, unknown> }[] | undefined
      const fn = marks?.find((m) => m.type === 'writerFootnote')
      if (fn?.attrs?.id != null) {
        registerFootnote(buf, String(fn.attrs.id), String(fn.attrs.content ?? ''))
      }
      s += node.text ?? ''
    } else if (node.type === 'hardBreak') {
      s += ' '
    } else if (node.type === 'mention') {
      const label =
        String((node.attrs as { label?: string; id?: string } | undefined)?.label ??
          (node.attrs as { id?: string } | undefined)?.id ??
          '')
      s += label ? `@${label}` : '@'
    } else if (node.content) {
      s += textFromInline(node.content, buf)
    }
  }
  return s
}

function visit(node: JSONContent, out: PrintBlock[], buf: FootnoteBuf, quoteDepth: number) {
  if (node.type === 'pageBreak') {
    out.push({ type: 'pageBreak' })
    return
  }

  if (node.type === 'horizontalRule') {
    const orn = String((node.attrs as { ornament?: string } | undefined)?.ornament ?? '').trim()
    const text = orn || '✦'
    out.push({ type: 'heading', level: 3, text, printRole: 'sceneBreak' })
    return
  }

  if (node.type === 'image') {
    const alt = String((node.attrs as { alt?: string } | undefined)?.alt ?? 'Image').trim() || 'Image'
    const src = String((node.attrs as { src?: string } | undefined)?.src ?? '').trim() || null
    out.push({ type: 'figure', src, alt })
    return
  }

  if (node.type === 'paragraph') {
    const text = textFromInline(node.content, buf).trimEnd()
    out.push({
      type: 'paragraph',
      text,
      ...(quoteDepth > 0 ? { blockquote: true } : {}),
    })
    return
  }

  if (node.type === 'heading') {
    const levelRaw = (node.attrs?.level ?? 1) as number
    const level = (levelRaw === 1 || levelRaw === 2 || levelRaw === 3 ? levelRaw : 1) as 1 | 2 | 3
    const text = textFromInline(node.content, buf).trimEnd()
    out.push({ type: 'heading', level, text })
    return
  }

  if (node.type === 'bulletList' || node.type === 'orderedList') {
    visitList(node, out, buf, quoteDepth, node.type === 'orderedList', { n: 1 }, 0)
    return
  }

  if (node.type === 'blockquote') {
    for (const child of node.content ?? []) visit(child, out, buf, quoteDepth + 1)
    return
  }

  ;(node.content ?? []).forEach((child) => visit(child, out, buf, quoteDepth))
}

function visitList(
  node: JSONContent,
  out: PrintBlock[],
  buf: FootnoteBuf,
  quoteDepth: number,
  ordered: boolean,
  counter: { n: number },
  depth: number,
) {
  const indentBase = depth * 14
  const items = node.content ?? []
  for (const item of items) {
    if (item.type !== 'listItem') continue
    const body = item.content ?? []
    let firstPara = true
    for (const child of body) {
      if (child.type === 'bulletList') {
        visitList(child, out, buf, quoteDepth, false, { n: 1 }, depth + 1)
        firstPara = false
      } else if (child.type === 'orderedList') {
        visitList(child, out, buf, quoteDepth, true, { n: 1 }, depth + 1)
        firstPara = false
      } else if (child.type === 'paragraph') {
        const text = textFromInline(child.content, buf).trimEnd()
        const prefix = firstPara ? (ordered ? `${counter.n++}. ` : '• ') : ''
        out.push({
          type: 'paragraph',
          text,
          listPrefix: prefix || undefined,
          listIndentPt: indentBase,
          ...(quoteDepth > 0 ? { blockquote: true } : {}),
        })
        firstPara = false
      } else {
        visit(child, out, buf, quoteDepth)
        firstPara = false
      }
    }
  }
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
  const buf: FootnoteBuf = { order: [], contentById: new Map() }
  const out: PrintBlock[] = []
  visit(doc, out, buf, 0)

  if (buf.order.length > 0) {
    out.push({ type: 'heading', level: 2, text: 'Notes' })
    buf.order.forEach((id, idx) => {
      const c = buf.contentById.get(id) ?? ''
      out.push({ type: 'paragraph', text: `${idx + 1}. ${c}` })
    })
  }

  const filtered = out.filter((b) =>
    b.type === 'paragraph' ? b.text.trim().length > 0 || Boolean(b.listPrefix) : true,
  )
  const blocks: PrintBlock[] =
    filtered.length > 0 ? filtered : [{ type: 'paragraph', text: '', listPrefix: undefined }]
  return normalizePrintPageBreaks(blocks)
}
