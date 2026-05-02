import type { JSONContent } from '@tiptap/core'
import type { InkwellProject } from '../../types'
import { manuscriptsForEpub } from '../bookAssembly'

function textFromNode(node: JSONContent | null | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  const parts = (node.content ?? []).map(textFromNode)
  return parts.join('')
}

function plainFromDoc(doc: JSONContent): string {
  if (!doc || doc.type !== 'doc') return ''
  const blocks: string[] = []
  for (const node of doc.content ?? []) {
    if (node.type === 'paragraph') {
      blocks.push(textFromNode(node).trimEnd())
    } else if (node.type === 'heading') {
      blocks.push(textFromNode(node).trim())
    } else if (node.type === 'horizontalRule') {
      blocks.push('---')
    } else if (node.type === 'pageBreak') {
      blocks.push('\n')
    } else {
      const t = textFromNode(node).trim()
      if (t) blocks.push(t)
    }
  }
  return blocks.filter((b) => b.length > 0).join('\n\n')
}

export function buildPlaintextExport(project: InkwellProject): string {
  const spine = manuscriptsForEpub(project)
  const parts: string[] = []
  let i = 0
  for (const ch of spine) {
    i += 1
    const title = ch.title?.trim() || `Section ${i}`
    parts.push(title)
    parts.push('')
    parts.push(plainFromDoc(ch.content))
    parts.push('')
    parts.push('')
  }
  return parts.join('\n').trim() + '\n'
}
