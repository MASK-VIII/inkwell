import type { JSONContent } from '@tiptap/core'
import { compress, decompress } from 'lz-string'
import type {
  InkwellProject,
  Manuscript,
  ProjectIndex,
  ProjectKind,
  ProjectMeta,
  SeriesBibleEntry,
  Theme,
  WritingGoals,
} from '../types'
import { coerceInkwellFontId } from './fonts/fontCatalog'
import { isThemePresetId } from './themePresets'
import { defaultBookAssembly, defaultBookMeta, defaultTheme, defaultWritingGoals } from '../types'
import { idbDelete, idbGet, idbSet, isIndexedDbAvailable } from './storage/projectIdb'
import { hashStringDjb2 } from './hash'
import { countWordsInDoc, todayLocalISODate } from './wordCount'

const STORAGE_KEY_V1 = 'inkwell-manuscripts-v1'
const STORAGE_KEY_V2 = 'inkwell-project-v2'
const STORAGE_INDEX = 'inkwell-project-index-v1'
const STORAGE_ACTIVE_ID = 'inkwell-active-project-id'
/** Per browser tab: which project this tab is editing (sessionStorage). */
const STORAGE_TAB_SESSION_PROJECT_ID = 'inkwell-tab-session-project-id'
const STORAGE_LAST_CHAPTER_BY_PROJECT = 'inkwell-last-chapter-by-project-v1'
const STORAGE_PROJECT_PREFIX = 'inkwell-project-v3:'
const STORAGE_HISTORY_PREFIX = 'inkwell-history:'
const STORAGE_PINNED_PROJECT_NOTES = 'inkwell-pinned-project-notes-v1'
/** Per-project master id → ordered list of child note ids pinned inside that project. */
const STORAGE_PROJECT_CHILD_PINS = 'inkwell-project-child-pins-v1'
/** Per-project master id → stable order of unpinned child note ids (shelf / BookTools). */
const STORAGE_PROJECT_CHILD_UNPINNED_ORDER = 'inkwell-project-child-unpinned-order-v1'
/** Full snapshots are large; keep the cap modest for typical ~5MB localStorage quotas. */
const HISTORY_MAX_ENTRIES = 35
const HISTORY_REPLACE_WITHIN_MS = 12_000
/** Compressed payloads; plain JSON (legacy) has no prefix. */
const LZ_PREFIX = 'iwz1:'

function isQuotaExceeded(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.code === 22 || (e as DOMException & { code?: number }).code === 1014)
  )
}

function encodeForStorage(value: unknown): string {
  const json = JSON.stringify(value)
  if (json.length < 512) return json
  const packed = LZ_PREFIX + compress(json)
  return packed.length < json.length ? packed : json
}

function decodeFromStorage(raw: string): unknown {
  if (raw.startsWith(LZ_PREFIX)) {
    const text = decompress(raw.slice(LZ_PREFIX.length))
    if (text == null) throw new SyntaxError('Invalid compressed inkwell payload')
    return JSON.parse(text)
  }
  return JSON.parse(raw)
}

export function projectStorageKey(id: string): string {
  return `${STORAGE_PROJECT_PREFIX}${id}`
}

function projectKey(id: string): string {
  return projectStorageKey(id)
}

export function historyStorageKey(id: string): string {
  return `${STORAGE_HISTORY_PREFIX}${id}`
}

function historyKey(id: string): string {
  return historyStorageKey(id)
}

/** In-memory mirror of encoded project payloads after IndexedDB hydrate. */
const projectPayloadCache = new Map<string, string>()
const historyPayloadCache = new Map<string, string>()

export async function hydrateInkwellStorage(): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return
  }
  const idx = loadIndex()
  for (const p of idx.projects) {
    const key = projectKey(p.id)
    let blob = await idbGet(key)
    if (blob === undefined) {
      try {
        const ls = localStorage.getItem(key)
        if (ls) {
          await idbSet(key, ls)
          blob = ls
        }
      } catch {
        /* ignore */
      }
    }
    if (blob !== undefined) projectPayloadCache.set(p.id, blob)
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(STORAGE_PROJECT_PREFIX)) continue
      const id = k.slice(STORAGE_PROJECT_PREFIX.length)
      if (projectPayloadCache.has(id)) continue
      const ls = localStorage.getItem(k)
      if (ls) {
        projectPayloadCache.set(id, ls)
        await idbSet(k, ls)
      }
    }
  } catch {
    /* ignore */
  }
  for (const p of idx.projects) {
    const hk = historyKey(p.id)
    let hb = await idbGet(hk)
    if (hb === undefined) {
      try {
        const ls = localStorage.getItem(hk)
        if (ls) {
          await idbSet(hk, ls)
          hb = ls
        }
      } catch {
        /* ignore */
      }
    }
    if (hb !== undefined) historyPayloadCache.set(p.id, hb)
  }
}

function cacheProjectPayload(id: string, payload: string): void {
  projectPayloadCache.set(id, payload)
  void idbSet(projectKey(id), payload).catch(() => {})
  try {
    localStorage.setItem(projectKey(id), payload)
  } catch {
    /* IndexedDB remains primary */
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export const defaultDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
})

const NOTE_TITLE_MAX = 72

