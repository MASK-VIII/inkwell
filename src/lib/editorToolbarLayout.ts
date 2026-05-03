/** Persisted toolbar layout: draggable slots + overflow ("More"). */

export const TOOLBAR_LAYOUT_STORAGE_KEY = 'inkwell-toolbar-layout-v1'

export const KNOWN_TOOL_IDS = [
  'heading',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'bulletList',
  'orderedList',
  'blockquote',
  'align',
  'link',
  'sceneBreak',
  'image',
  'comment',
  'footnote',
  'mention',
] as const

export type ToolId = (typeof KNOWN_TOOL_IDS)[number]

/** Vertical rule between groups; may appear multiple times. */
export type ToolbarRowEntry = ToolId | 'divider'

export type ToolbarLayoutState = {
  primary: ToolbarRowEntry[]
  overflow: ToolbarRowEntry[]
}

const ENTRY_SET = new Set<string>([...KNOWN_TOOL_IDS, 'divider'])

function isRowEntry(s: unknown): s is ToolbarRowEntry {
  return typeof s === 'string' && ENTRY_SET.has(s)
}

/** Default matches pre-customizable editor: full row inline, empty overflow. */
export function defaultToolbarLayout(): ToolbarLayoutState {
  return {
    primary: [
      'heading',
      'divider',
      'bold',
      'italic',
      'underline',
      'strikethrough',
      'bulletList',
      'orderedList',
      'divider',
      'blockquote',
      'align',
      'link',
      'divider',
      'sceneBreak',
      'image',
      'comment',
      'footnote',
      'mention',
    ],
    overflow: [],
  }
}

/** Drop unknown ids; dedupe tools globally (primary order wins); keep divider slots; append new tools. */
export function migrateToolbarLayout(raw: unknown): ToolbarLayoutState {
  if (!raw || typeof raw !== 'object') return defaultToolbarLayout()

  const p = (raw as { primary?: unknown; overflow?: unknown }).primary
  const o = (raw as { primary?: unknown; overflow?: unknown }).overflow

  const sanitizeList = (arr: unknown): ToolbarRowEntry[] => {
    if (!Array.isArray(arr)) return []
    return arr.filter(isRowEntry)
  }

  const primaryIn = sanitizeList(p)
  const overflowIn = sanitizeList(o)

  const seenTools = new Set<ToolId>()
  const stripDupTools = (list: ToolbarRowEntry[]): ToolbarRowEntry[] => {
    const out: ToolbarRowEntry[] = []
    for (const e of list) {
      if (e === 'divider') {
        out.push('divider')
        continue
      }
      if (seenTools.has(e)) continue
      seenTools.add(e)
      out.push(e)
    }
    return out
  }

  const primary = stripDupTools(primaryIn)
  const overflow = stripDupTools(overflowIn)

  const missingTools = KNOWN_TOOL_IDS.filter((id) => !seenTools.has(id))

  return {
    primary,
    overflow: missingTools.length ? [...overflow, ...missingTools] : overflow,
  }
}

export function loadToolbarLayout(): ToolbarLayoutState {
  try {
    const raw = localStorage.getItem(TOOLBAR_LAYOUT_STORAGE_KEY)
    if (!raw) return defaultToolbarLayout()
    const parsed = JSON.parse(raw) as unknown
    return migrateToolbarLayout(parsed)
  } catch {
    return defaultToolbarLayout()
  }
}

export function saveToolbarLayout(layout: ToolbarLayoutState): void {
  try {
    localStorage.setItem(TOOLBAR_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* ignore */
  }
}
