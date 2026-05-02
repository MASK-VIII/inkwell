import type { JSONContent } from '@tiptap/core'
import { compress, decompress } from 'lz-string'
import type {
  InkwellProject,
  Manuscript,
  ProjectIndex,
  ProjectKind,
  ProjectMeta,
  WritingGoals,
} from '../types'
import { defaultBookMeta, defaultTheme, defaultWritingGoals } from '../types'
import { hashStringDjb2 } from './hash'
import { countWordsInDoc, todayLocalISODate } from './wordCount'

const STORAGE_KEY_V1 = 'inkwell-manuscripts-v1'
const STORAGE_KEY_V2 = 'inkwell-project-v2'
const STORAGE_INDEX = 'inkwell-project-index-v1'
const STORAGE_ACTIVE_ID = 'inkwell-active-project-id'
const STORAGE_PROJECT_PREFIX = 'inkwell-project-v3:'
const STORAGE_HISTORY_PREFIX = 'inkwell-history:'
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

function projectKey(id: string): string {
  return `${STORAGE_PROJECT_PREFIX}${id}`
}

function historyKey(id: string): string {
  return `${STORAGE_HISTORY_PREFIX}${id}`
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
  return {
    id: m.id,
    title: typeof m.title === 'string' ? m.title : '',
    createdAt,
    updatedAt,
    kind: normalizeKind(m.kind),
    linkedBookId: m.linkedBookId ?? null,
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
  })
}

type LegacyV2 = {
  version: 2
  book: unknown
  goals: unknown
  chapters: Manuscript[]
}

function normalizeProjectV3(parsed: Partial<InkwellProject>, id: string): InkwellProject {
  const chapters =
    Array.isArray(parsed.chapters) && parsed.chapters.length > 0 ? parsed.chapters : seedChapters()

  const themeDefaults = defaultTheme()
  const parsedTheme = (parsed.theme ?? {}) as Partial<InkwellProject['theme']>
  const normalizedTheme: InkwellProject['theme'] = {
    print: { ...themeDefaults.print, ...((parsedTheme.print ?? {}) as Partial<InkwellProject['theme']['print']>) },
    ebook: { ...themeDefaults.ebook, ...((parsedTheme.ebook ?? {}) as Partial<InkwellProject['theme']['ebook']>) },
  }

  const kind = normalizeKind(parsed.kind)
  const linkedBookId =
    parsed.linkedBookId === undefined || parsed.linkedBookId === null || parsed.linkedBookId === ''
      ? null
      : String(parsed.linkedBookId)

  return withAlignedGoals({
    version: 3,
    id,
    kind,
    linkedBookId: kind === 'note' ? linkedBookId : null,
    book: { ...defaultBookMeta(), ...(parsed.book ?? {}) },
    goals: { ...defaultWritingGoals(), ...(parsed.goals ?? {}) } as WritingGoals,
    chapters,
    theme: normalizedTheme,
  })
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

export function listLinkedNotesForBook(bookId: string, metas = listProjects()): ProjectMeta[] {
  return metas.filter((m) => m.kind === 'note' && m.linkedBookId === bookId)
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

export function loadProject(id: string): InkwellProject | null {
  try {
    const raw = localStorage.getItem(projectKey(id))
    if (!raw) return null
    const parsed = decodeFromStorage(raw) as Partial<InkwellProject>
    if (parsed && parsed.version === 3) return normalizeProjectV3(parsed, id)
  } catch {
    /* fall through */
  }
  return null
}

function trimOneHistorySnapshot(projectId: string): boolean {
  const h = loadHistoryRaw(projectId)
  if (h.entries.length === 0) return false
  const removed = h.entries.pop()!
  delete h.snapshotsById[removed.id]
  persistHistoryBlob(projectId, h)
  return true
}

/** Writes history; on quota, drops oldest snapshots until it fits or history is empty. */
function persistHistoryBlob(projectId: string, next: StoredHistory): void {
  let working = next
  for (let attempt = 0; attempt < 250; attempt++) {
    const payload = encodeForStorage(working)
    try {
      localStorage.setItem(historyKey(projectId), payload)
      return
    } catch (e) {
      if (!isQuotaExceeded(e)) throw e
      if (working.entries.length <= 0) {
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

/** Writes the project blob; on quota, trims this book's history (oldest first) and retries. */
function persistProjectBlob(projectId: string, normalized: InkwellProject): void {
  for (let attempt = 0; attempt < 250; attempt++) {
    const payload = encodeForStorage(normalized)
    try {
      localStorage.setItem(projectKey(projectId), payload)
      return
    } catch (e) {
      if (!isQuotaExceeded(e)) throw e
      if (!trimOneHistorySnapshot(projectId)) throw e
    }
  }
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
  const existingRaw = idx.projects.find((p) => p.id === normalized.id) ?? null
  const existing = existingRaw ? normalizeProjectMeta(existingRaw) : null
  const nextMeta: ProjectMeta = existing
    ? {
        ...existing,
        title: metaTitle,
        updatedAt: now,
        kind: normalized.kind,
        linkedBookId: normalized.kind === 'note' ? normalized.linkedBookId ?? null : null,
      }
    : {
        id: normalized.id,
        title: metaTitle,
        createdAt: now,
        updatedAt: now,
        kind: normalized.kind,
        linkedBookId: normalized.kind === 'note' ? normalized.linkedBookId ?? null : null,
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
    const raw = localStorage.getItem(historyKey(projectId))
    if (!raw) return { version: 1, entries: [], snapshotsById: {} }
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

export function createBookProject(): InkwellProject {
  const id = newId()
  const project = seedBookProject(id)
  saveProject(project)
  setActiveProjectId(id)
  return project
}

/** @deprecated use createBookProject */
export function createProject(): InkwellProject {
  return createBookProject()
}

export function createNoteProject(options?: { linkedBookId?: string | null }): InkwellProject {
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
  })
  saveProject(project)
  setActiveProjectId(id)
  return project
}

export function deleteProject(id: string): void {
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