function firstPlainLineFromDoc(doc: JSONContent | undefined): string {
  if (!doc || doc.type !== 'doc') return ''
  let found = ''
  const walk = (node: JSONContent): boolean => {
    if (node.text) {
      found += node.text
      if (/[\r\n]/.test(found)) return true
      if (found.length >= NOTE_TITLE_MAX) return true
    }
    if (node.content) {
      for (const c of node.content) {
        if (walk(c)) return true
      }
    }
    return false
  }
  doc.content?.some(walk)
  const line = found.split(/\r?\n/)[0]?.trim() ?? ''
  return line.length > NOTE_TITLE_MAX ? `${line.slice(0, NOTE_TITLE_MAX)}…` : line
}

/** Shelf / meta title for note projects */
export function deriveNoteMetaTitle(project: Pick<InkwellProject, 'chapters'>): string {
  const ch0 = project.chapters[0]
  const fromChapter = ch0?.title?.trim() ?? ''
  if (fromChapter) return fromChapter
  const fromDoc = firstPlainLineFromDoc(ch0?.content)
  if (fromDoc) return fromDoc
  return 'Untitled note'
}

function normalizeKind(raw: unknown): ProjectKind {
  return raw === 'note' ? 'note' : 'book'
}

/** Merge defaults for index rows saved before kind / linkedBookId existed */
export function normalizeProjectMeta(m: Partial<ProjectMeta> & Pick<ProjectMeta, 'id'>): ProjectMeta {
  const createdAt = typeof m.createdAt === 'number' ? m.createdAt : typeof m.updatedAt === 'number' ? m.updatedAt : 0
  const updatedAt = typeof m.updatedAt === 'number' ? m.updatedAt : createdAt
  const cover =
    typeof m.coverImageDataUrl === 'string' && m.coverImageDataUrl.length > 0 ? m.coverImageDataUrl : undefined
  return {
    id: m.id,
    title: typeof m.title === 'string' ? m.title : '',
    createdAt,
    updatedAt,
    kind: normalizeKind(m.kind),
    linkedBookId: m.linkedBookId ?? null,
    ...(cover ? { coverImageDataUrl: cover } : {}),
  }
}

function seedChapters(): Manuscript[] {
  return [
    {
      id: 1,
      title: 'Chapter 1',
      content: defaultDoc(),
    },
  ]
}

function seedBookProject(id: string): InkwellProject {
  return withAlignedGoals({
    version: 3,
    id,
    kind: 'book',
    linkedBookId: null,
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters: seedChapters(),
    theme: defaultTheme(),
    assembly: defaultBookAssembly(),
    seriesBible: [],
  })
}

export function totalWordsInChapters(chapters: Manuscript[]): number {
  return chapters.reduce((sum, ch) => sum + countWordsInDoc(ch.content), 0)
}

/** Roll daily baseline when the local calendar day changes. */
export function alignGoalsToDate(goals: WritingGoals, totalBookWords: number): WritingGoals {
  const today = todayLocalISODate()
  if (goals.dailyProgressDate !== today) {
    return {
      ...goals,
      dailyProgressDate: today,
      dailyBaselineWordCount: totalBookWords,
    }
  }
  return goals
}

export function withAlignedGoals(project: InkwellProject): InkwellProject {
  const total = totalWordsInChapters(project.chapters)
  const goals = alignGoalsToDate(project.goals, total)
  return { ...project, goals }
}

function migrateV1Array(id: string, parsed: Manuscript[]): InkwellProject {
  const chapters = Array.isArray(parsed) && parsed.length > 0 ? parsed : seedChapters()
  return withAlignedGoals({
    version: 3,
    id,
    kind: 'book',
    linkedBookId: null,
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters,
    theme: defaultTheme(),
    assembly: defaultBookAssembly(),
    seriesBible: [],
  })
}

type LegacyV2 = {
  version: 2
  book: unknown
  goals: unknown
  chapters: Manuscript[]
}

function normalizeSeriesBible(raw: unknown): SeriesBibleEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const o = row as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id : ''
      const name = typeof o.name === 'string' ? o.name : ''
      const notes = typeof o.notes === 'string' ? o.notes : ''
      const kindRaw = o.kind
      const kind: SeriesBibleEntry['kind'] =
        kindRaw === 'character' || kindRaw === 'place' || kindRaw === 'thread' || kindRaw === 'other' ?
          kindRaw
        : 'other'
      if (!id || !name) return null
      return { id, kind, name, notes }
    })
    .filter((x): x is SeriesBibleEntry => x != null)
}

