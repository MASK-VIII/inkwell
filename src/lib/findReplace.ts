import type { JSONContent } from '@tiptap/core'
import type { Manuscript } from '../types'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceInNode(node: JSONContent, re: RegExp, replace: string): JSONContent {
  if (node.type === 'text' && node.text != null) {
    return { ...node, text: node.text.replace(re, replace) }
  }
  if (node.content?.length) {
    return { ...node, content: node.content.map((c) => replaceInNode(c, re, replace)) }
  }
  return node
}

export function replaceInDoc(doc: JSONContent, find: string, replace: string, caseSensitive: boolean): JSONContent {
  if (!find) return doc
  const re = new RegExp(escapeRegex(find), caseSensitive ? 'g' : 'gi')
  return replaceInNode({ ...doc }, re, replace)
}

export function countOccurrencesInDoc(doc: JSONContent, find: string, caseSensitive: boolean): number {
  if (!find) return 0
  const re = new RegExp(escapeRegex(find), caseSensitive ? 'g' : 'gi')
  let n = 0
  const walk = (node: JSONContent | undefined) => {
    if (!node) return
    if (node.type === 'text' && node.text) {
      const m = node.text.match(re)
      n += m?.length ?? 0
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return n
}

export function countOccurrencesInProject(chapters: Manuscript[], find: string, caseSensitive: boolean): number {
  return chapters.reduce((s, ch) => s + countOccurrencesInDoc(ch.content, find, caseSensitive), 0)
}

export function replaceInAllChapters(
  chapters: Manuscript[],
  find: string,
  replace: string,
  caseSensitive: boolean,
): Manuscript[] {
  if (!find) return chapters
  return chapters.map((ch) => ({
    ...ch,
    content: replaceInDoc(ch.content, find, replace, caseSensitive),
  }))
}
