import type { JSONContent } from '@tiptap/core'
import { tiptapDocToXhtmlBody } from '../ebook/tiptapRender'

/** Minimal HTML document for clipboard paste (e.g. Substack) or .html download. */
export function buildWebHtmlDocument(doc: JSONContent): string {
  const body = tiptapDocToXhtmlBody(doc)
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${body}</body></html>`
}