function normalizeStoredTheme(parsedTheme: Partial<Theme> | undefined): Theme {
  const d = defaultTheme()
  const pIn = (parsedTheme?.print ?? {}) as Record<string, unknown>
  const eIn = (parsedTheme?.ebook ?? {}) as Record<string, unknown>
  const print: Theme['print'] = {
    ...d.print,
    ...(parsedTheme?.print as Partial<Theme['print']>),
    bodyFontId: coerceInkwellFontId(pIn.bodyFontId, pIn.fontFamily),
  }
  const ebook: Theme['ebook'] = {
    ...d.ebook,
    ...(parsedTheme?.ebook as Partial<Theme['ebook']>),
    bodyFontId: coerceInkwellFontId(eIn.bodyFontId, eIn.fontFamily),
    embedFontsInEpub:
      typeof eIn.embedFontsInEpub === 'boolean' ? eIn.embedFontsInEpub : d.ebook.embedFontsInEpub,
  }
  delete (print as Record<string, unknown>).fontFamily
  delete (ebook as Record<string, unknown>).fontFamily

  const rawPrintLast =
    parsedTheme && 'lastPrintInteriorPresetId' in parsedTheme ?
      parsedTheme.lastPrintInteriorPresetId
    : undefined
  const rawEbookLast =
    parsedTheme && 'lastEbookInteriorPresetId' in parsedTheme ?
      parsedTheme.lastEbookInteriorPresetId
    : undefined
  const rawLegacy =
    parsedTheme && 'lastInteriorPresetId' in parsedTheme ? parsedTheme.lastInteriorPresetId : undefined

  const normalizePresetKey = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string') return undefined
    return isThemePresetId(raw) ? raw : undefined
  }

  let lastPrintInteriorPresetId = normalizePresetKey(rawPrintLast)
  let lastEbookInteriorPresetId = normalizePresetKey(rawEbookLast)
  if (lastPrintInteriorPresetId === undefined && lastEbookInteriorPresetId === undefined) {
    const leg = normalizePresetKey(rawLegacy)
    if (leg) {
      lastPrintInteriorPresetId = leg
      lastEbookInteriorPresetId = leg
    }
  }

  return {
    print,
    ebook,
    ...(lastPrintInteriorPresetId !== undefined ? { lastPrintInteriorPresetId } : {}),
    ...(lastEbookInteriorPresetId !== undefined ? { lastEbookInteriorPresetId } : {}),
  }
}

function normalizeProjectV3(parsed: Partial<InkwellProject>, id: string): InkwellProject {
  const chapters =
    Array.isArray(parsed.chapters) && parsed.chapters.length > 0 ? parsed.chapters : seedChapters()

  const parsedTheme = (parsed.theme ?? {}) as Partial<InkwellProject['theme']>
  const normalizedTheme = normalizeStoredTheme(parsedTheme)

  const kind = normalizeKind(parsed.kind)
  const linkedBookId =
    parsed.linkedBookId === undefined || parsed.linkedBookId === null || parsed.linkedBookId === ''
      ? null
      : String(parsed.linkedBookId)

  const assemblyDefaults = defaultBookAssembly()
  const parsedAssembly = (parsed.assembly ?? {}) as Partial<InkwellProject['assembly']>

  return withAlignedGoals({
    version: 3,
    id,
    kind,
    linkedBookId: kind === 'note' ? linkedBookId : null,
    book: { ...defaultBookMeta(), ...(parsed.book ?? {}) },
    goals: { ...defaultWritingGoals(), ...(parsed.goals ?? {}) } as WritingGoals,
    chapters,
    theme: normalizedTheme,
    assembly: {
      ...assemblyDefaults,
      ...parsedAssembly,
    },
    seriesBible: normalizeSeriesBible(parsed.seriesBible),
    exportExtras: parsed.exportExtras && typeof parsed.exportExtras === 'object' ? parsed.exportExtras : undefined,
  })
}

/** Import / archive normalization (public alias). */
export function normalizeImportedProject(parsed: Partial<InkwellProject>, id: string): InkwellProject {
  return normalizeProjectV3(parsed, id)
}

function migrateV2ToV3(id: string, parsed: LegacyV2): InkwellProject {
  const chapters = Array.isArray(parsed.chapters) && parsed.chapters.length > 0 ? parsed.chapters : seedChapters()
  return withAlignedGoals({
    version: 3,
    id,
    kind: 'book',
    linkedBookId: null,
    book: { ...defaultBookMeta(), ...(parsed.book as object) } as InkwellProject['book'],
    goals: { ...defaultWritingGoals(), ...(parsed.goals as object) } as WritingGoals,
    chapters,
    theme: defaultTheme(),
    assembly: defaultBookAssembly(),
    seriesBible: [],
  })
}

function loadIndex(): ProjectIndex {
  try {
    const raw = localStorage.getItem(STORAGE_INDEX)
    if (!raw) return { version: 1, projects: [] }
    const parsed = JSON.parse(raw) as Partial<ProjectIndex>
    if (parsed && parsed.version === 1 && Array.isArray(parsed.projects)) {
      return {
        version: 1,
        projects: (parsed.projects as Partial<ProjectMeta>[]).map((row) =>
          normalizeProjectMeta(row as Partial<ProjectMeta> & Pick<ProjectMeta, 'id'>),
        ),
      }
    }
  } catch {
    /* ignore */
  }
  return { version: 1, projects: [] }
}

function saveIndex(idx: ProjectIndex): ProjectIndex {
  localStorage.setItem(STORAGE_INDEX, JSON.stringify(idx))
  return idx
}

export function loadProjectIndex(): ProjectIndex {
  return loadIndex()
}

export function saveProjectIndex(idx: ProjectIndex): void {
  saveIndex(idx)
}

export function listProjects(): ProjectMeta[] {
  return loadIndex()
    .projects.map((row) => normalizeProjectMeta(row))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function listBookMetas(metas = listProjects()): ProjectMeta[] {
  return metas.filter((m) => m.kind === 'book')
}

/** General scratchpad notes (not stuck to a book) */
export function listGeneralNoteMetas(metas = listProjects()): ProjectMeta[] {
  return metas.filter((m) => m.kind === 'note' && !m.linkedBookId)
}

/** Notes whose parent on the shelf is this project id (book or note). */
export function listLinkedNotesForBook(bookId: string, metas = listProjects()): ProjectMeta[] {
  return metas.filter((m) => m.kind === 'note' && m.linkedBookId === bookId)
}

function loadPinnedProjectNotesRaw(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_PINNED_PROJECT_NOTES)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []
  } catch {
    return []
  }
}

