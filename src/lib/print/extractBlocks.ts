import type { JSONContent } from '@tiptap/core'
import type { InkwellFontId } from '../fonts/fontCatalog'
import { inlineStyleFromMarks, type TipTapMarkJson } from '../tiptap/inlineMarks'

/**
 * `chapterBanner`     — synthetic chapter opener title (centered, multiplied size)
 * `chapterOrnament`   — small centered glyph rendered immediately under the title
 * `sceneBreak`        — synthetic scene-break ornament inside chapter body
 */
export type PrintHeadingRole = 'chapterBanner' | 'chapterOrnament' | 'sceneBreak'

/** Inline TipTap segment for print layout / PDF (bold + italic from marks). */
export type PrintTextRun = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
}

export type PrintBlock =
  | {
      type: 'paragraph'
      text: string
      /** When present, drives wrapping and PDF styling; `text` remains joined runs for fallbacks. */
      runs?: PrintTextRun[]
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
      runs?: PrintTextRun[]
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

function sameRunStyle(
  a: PrintTextRun,
  b: Pick<PrintTextRun, 'bold' | 'italic' | 'underline' | 'strike'>,
): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strike === b.strike
  )
}

function pushStyledFragment(
  runs: PrintTextRun[],
  fragment: string,
  bold?: boolean,
  italic?: boolean,
  underline?: boolean,
  strike?: boolean,
) {
  if (!fragment) return
  const prev = runs[runs.length - 1]
  if (prev && sameRunStyle(prev, { bold, italic, underline, strike })) {
    prev.text += fragment
    return
  }
  runs.push({ text: fragment, bold, italic, underline, strike })
}

function mergeAdjacentRuns(runs: PrintTextRun[]): PrintTextRun[] {
  const out: PrintTextRun[] = []
  for (const r of runs) {
    if (!r.text) continue
    const prev = out[out.length - 1]
    if (prev && sameRunStyle(prev, r)) prev.text += r.text
    else out.push({ ...r })
  }
  return out
}

function finalizeRuns(runsRaw: PrintTextRun[]): PrintTextRun[] {
  const merged = mergeAdjacentRuns(runsRaw.filter((r) => r.text.length > 0))
  if (merged.length > 0) {
    const last = merged[merged.length - 1]!
    last.text = last.text.replace(/\s+$/, '')
  }
  return merged.filter((r) => r.text.length > 0)
}

type InheritedInlineStyle = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }

function mergeInheritedStyle(a: InheritedInlineStyle | undefined, b: InheritedInlineStyle | undefined): InheritedInlineStyle | undefined {
  if (!a && !b) return undefined
  return {
    bold: a?.bold || b?.bold ? true : undefined,
    italic: a?.italic || b?.italic ? true : undefined,
    underline: a?.underline || b?.underline ? true : undefined,
    strike: a?.strike || b?.strike ? true : undefined,
  }
}

/** Non-standard trees: emphasis as wrapper nodes (imports / foreign JSON). */
function styleAccumulationFromNodeType(nodeType: string): InheritedInlineStyle | undefined {
  switch (nodeType) {
    case 'bold':
    case 'strong':
      return { bold: true }
    case 'italic':
    case 'em':
      return { italic: true }
    default:
      return undefined
  }
}

function mergeMarksWithInherited(
  inherited: InheritedInlineStyle | undefined,
  marks: TipTapMarkJson[] | undefined,
): InheritedInlineStyle {
  const m = inlineStyleFromMarks(marks)
  return {
    bold: inherited?.bold || m.bold ? true : undefined,
    italic: inherited?.italic || m.italic ? true : undefined,
    underline: inherited?.underline || m.underline ? true : undefined,
    strike: inherited?.strike || m.strike ? true : undefined,
  }
}

function runsFromInline(nodes: JSONContent[] | undefined, buf: FootnoteBuf): PrintTextRun[] {
  if (!nodes) return []
  const runs: PrintTextRun[] = []
  const visit = (ns: JSONContent[], inherited?: InheritedInlineStyle) => {
    for (const node of ns) {
      const acc = styleAccumulationFromNodeType(node.type ?? '')
      const nextInherited = mergeInheritedStyle(inherited, acc)

      if (node.type === 'text') {
        const marks = node.marks as TipTapMarkJson[] | undefined
        const fn = marks?.find((m) => m.type === 'writerFootnote')
        if (fn?.attrs?.id != null) {
          registerFootnote(buf, String(fn.attrs.id), String(fn.attrs.content ?? ''))
        }
        const style = mergeMarksWithInherited(nextInherited, marks)
        pushStyledFragment(runs, node.text ?? '', style.bold, style.italic, style.underline, style.strike)
      } else if (node.type === 'hardBreak') {
        pushStyledFragment(runs, ' ', undefined, undefined, undefined)
      } else if (node.type === 'mention') {
        const label =
          String((node.attrs as { label?: string; id?: string } | undefined)?.label ??
            (node.attrs as { id?: string } | undefined)?.id ??
            '')
        pushStyledFragment(runs, label ? `@${label}` : '@', undefined, undefined, undefined)
      } else if (node.content) {
        visit(node.content, nextInherited)
      }
    }
  }
  visit(nodes)
  return runs
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
    const runsOut = finalizeRuns(runsFromInline(node.content, buf))
    const text = runsOut.map((r) => r.text).join('')
    out.push({
      type: 'paragraph',
      text,
      ...(runsOut.length > 0 ? { runs: runsOut } : {}),
      ...(quoteDepth > 0 ? { blockquote: true } : {}),
    })
    return
  }

  if (node.type === 'heading') {
    const levelRaw = (node.attrs?.level ?? 1) as number
    const level = (levelRaw === 1 || levelRaw === 2 || levelRaw === 3 ? levelRaw : 1) as 1 | 2 | 3
    const runsOut = finalizeRuns(runsFromInline(node.content, buf))
    const text = runsOut.map((r) => r.text).join('')
    out.push({
      type: 'heading',
      level,
      text,
      ...(runsOut.length > 0 ? { runs: runsOut } : {}),
    })
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
        const runsOut = finalizeRuns(runsFromInline(child.content, buf))
        const text = runsOut.map((r) => r.text).join('')
        const prefix = firstPara ? (ordered ? `${counter.n++}. ` : '• ') : ''
        out.push({
          type: 'paragraph',
          text,
          ...(runsOut.length > 0 ? { runs: runsOut } : {}),
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
