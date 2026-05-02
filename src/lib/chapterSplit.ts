import type { JSONContent } from '@tiptap/core'

export function splitDocAtTopLevelIndex(doc: JSONContent, indexExclusive: number): [JSONContent, JSONContent] | null {
  if (!doc || doc.type !== 'doc' || !doc.content) return null
  const c = [...doc.content]
  if (indexExclusive <= 0 || indexExclusive >= c.length) return null
  const left: JSONContent = { ...doc, content: c.slice(0, indexExclusive) }
  const rightContent = c.slice(indexExclusive)
  const right: JSONContent = {
    ...doc,
    content: rightContent.length > 0 ? rightContent : [{ type: 'paragraph' }],
  }
  return [left, right]
}

export function mergeDocContents(a: JSONContent, b: JSONContent): JSONContent {
  const ac = a.type === 'doc' && a.content ? [...a.content] : []
  const bc = b.type === 'doc' && b.content ? [...b.content] : []
  return { type: 'doc', content: [...ac, ...bc] }
}