function savePinnedProjectNotesRaw(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_PINNED_PROJECT_NOTES, JSON.stringify(Array.from(new Set(ids)).sort()))
  } catch {
    /* ignore */
  }
}

export function isProjectNotePinned(noteId: string): boolean {
  return loadPinnedProjectNotesRaw().includes(noteId)
}

/** Keeps a project-note in the Projects section even if it has no children. */
export function pinProjectNote(noteId: string): void {
  const cur = loadPinnedProjectNotesRaw()
  if (cur.includes(noteId)) return
  cur.push(noteId)
  savePinnedProjectNotesRaw(cur)
}

export function unpinProjectNote(noteId: string): void {
  const cur = loadPinnedProjectNotesRaw()
  if (!cur.includes(noteId)) return
  savePinnedProjectNotesRaw(cur.filter((id) => id !== noteId))
}

function loadProjectChildPinsMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECT_CHILD_PINS)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== 'string' || !Array.isArray(v)) continue
      out[k] = v
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim())
    }
    return out
  } catch {
    return {}
  }
}

function saveProjectChildPinsMap(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(STORAGE_PROJECT_CHILD_PINS, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function loadProjectChildUnpinnedOrderMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECT_CHILD_UNPINNED_ORDER)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== 'string' || !Array.isArray(v)) continue
      out[k] = v
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim())
    }
    return out
  } catch {
    return {}
  }
}

