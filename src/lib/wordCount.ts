import type { JSONContent } from '@tiptap/core'

/** Local calendar day YYYY-MM-DD */
export function todayLocalISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function countWordsInDoc(doc: JSONContent | undefined): number {
  if (!doc || doc.type !== 'doc') return 0
  let acc = ''
  const walk = (node: JSONContent) => {
    if (node.text) acc += `${node.text} `
    node.content?.forEach(walk)
  }
  doc.content?.forEach(walk)
  return acc.trim().split(/\s+/).filter(Boolean).length
}

export function countCharsInDoc(doc: JSONContent | undefined): number {
  if (!doc || doc.type !== 'doc') return 0
  let n = 0
  const walk = (node: JSONContent) => {
    if (node.text) n += [...node.text].length
    node.content?.forEach(walk)
  }
  doc.content?.forEach(walk)
  return n
}
