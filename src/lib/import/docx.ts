import type { JSONContent } from '@tiptap/core'
import mammoth from 'mammoth'

export type ImportedChapter = {
  title: string
  content: JSONContent
}

export type DocxImportResult = {
  chapters: ImportedChapter[]
}

function textFromNode(node: Node): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function escapeWhitespace(text: string): string {
  // Keep single spaces; normalize weird NBSPs from Word.
  return text.replace(/\u00a0/g, ' ')
}

type TextMark = 'bold' | 'italic' | 'underline'

function marksToTiptap(marks: Set<TextMark>): { type: string }[] | undefined {
  if (marks.size === 0) return undefined
  const out: { type: string }[] = []
  if (marks.has('bold')) out.push({ type: 'bold' })
  if (marks.has('italic')) out.push({ type: 'italic' })
  if (marks.has('underline')) out.push({ type: 'underline' })
  return out.length ? out : undefined
}

function isPageBreakElement(el: Element): boolean {
  const style = (el.getAttribute('style') ?? '').toLowerCase()
  if (style.includes('page-break-before') && style.includes('always')) return true
  if (style.includes('break-before') && style.includes('page')) return true
  if (el.tagName.toLowerCase() === 'br') {
    const s = (el.getAttribute('style') ?? '').toLowerCase()
    if (s.includes('page-break-before') && s.includes('always')) return true
  }
  // Some converters emit a div marker.
  if (el.getAttribute('data-inkwell') === 'page-break') return true
  return false
}

function paragraphFromInline(nodes: JSONContent[]): JSONContent | null {
  const content = nodes.filter(Boolean)
  if (content.length === 0) return null
  return { type: 'paragraph', content }
}

function parseInline(parent: Node, marks: Set<TextMark>, out: JSONContent[]) {
  if (parent.nodeType === Node.TEXT_NODE) {
    const raw = escapeWhitespace(parent.nodeValue ?? '')
    if (!raw) return
    out.push({ type: 'text', text: raw, marks: marksToTiptap(marks) })
    return
  }

  if (parent.nodeType !== Node.ELEMENT_NODE) return
  const el = parent as Element
  const tag = el.tagName.toLowerCase()

  if (tag === 'br') {
    // Inline line break
    out.push({ type: 'hardBreak' })
    return
  }

  const nextMarks = new Set(marks)
  if (tag === 'strong' || tag === 'b') nextMarks.add('bold')
  if (tag === 'em' || tag === 'i') nextMarks.add('italic')
  if (tag === 'u') nextMarks.add('underline')

  for (const child of Array.from(el.childNodes)) parseInline(child, nextMarks, out)
}

function blockFromElement(el: Element): JSONContent[] {
  const tag = el.tagName.toLowerCase()

  if (isPageBreakElement(el)) return [{ type: 'pageBreak' }]

  if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    const level = tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3
    const inline: JSONContent[] = []
    parseInline(el, new Set(), inline)
    const content = inline.length ? inline : [{ type: 'text', text: textFromNode(el) }]
    return [{ type: 'heading', attrs: { level }, content }]
  }

  if (tag === 'p' || tag === 'div') {
    // Some HTML has nested <p> in <div>; treat <div> as paragraph-ish only if it contains inline content.
    const inline: JSONContent[] = []
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && isPageBreakElement(child as Element)) {
        // Force break into its own block boundary.
        const p = paragraphFromInline(inline)
        const blocks: JSONContent[] = []
        if (p) blocks.push(p)
        blocks.push({ type: 'pageBreak' })
        return blocks
      }
      parseInline(child, new Set(), inline)
    }
    const p = paragraphFromInline(inline)
    return p ? [p] : []
  }

  if (tag === 'ul' || tag === 'ol') {
    const ordered = tag === 'ol'
    const items: JSONContent[] = []
    for (const li of Array.from(el.querySelectorAll(':scope > li'))) {
      const liBlocks: JSONContent[] = []
      // Support nested paragraphs inside li; treat direct text as a paragraph.
      const inline: JSONContent[] = []
      let hadElement = false
      for (const child of Array.from(li.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as Element
          const childTag = childEl.tagName.toLowerCase()
          if (childTag === 'p') {
            hadElement = true
            liBlocks.push(...blockFromElement(childEl))
          } else if (childTag === 'ul' || childTag === 'ol') {
            hadElement = true
            liBlocks.push(...blockFromElement(childEl))
          } else if (isPageBreakElement(childEl)) {
            hadElement = true
            liBlocks.push({ type: 'pageBreak' })
          } else {
            parseInline(childEl, new Set(), inline)
          }
        } else {
          parseInline(child, new Set(), inline)
        }
      }
      if (!hadElement) {
        const p = paragraphFromInline(inline)
        if (p) liBlocks.push(p)
      } else if (inline.length) {
        const p = paragraphFromInline(inline)
        if (p) liBlocks.unshift(p)
      }
      if (liBlocks.length === 0) continue
      items.push({ type: 'listItem', content: liBlocks })
    }
    if (items.length === 0) return []
    return [{ type: ordered ? 'orderedList' : 'bulletList', content: items }]
  }

  if (tag === 'blockquote') {
    const innerBlocks: JSONContent[] = []
    for (const child of Array.from(el.children)) innerBlocks.push(...blockFromElement(child))
    // If it had no child elements, treat its inline as a paragraph.
    if (innerBlocks.length === 0) {
      const inline: JSONContent[] = []
      parseInline(el, new Set(), inline)
      const p = paragraphFromInline(inline)
      if (p) innerBlocks.push(p)
    }
    return innerBlocks.length ? [{ type: 'blockquote', content: innerBlocks }] : []
  }

  // Fallback: flatten children.
  const out: JSONContent[] = []
  for (const child of Array.from(el.children)) out.push(...blockFromElement(child))
  return out
}