function saveProjectChildUnpinnedOrderMap(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(STORAGE_PROJECT_CHILD_UNPINNED_ORDER, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/** Ordered ids of child notes pinned under this project master (shelf note id). */
export function getPinnedChildNoteIdsForProject(masterId: string): string[] {
  return loadProjectChildPinsMap()[masterId] ?? []
}

function removeChildNoteIdFromUnpinnedOrder(masterId: string, childNoteId: string): void {
  const um = loadProjectChildUnpinnedOrderMap()
  const list = um[masterId]
  if (!list) return
  const next = list.filter((id) => id !== childNoteId)
  if (next.length === 0) delete um[masterId]
  else um[masterId] = next
  saveProjectChildUnpinnedOrderMap(um)
}

function appendChildNoteToUnpinnedOrder(masterId: string, childNoteId: string): void {
  const um = loadProjectChildUnpinnedOrderMap()
  const list = [...(um[masterId] ?? [])].filter((id) => id !== childNoteId)
  list.push(childNoteId)
  um[masterId] = list
  saveProjectChildUnpinnedOrderMap(um)
}

/**
 * When a child note is attached under `masterId`, append it to the unpinned order (unless it is pinned in-project).
 */
export function registerNoteAttachedUnderMaster(masterId: string, childNoteId: string): void {
  const child = loadProject(childNoteId)
  if (!child || child.kind !== 'note' || child.linkedBookId !== masterId) return
  if (getPinnedChildNoteIdsForProject(masterId).includes(childNoteId)) return
  appendChildNoteToUnpinnedOrder(masterId, childNoteId)
}

/**
 * Remove a child id from pinned + unpinned shelf lists for this master (note left the project entirely).
 */
export function purgeChildNoteFromProjectShelfLists(masterId: string, childNoteId: string): void {
  const m = loadProjectChildPinsMap()
  const plist = m[masterId]
  if (plist) {
    const next = plist.filter((id) => id !== childNoteId)
    if (next.length === 0) delete m[masterId]
    else m[masterId] = next
    saveProjectChildPinsMap(m)
  }
  removeChildNoteIdFromUnpinnedOrder(masterId, childNoteId)
}

/**
 * Unpinned child notes in stable user order; seeds once from `updatedAt` when storage is empty.
 */
export function resolveUnpinnedChildOrder(masterId: string, unpinnedKids: ProjectMeta[]): ProjectMeta[] {
  if (unpinnedKids.length === 0) return []
  const validIds = new Set(unpinnedKids.map((k) => k.id))
  const byId = new Map(unpinnedKids.map((k) => [k.id, k]))
  const um = loadProjectChildUnpinnedOrderMap()
  let stored = um[masterId]
  let dirty = false
  if (!stored || stored.length === 0) {
    stored = unpinnedKids.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((k) => k.id)
    um[masterId] = stored
    saveProjectChildUnpinnedOrderMap(um)
    dirty = false
  }
  const ordered = stored.filter((id) => validIds.has(id))
  if (ordered.length !== stored.length) dirty = true
  for (const k of unpinnedKids) {
    if (!ordered.includes(k.id)) {
      ordered.push(k.id)
      dirty = true
    }
  }
  if (dirty) {
    um[masterId] = ordered
    saveProjectChildUnpinnedOrderMap(um)
  }
  return ordered.map((id) => byId.get(id)!).filter(Boolean)
}

export function listLinkedNotesForBookInShelfOrder(bookId: string, metas = listProjects()): ProjectMeta[] {
  const all = listLinkedNotesForBook(bookId, metas)
  const kidById = new Map(all.map((k) => [k.id, k]))
  const pinnedOrder = getPinnedChildNoteIdsForProject(bookId)
  const pinnedKids = pinnedOrder.map((id) => kidById.get(id)).filter((k): k is ProjectMeta => k != null)
  const pinnedSet = new Set(pinnedKids.map((k) => k.id))
  const unpinnedRaw = all.filter((k) => !pinnedSet.has(k.id))
  const unpinnedKids = resolveUnpinnedChildOrder(bookId, unpinnedRaw)
  return [...pinnedKids, ...unpinnedKids]
}

export function reorderPinnedChildNotesInProject(
  masterId: string,
  draggedId: string,
  referenceId: string,
  place: 'before' | 'after',
): void {
  const m = loadProjectChildPinsMap()
  let list = [...(m[masterId] ?? [])]
  if (!list.includes(draggedId) || !list.includes(referenceId) || draggedId === referenceId) return
  list = list.filter((id) => id !== draggedId)
  const refIdx = list.indexOf(referenceId)
  if (refIdx < 0) return
  const insertAt = place === 'before' ? refIdx : refIdx + 1
  list.splice(insertAt, 0, draggedId)
  m[masterId] = list
  saveProjectChildPinsMap(m)
}

export function reorderUnpinnedChildNotesInProject(
  masterId: string,
  draggedId: string,
  referenceId: string,
  place: 'before' | 'after',
): void {
  const um = loadProjectChildUnpinnedOrderMap()
  let list = [...(um[masterId] ?? [])]
  if (!list.includes(draggedId) || !list.includes(referenceId) || draggedId === referenceId) return
  list = list.filter((id) => id !== draggedId)
  const refIdx = list.indexOf(referenceId)
  if (refIdx < 0) return
  const insertAt = place === 'before' ? refIdx : refIdx + 1
  list.splice(insertAt, 0, draggedId)
  um[masterId] = list
  saveProjectChildUnpinnedOrderMap(um)
}

export function pinChildNoteInProject(masterId: string, childNoteId: string): void {
  const child = loadProject(childNoteId)
  if (!child || child.kind !== 'note' || child.linkedBookId !== masterId) return
  removeChildNoteIdFromUnpinnedOrder(masterId, childNoteId)
  const m = loadProjectChildPinsMap()
  const list = [...(m[masterId] ?? [])]
  if (list.includes(childNoteId)) return
  list.push(childNoteId)
  m[masterId] = list
  saveProjectChildPinsMap(m)
}

export function unpinChildNoteInProject(masterId: string, childNoteId: string): void {
  const m = loadProjectChildPinsMap()
  const list = m[masterId]
  if (!list) return
  const next = list.filter((id) => id !== childNoteId)
  if (next.length === 0) delete m[masterId]
  else m[masterId] = next
  saveProjectChildPinsMap(m)
  const child = loadProject(childNoteId)
  if (child && child.kind === 'note' && child.linkedBookId === masterId) {
    appendChildNoteToUnpinnedOrder(masterId, childNoteId)
  }
}

export function removeChildNoteFromAllProjectPins(childNoteId: string): void {
  const m = loadProjectChildPinsMap()
  let dirty = false
  for (const key of Object.keys(m)) {
    const cur = m[key]!
    const next = cur.filter((id) => id !== childNoteId)
    if (next.length !== cur.length) dirty = true
    if (next.length === 0) delete m[key]
    else m[key] = next
  }
  if (dirty) saveProjectChildPinsMap(m)

  const um = loadProjectChildUnpinnedOrderMap()
  let uDirty = false
  for (const key of Object.keys(um)) {
    const cur = um[key]!
    const next = cur.filter((id) => id !== childNoteId)
    if (next.length !== cur.length) uDirty = true
    if (next.length === 0) delete um[key]
    else um[key] = next
  }
  if (uDirty) saveProjectChildUnpinnedOrderMap(um)
}

export function migrateProjectChildPins(oldMasterId: string, newMasterId: string): void {
  const m = loadProjectChildPinsMap()
  const oldList = m[oldMasterId]
  if (oldList && oldList.length > 0) {
    const merged = [...(m[newMasterId] ?? [])]
    for (const id of oldList) {
      if (!merged.includes(id)) merged.push(id)
    }
    m[newMasterId] = merged
    delete m[oldMasterId]
    saveProjectChildPinsMap(m)
  }

  const um = loadProjectChildUnpinnedOrderMap()
  const oldU = um[oldMasterId]
  if (oldU && oldU.length > 0) {
    const mergedU = [...(um[newMasterId] ?? [])]
    for (const id of oldU) {
      if (!mergedU.includes(id)) mergedU.push(id)
    }
    um[newMasterId] = mergedU
    delete um[oldMasterId]
    saveProjectChildUnpinnedOrderMap(um)
  } else if (um[oldMasterId]) {
    delete um[oldMasterId]
    saveProjectChildUnpinnedOrderMap(um)
  }
}

export function clearProjectChildPins(masterId: string): void {
  const m = loadProjectChildPinsMap()
  if (m[masterId]) {
    delete m[masterId]
    saveProjectChildPinsMap(m)
  }
  const um = loadProjectChildUnpinnedOrderMap()
  if (um[masterId]) {
    delete um[masterId]
    saveProjectChildUnpinnedOrderMap(um)
  }
}

export function noteHasChildren(noteId: string, metas = listProjects()): boolean {
  return metas.some((m) => m.kind === 'note' && m.linkedBookId === noteId)
}

export function listProjectNoteMetas(metas = listProjects()): ProjectMeta[] {
  const pinned = new Set(loadPinnedProjectNotesRaw())
  const rows = metas.filter(
    (m) => m.kind === 'note' && !m.linkedBookId && (noteHasChildren(m.id, metas) || pinned.has(m.id)),
  )
  return rows.slice().sort((a, b) => {
    const ca = listLinkedNotesForBook(a.id, metas).length
    const cb = listLinkedNotesForBook(b.id, metas).length
    if (cb !== ca) return cb - ca
    return b.updatedAt - a.updatedAt
  })
}

export function listLooseNoteMetas(metas = listProjects()): ProjectMeta[] {
  const pinned = new Set(loadPinnedProjectNotesRaw())
  return metas.filter(
    (m) => m.kind === 'note' && !m.linkedBookId && !noteHasChildren(m.id, metas) && !pinned.has(m.id),
  )
}

/**
 * True if assigning `noteId`'s parent to `newParentId` would put the note under its own descendant
 * (infinite loop). `newParentId` may be a book or note project id.
 */
export function wouldCreateNoteAttachmentCycle(noteId: string, newParentId: string): boolean {
  if (noteId === newParentId) return true
  let walk: string | null = newParentId
  for (let i = 0; i < 4096 && walk; i++) {
    if (walk === noteId) return true
    const p = loadProject(walk)
    if (!p) break
    const next = p.linkedBookId
    walk = next === undefined || next === null || next === '' ? null : String(next)
  }
  return false
}

export function setActiveProjectId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_ACTIVE_ID, id)
    else localStorage.removeItem(STORAGE_ACTIVE_ID)
  } catch {
    /* ignore */
  }
}

