import type { JSONContent } from '@tiptap/core'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type UrlKind = 'link' | 'image'

function sanitizeUrl(raw: string, kind: UrlKind): string | null {
  // eslint-disable-next-line no-control-regex -- strip control chars from pasted URLs
  const s = raw.trim().replace(/[\u0000-\u001F\u007F\s]+/g, '')
  if (!s) return null

  // Allow internal anchors (used for footnotes).
  if (s.startsWith('#')) return s

  // Allow relative URLs.
  if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) return s

  // Disallow scheme-relative URLs (e.g. //evil.com).
  if (s.startsWith('//')) return null

  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s)
  const scheme = m?.[1]?.toLowerCase() ?? null
  if (!scheme) return null

  if (kind === 'link') {
    if (scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel') return s
    return null
  }

  if (scheme === 'http' || scheme === 'https' || scheme === 'blob') return s
  if (scheme === 'data') {
    // Only allow embedded images (block HTML, SVG-with-script, etc.).
    if (/^data:image\/(png|gif|jpeg|jpg|webp|avif);base64,[a-z0-9+/=]+$/i.test(s)) return s
    return null
  }
  return null
}

function openMarks(
  marks: { type: string; attrs?: Record<string, unknown> }[] | undefined,
  footnoteById: Map<string, string>,
): string {
  if (!marks || marks.length === 0) return ''
  let out = ''
  const link = marks.find((m) => m.type === 'link') ?? null
  const href = (link?.attrs as { href?: unknown } | undefined)?.href
  if (typeof href === 'string') {
    const safe = sanitizeUrl(href, 'link')
    if (safe) out += `<a href="${esc(safe)}">`
  }

  const comment = marks.find((m) => m.type === 'writerComment') ?? null
  const commentBody = String((comment?.attrs as { body?: unknown } | undefined)?.body ?? '')
  if (comment) out += `<mark class="inkwell-export-comment" title="${esc(commentBody)}">`

  const fn = marks.find((m) => m.type === 'writerFootnote') ?? null
  const fnId = String((fn?.attrs as { id?: unknown } | undefined)?.id ?? '')
  const fnContent = String((fn?.attrs as { content?: unknown } | undefined)?.content ?? '')
  if (fn && fnId && fnContent) footnoteById.set(fnId, fnContent)
  if (fn && fnId) out += `<sup class="inkwell-fn-ref"><a id="fnref-${esc(fnId)}" href="#fn-${esc(fnId)}">`

  const types = new Set(marks.map((m) => m.type))
  if (types.has('bold')) out += '<strong>'
  if (types.has('italic')) out += '<em>'
  if (types.has('underline')) out += '<u>'
  if (types.has('strike')) out += '<s>'
  return out
}

function closeMarks(marks: { type: string; attrs?: Record<string, unknown> }[] | undefined): string {
  if (!marks || marks.length === 0) return ''
  let out = ''
  const link = marks.find((m) => m.type === 'link') ?? null
  const href = (link?.attrs as { href?: unknown } | undefined)?.href
  const fn = marks.find((m) => m.type === 'writerFootnote') ?? null
  const fnId = String((fn?.attrs as { id?: unknown } | undefined)?.id ?? '')
  const comment = marks.find((m) => m.type === 'writerComment') ?? null

  const types = new Set(marks.map((m) => m.type))
  if (types.has('strike')) out += '</s>'
  if (types.has('underline')) out += '</u>'
  if (types.has('italic')) out += '</em>'
  if (types.has('bold')) out += '</strong>'
  if (fn && fnId) out += '</a></sup>'
  if (comment) out += '</mark>'
  if (typeof href === 'string') {
    const safe = sanitizeUrl(href, 'link')
    if (safe) out += '</a>'
  }
  return out
}