function docFromBlocks(blocks: JSONContent[]): JSONContent {
  const cleaned = blocks.filter(Boolean)
  return { type: 'doc', content: cleaned.length ? cleaned : [{ type: 'paragraph' }] }
}

export async function importDocxToChapters(arrayBuffer: ArrayBuffer): Promise<DocxImportResult> {
  // mammoth converts docx to HTML, preserving bold/italic reasonably well.
  const { value: html } = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      // Encourage explicit markers for page breaks when present.
      styleMap: [
        "p[style-name='Page Break'] => div:data-inkwell=page-break",
        "p[style-name='page break'] => div:data-inkwell=page-break",
      ],
      includeDefaultStyleMap: true,
    },
  )

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const root = doc.body
  const allBlocks: JSONContent[] = []
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      allBlocks.push(...blockFromElement(node as Element))
    } else if (node.nodeType === Node.TEXT_NODE) {
      const t = escapeWhitespace(node.nodeValue ?? '').trim()
      if (t) allBlocks.push({ type: 'paragraph', content: [{ type: 'text', text: t }] })
    }
  }

  // Split into chapters on Heading 1 (H1).
  const chapters: ImportedChapter[] = []
  let currentTitle = 'Chapter 1'
  let currentBlocks: JSONContent[] = []
  let sawH1 = false

  const flush = () => {
    const blocks = currentBlocks.slice()
    currentBlocks = []
    // Drop leading empty paragraphs
    while (blocks.length && blocks[0]?.type === 'paragraph' && !blocks[0].content?.length) blocks.shift()
    chapters.push({ title: currentTitle || 'Untitled chapter', content: docFromBlocks(blocks) })
  }

  for (const b of allBlocks) {
    if (b.type === 'heading' && (b.attrs as { level?: number } | undefined)?.level === 1) {
      const title =
        b.content
          ?.map((n) => (n.type === 'text' ? (n.text ?? '') : ''))
          .join('')
          .trim() || 'Untitled chapter'
      if (currentBlocks.length) flush()
      currentTitle = title
      sawH1 = true
      continue
    }
    currentBlocks.push(b)
  }

  if (sawH1) {
    // If we saw at least one H1, we always flush the last chapter (even if empty).
    flush()
  } else {
    // No chapter headings: return a single chapter containing everything.
    chapters.push({ title: 'Imported document', content: docFromBlocks(allBlocks) })
  }

  // Ensure non-empty output.
  const normalized = chapters.filter((c): c is ImportedChapter => !!c.content && c.content.type === 'doc')
  return { chapters: normalized.length ? normalized : [{ title: 'Imported document', content: docFromBlocks([]) }] }
}