export function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(STORAGE_ACTIVE_ID)
  } catch {
    return null
  }
}

export function getTabSessionProjectId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_TAB_SESSION_PROJECT_ID)
    const id = typeof raw === 'string' ? raw.trim() : ''
    return id.length > 0 ? id : null
  } catch {
    return null
  }
}

export function setTabSessionProjectId(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id) sessionStorage.setItem(STORAGE_TAB_SESSION_PROJECT_ID, id)
    else sessionStorage.removeItem(STORAGE_TAB_SESSION_PROJECT_ID)
  } catch {
    /* ignore */
  }
}

/** Query string key for opening a specific book/note on load (`?project=<id>`). */
export const INKWELL_OPEN_PROJECT_QUERY_KEY = 'project'

/** Read project id from the current page URL (for new-tab / shareable links). */
export function readOpenProjectIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = new URLSearchParams(window.location.search).get(INKWELL_OPEN_PROJECT_QUERY_KEY)
    const id = typeof raw === 'string' ? raw.trim() : ''
    return id.length > 0 ? id : null
  } catch {
    return null
  }
}

/**
 * Full URL to open a book or note in another tab (same origin; project data is read from localStorage there).
 */
export function buildInkwellUrlForProject(projectId: string): string {
  if (typeof window === 'undefined') return ''
  try {
    const u = new URL(window.location.href)
    u.searchParams.set(INKWELL_OPEN_PROJECT_QUERY_KEY, projectId)
    u.hash = '#write'
    return u.toString()
  } catch {
    return ''
  }
}

/** Open a book/note in a new tab (same origin; project data is read from localStorage there). */
export function openInkwellProjectInNewTab(projectId: string): void {
  if (typeof window === 'undefined') return
  const href = buildInkwellUrlForProject(projectId)
  if (!href) return
  window.open(href, '_blank', 'noopener,noreferrer')
}

function loadLastChapterMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_LAST_CHAPTER_BY_PROJECT)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function saveLastChapterMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_LAST_CHAPTER_BY_PROJECT, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/** Last focused chapter id for a project, if any. */
export function getLastOpenChapterId(projectId: string): number | null {
  const n = loadLastChapterMap()[projectId]
  return n !== undefined ? n : null
}

/** Persist which chapter was open for reload / resume. */
export function rememberOpenChapter(projectId: string, chapterId: number | null): void {
  const map = loadLastChapterMap()
  if (chapterId == null) delete map[projectId]
  else map[projectId] = chapterId
  saveLastChapterMap(map)
}

export function forgetOpenChapter(projectId: string): void {
  const map = loadLastChapterMap()
  if (map[projectId] === undefined) return
  delete map[projectId]
  saveLastChapterMap(map)
}

/** Chapter to show when opening a project (remembered id if still valid, else first). */
export function resolveResumeChapterId(project: InkwellProject): number | null {
  const remembered = getLastOpenChapterId(project.id)
  if (remembered != null && project.chapters.some((c) => c.id === remembered)) return remembered
  return project.chapters[0]?.id ?? null
}

export function loadProject(id: string): InkwellProject | null {
  try {
    const raw =
      projectPayloadCache.get(id) ??
      (() => {
        try {
          return localStorage.getItem(projectKey(id))
        } catch {
          return null
        }
      })()
    if (!raw) return null
    if (!projectPayloadCache.has(id)) projectPayloadCache.set(id, raw)
    const parsed = decodeFromStorage(raw) as Partial<InkwellProject>
    if (parsed && parsed.version === 3) return normalizeProjectV3(parsed, id)
  } catch {
    /* fall through */
  }
  return null
}

