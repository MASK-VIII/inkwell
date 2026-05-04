import type { JSONContent } from '@tiptap/core'

import type { InkwellProject } from '../types'
import { deriveNoteMetaTitle, listLinkedNotesForBook, loadProject } from './manuscripts'

export type BacklinkSource = {
  sourceProjectId: string
  sourceTitle: string
  chapterId: number
  chapterTitle: string
}

/** Collect linked note project ids from @mentions (`noteProjectId`) and `[[wikilink]]` nodes (`projectId`). */
export function collectNoteLinkTargetsFromJSON(node: JSONContent | null | undefined, out: Set<string>): void {
  if (!node) return
  if (node.type === 'mention') {
    const id = node.attrs?.noteProjectId as string | undefined
    if (id?.trim()) out.add(id.trim())
  }
  if (node.type === 'inkwellWikilink') {
    const id = node.attrs?.projectId as string | undefined
    if (id?.trim()) out.add(id.trim())
  }
  const content = node.content
  if (Array.isArray(content)) {
    for (const c of content) collectNoteLinkTargetsFromJSON(c, out)
  }
}

/**
 * Projects in the same shelf cluster (master + linked notes) whose prose links to `targetNoteId`.
 * Capped for performance on large libraries.
 */
export function listBacklinksToNote(
  targetNoteId: string,
  shelfParentId: string,
  opts?: { maxSources?: number },
): BacklinkSource[] {
  const maxSources = opts?.maxSources ?? 50
  const out: BacklinkSource[] = []
  const seen = new Set<string>()

  const scan = (proj: InkwellProject | null, displayTitle: string) => {
    if (!proj || out.length >= maxSources) return
    for (const ch of proj.chapters) {
      if (out.length >= maxSources) return
      const ids = new Set<string>()
      collectNoteLinkTargetsFromJSON(ch.content, ids)
      if (!ids.has(targetNoteId)) continue
      const key = `${proj.id}:${ch.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        sourceProjectId: proj.id,
        sourceTitle: displayTitle,
        chapterId: ch.id,
        chapterTitle: ch.title.trim() || 'Section',
      })
    }
  }

  const master = loadProject(shelfParentId)
  if (master) {
    const title =
      master.kind === 'book' ? master.book.title.trim() || 'Untitled book' : deriveNoteMetaTitle(master)
    scan(master, title)
  }

  const linked = listLinkedNotesForBook(shelfParentId)
  for (const row of linked) {
    if (out.length >= maxSources) break
    if (row.id === targetNoteId) continue
    const p = loadProject(row.id)
    if (!p || p.kind !== 'note') continue
    scan(p, deriveNoteMetaTitle(p))
  }

  return out
}