function renderInline(node: JSONContent, footnoteById: Map<string, string>): string {
  if (node.type === 'text') {
    const t = esc(node.text ?? '')
    const open = openMarks(node.marks as { type: string }[] | undefined, footnoteById)
    const close = closeMarks(node.marks as { type: string }[] | undefined)
    return `${open}${t}${close}`
  }
  if (node.type === 'hardBreak') return '<br />'
  if (node.type === 'mention') {
    const id = String(node.attrs?.id ?? '')
    const label = String(node.attrs?.label ?? id)
    return `<span class="inkwell-mention-export" data-id="${esc(id)}">@${esc(label)}</span>`
  }
  return ''
}

function renderChildren(nodes: JSONContent[] | undefined, footnoteById: Map<string, string>): string {
  if (!nodes || nodes.length === 0) return ''
  return nodes.map((n) => renderNode(n, footnoteById)).join('')
}

function renderInlineChildren(nodes: JSONContent[] | undefined, footnoteById: Map<string, string>): string {
  if (!nodes || nodes.length === 0) return ''
  return nodes.map((n) => renderInline(n, footnoteById)).join('')
}

function blockTextAlignAttr(attrs: Record<string, unknown> | undefined | null): string {
  const ta = attrs?.textAlign
  if (ta === 'left' || ta === 'center' || ta === 'right' || ta === 'justify') {
    return ` style="text-align: ${ta}"`
  }
  return ''
}

function renderNode(node: JSONContent, footnoteById: Map<string, string>): string {
  switch (node.type) {
    case 'paragraph': {
      const st = blockTextAlignAttr(node.attrs as Record<string, unknown> | undefined)
      return `<p${st}>${renderInlineChildren(node.content, footnoteById)}</p>`
    }
    case 'heading': {
      const level = (node.attrs as { level?: number } | undefined)?.level ?? 2
      const l = level >= 1 && level <= 3 ? level : 2
      const st = blockTextAlignAttr(node.attrs as Record<string, unknown> | undefined)
      return `<h${l}${st}>${renderInlineChildren(node.content, footnoteById)}</h${l}>`
    }
    case 'bulletList':
      return `<ul>${renderChildren(node.content, footnoteById)}</ul>`
    case 'orderedList':
      return `<ol>${renderChildren(node.content, footnoteById)}</ol>`
    case 'listItem':
      return `<li>${renderChildren(node.content, footnoteById)}</li>`
    case 'blockquote': {
      const st = blockTextAlignAttr(node.attrs as Record<string, unknown> | undefined)
      return `<blockquote${st}>${renderChildren(node.content, footnoteById)}</blockquote>`
    }
    case 'horizontalRule': {
      const orn = String((node.attrs as { ornament?: string } | undefined)?.ornament ?? '').trim()
      if (orn) {
        return `<p class="inkwell-scene-break" style="text-align:center;margin:1.35em 0">${esc(orn)}</p>`
      }
      return `<hr />`
    }
    case 'pageBreak':
      return ''
    case 'image': {
      const rawSrc = String((node.attrs as { src?: string } | undefined)?.src ?? '')
      const src = sanitizeUrl(rawSrc, 'image')
      if (!src) return ''
      const alt = String((node.attrs as { alt?: string } | undefined)?.alt ?? '')
      return `<figure class="inkwell-figure"><img src="${esc(src)}" alt="${esc(alt)}" /></figure>`
    }
    default:
      if (node.content?.length) return renderChildren(node.content, footnoteById)
      return ''
  }
}

export function tiptapDocToXhtmlBody(doc: JSONContent): string {
  if (!doc || doc.type !== 'doc') return ''
  const footnoteById = new Map<string, string>()
  let blocks = (doc.content ?? []).map((n) => renderNode(n, footnoteById)).join('')
  if (footnoteById.size > 0) {
    const lis = [...footnoteById.entries()].map(
      ([id, content]) =>
        `<li id="fn-${esc(id)}"><p>${esc(content)}</p> <a href="#fnref-${esc(id)}">↩</a></li>`,
    )
    blocks += `<section class="inkwell-footnotes"><hr /><ol>${lis.join('')}</ol></section>`
  }
  return blocks
}