/** Writes history; on quota, drops oldest snapshots until it fits or history is empty. */
function persistHistoryBlob(projectId: string, next: StoredHistory): void {
  let working = next
  for (let attempt = 0; attempt < 250; attempt++) {
    const payload = encodeForStorage(working)
    try {
      historyPayloadCache.set(projectId, payload)
      void idbSet(historyKey(projectId), payload)
      localStorage.setItem(historyKey(projectId), payload)
      return
    } catch (e) {
      if (!isQuotaExceeded(e)) {
        historyPayloadCache.set(projectId, payload)
        void idbSet(historyKey(projectId), payload)
        return
      }
      if (working.entries.length <= 0) {
        historyPayloadCache.delete(projectId)
        void idbDelete(historyKey(projectId))
        try {
          localStorage.removeItem(historyKey(projectId))
        } catch {
          /* ignore */
        }
        return
      }
      const removed = working.entries.pop()!
      const nextSnapshots = { ...working.snapshotsById }
      delete nextSnapshots[removed.id]
      working = { version: 1, entries: working.entries, snapshotsById: nextSnapshots }
    }
  }
}

/** Writes the project blob; IndexedDB + cache always; localStorage best-effort. */
function persistProjectBlob(projectId: string, normalized: InkwellProject): void {
  const payload = encodeForStorage(normalized)
  cacheProjectPayload(projectId, payload)
}

export function saveProject(project: InkwellProject): InkwellProject {
  const merged = normalizeProjectV3(project, project.id)
  const normalized = withAlignedGoals(merged)
  persistProjectBlob(normalized.id, normalized)
  const idx = loadIndex()
  const now = Date.now()
  const metaTitle =
    normalized.kind === 'note'
      ? deriveNoteMetaTitle(normalized)
      : normalized.book.title.trim() || normalized.chapters[0]?.title || 'Untitled book'
  const shelfCoverUrl =
    normalized.kind === 'book' &&
    typeof normalized.book.coverImageDataUrl === 'string' &&
    normalized.book.coverImageDataUrl.length > 0
      ? normalized.book.coverImageDataUrl
      : undefined
  const existingRaw = idx.projects.find((p) => p.id === normalized.id) ?? null
  const existing = existingRaw ? normalizeProjectMeta(existingRaw) : null
  const nextMeta: ProjectMeta = existing
    ? {
        id: existing.id,
        title: metaTitle,
        createdAt: existing.createdAt,
        updatedAt: now,
        kind: normalized.kind,
        linkedBookId: normalized.kind === 'note' ? normalized.linkedBookId ?? null : null,
        ...(shelfCoverUrl ? { coverImageDataUrl: shelfCoverUrl } : {}),
      }
    : {
        id: normalized.id,
        title: metaTitle,
        createdAt: now,
        updatedAt: now,
        kind: normalized.kind,
        linkedBookId: normalized.kind === 'note' ? normalized.linkedBookId ?? null : null,
        ...(shelfCoverUrl ? { coverImageDataUrl: shelfCoverUrl } : {}),
      }
  saveIndex({
    version: 1,
    projects: [nextMeta, ...idx.projects.filter((p) => p.id !== normalized.id).map((row) => normalizeProjectMeta(row))],
  })
  return normalized
}

export type ProjectHistoryEntry = {
  /** Monotonic-ish timestamp (ms since epoch). */
  ts: number
  /** Snapshot id (uuid-ish) */
  id: string
  /** Short label for UI, e.g. "Auto", "Before import" */
  label: string
  /** Hash of serialized project for quick dedupe */
  hash: string
  /** Approx serialized bytes (UTF-16 length) */
  bytes: number
}

type StoredHistory = {
  version: 1
  entries: ProjectHistoryEntry[]
  snapshotsById: Record<string, InkwellProject>
}

function loadHistoryRaw(projectId: string): StoredHistory {
  try {
    const raw =
      historyPayloadCache.get(projectId) ??
      (() => {
        try {
          return localStorage.getItem(historyKey(projectId))
        } catch {
          return null
        }
      })()
    if (!raw) return { version: 1, entries: [], snapshotsById: {} }
    if (!historyPayloadCache.has(projectId)) historyPayloadCache.set(projectId, raw)
    const parsed = decodeFromStorage(raw) as Partial<StoredHistory>
    if (parsed && parsed.version === 1 && Array.isArray(parsed.entries) && parsed.snapshotsById) {
      return {
        version: 1,
        entries: parsed.entries as ProjectHistoryEntry[],
        snapshotsById: parsed.snapshotsById as Record<string, InkwellProject>,
      }
    }
  } catch {
    /* ignore */
  }
  return { version: 1, entries: [], snapshotsById: {} }
}

function saveHistoryRaw(projectId: string, next: StoredHistory): void {
  persistHistoryBlob(projectId, next)
}

export function listProjectHistory(projectId: string): ProjectHistoryEntry[] {
  const h = loadHistoryRaw(projectId)
  return h.entries.slice().sort((a, b) => b.ts - a.ts)
}

export function loadProjectSnapshot(projectId: string, snapshotId: string): InkwellProject | null {
  const h = loadHistoryRaw(projectId)
  const raw = h.snapshotsById[snapshotId]
  if (!raw) return null
  return normalizeProjectV3(raw as Partial<InkwellProject>, raw.id ?? projectId)
}

export function clearProjectHistory(projectId: string): void {
  historyPayloadCache.delete(projectId)
  void idbDelete(historyKey(projectId))
  try {
    localStorage.removeItem(historyKey(projectId))
  } catch {
    /* ignore */
  }
}

export function pushProjectHistorySnapshot(
  project: InkwellProject,
  opts?: { label?: string; now?: number; force?: boolean },
): ProjectHistoryEntry | null {
  const now = opts?.now ?? Date.now()
  const label = opts?.label?.trim() || 'Auto'
  const normalized = withAlignedGoals(project)

  const serialized = JSON.stringify(normalized)
  const hash = hashStringDjb2(serialized)
  const bytes = serialized.length

  const h = loadHistoryRaw(normalized.id)
  const last = h.entries[0] ?? null

  if (!opts?.force && last && last.hash === hash) return null

  const entry: ProjectHistoryEntry = {
    ts: now,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `h_${now}_${hash}`,
    label,
    hash,
    bytes,
  }

  const entries = h.entries.slice()
  const snapshotsById: Record<string, InkwellProject> = { ...h.snapshotsById }

  const shouldReplace = !opts?.force && last && now - last.ts <= HISTORY_REPLACE_WITHIN_MS
  if (shouldReplace) {
    // Replace the most recent entry to keep a tight rolling "edit session" snapshot.
    const replaced = entries.shift()!
    delete snapshotsById[replaced.id]
  }

  entries.unshift(entry)
  snapshotsById[entry.id] = normalized

  // Bound size to avoid unbounded growth.
  while (entries.length > HISTORY_MAX_ENTRIES) {
    const removed = entries.pop()!
    delete snapshotsById[removed.id]
  }

  saveHistoryRaw(normalized.id, { version: 1, entries, snapshotsById })
  return entry
}

/** @deprecated use loadProject */
export function loadManuscripts(): Manuscript[] {
  const active = getActiveProjectId()
  if (!active) return []
  return loadProject(active)?.chapters ?? []
}

/** @deprecated use saveProject */
export function saveManuscripts(manuscripts: Manuscript[]) {
  const active = getActiveProjectId()
  if (!active) return
  const existing = loadProject(active)
  if (!existing) return
  saveProject({ ...existing, chapters: manuscripts })
}

export function nextManuscriptId(chapters: Manuscript[]): number {
  return chapters.reduce((max, m) => Math.max(max, m.id), 0) + 1
}

export function createBookProject(options?: { activate?: boolean }): InkwellProject {
  const id = newId()
  const project = seedBookProject(id)
  saveProject(project)
  if (options?.activate !== false) setActiveProjectId(id)
  return project
}

/** @deprecated use createBookProject */
export function createProject(): InkwellProject {
  return createBookProject()
}

export function createNoteProject(options?: {
  linkedBookId?: string | null
  activate?: boolean
}): InkwellProject {
  const id = newId()
  const linked =
    options?.linkedBookId === undefined || options?.linkedBookId === null || options?.linkedBookId === ''
      ? null
      : options.linkedBookId
  const project = withAlignedGoals({
    version: 3,
    id,
    kind: 'note',
    linkedBookId: linked,
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters: [
      {
        id: 1,
        title: '',
        content: defaultDoc(),
      },
    ],
    theme: defaultTheme(),
    assembly: defaultBookAssembly(),
    seriesBible: [],
  })
  saveProject(project)
  if (linked) registerNoteAttachedUnderMaster(linked, id)
  if (options?.activate !== false) setActiveProjectId(id)
  return project
}

/** Creates a new note linked under `parentId` without changing the active project. */
export function createChildNoteProject(parentId: string): InkwellProject | null {
  const parent = loadProject(parentId)
  if (!parent || (parent.kind !== 'book' && parent.kind !== 'note')) return null
  const id = newId()
  const project = withAlignedGoals({
    version: 3,
    id,
    kind: 'note',
    linkedBookId: parentId,
    book: defaultBookMeta(),
    goals: defaultWritingGoals(),
    chapters: [
      {
        id: 1,
        title: '',
        content: defaultDoc(),
      },
    ],
    theme: defaultTheme(),
    assembly: defaultBookAssembly(),
    seriesBible: [],
  })
  saveProject(project)
  registerNoteAttachedUnderMaster(parentId, id)
  return project
}

export function deleteProject(id: string): void {
  projectPayloadCache.delete(id)
  historyPayloadCache.delete(id)
  void idbDelete(projectKey(id))
  void idbDelete(historyKey(id))
  try {
    localStorage.removeItem(projectKey(id))
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(historyKey(id))
  } catch {
    /* ignore */
  }
  const idx = loadIndex()
  saveIndex({
    version: 1,
    projects: idx.projects.filter((p) => p.id !== id).map((row) => normalizeProjectMeta(row)),
  })
  const active = getActiveProjectId()
  if (active === id) {
    setActiveProjectId(null)
  }
  forgetOpenChapter(id)
}

export function ensureAtLeastOneProject(): InkwellProject {
  const active = getActiveProjectId()
  if (active) {
    const p = loadProject(active)
    if (p) return p
  }

  // If index already has projects, open most recent.
  const idx = loadIndex()
  if (idx.projects.length > 0) {
    const id = idx.projects.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]!.id
    const p = loadProject(id)
    if (p) {
      setActiveProjectId(id)
      return p
    }
  }

  // Try to migrate legacy v2 project if present.
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2)
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as LegacyV2
      if (parsed && parsed.version === 2 && Array.isArray(parsed.chapters)) {
        const id = newId()
        const migrated = migrateV2ToV3(id, parsed)
        saveProject(migrated)
        setActiveProjectId(id)
        return migrated
      }
    }
  } catch {
    /* ignore */
  }

  // Try to migrate v1 array.
  try {
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1)
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as Manuscript[]
      const id = newId()
      const migrated = migrateV1Array(id, parsed)
      saveProject(migrated)
      setActiveProjectId(id)
      return migrated
    }
  } catch {
    /* ignore */
  }

  return createBookProject()
}
