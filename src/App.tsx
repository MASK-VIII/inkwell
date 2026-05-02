import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Folders,
  Library,
  Moon,
  MoreVertical,
  PenLine,
  Plus,
  Search,
  Sun,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { BookTools } from './components/BookTools'
import { PublishHub } from './components/PublishHub'
import { FindReplaceModal } from './components/FindReplaceModal'
import { ShelfLinkedNotesList } from './components/ShelfLinkedNotesList'
import { StickyNotePopout } from './components/book-tools/StickyNotePopout'
import { EbookReview } from './components/EbookReview'
import { ManuscriptEditor } from './components/ManuscriptEditor'
import { ManuscriptRow } from './components/ManuscriptRow'
import { FormatPreviewModeBar } from './components/FormatPreviewModeBar'
import { FormatThemeSidebar } from './components/FormatThemeSidebar'
import { PrintReview } from './components/PrintReview'
import { attachInkwellDragGhost } from './lib/dragGhost'
import { NOTE_DRAG_MIME, NOTE_DRAG_TEXT_PREFIX, readShelfDragNoteId } from './lib/shelfDrag'
import { escapeHtml } from './lib/escapeHtml'
import {
  createBookProject,
  createNoteProject,
  defaultDoc,
  deleteProject,
  deriveNoteMetaTitle,
  ensureAtLeastOneProject,
  hydrateInkwellStorage,
  listBookMetas,
  listLinkedNotesForBook,
  listLinkedNotesForBookInShelfOrder,
  listLooseNoteMetas,
  listProjectNoteMetas,
  listProjects,
  loadProject,
  migrateProjectChildPins,
  nextManuscriptId,
  noteHasChildren,
  openInkwellProjectInNewTab,
  isProjectNotePinned,
  pinProjectNote,
  clearProjectChildPins,
  purgeChildNoteFromProjectShelfLists,
  registerNoteAttachedUnderMaster,
  removeChildNoteFromAllProjectPins,
  unpinProjectNote,
  pushProjectHistorySnapshot,
  listProjectHistory,
  loadProjectSnapshot,
  clearProjectHistory,
  readOpenProjectIdFromLocation,
  rememberOpenChapter,
  resolveResumeChapterId,
  saveProject,
  setActiveProjectId,
  totalWordsInChapters,
  wouldCreateNoteAttachmentCycle,
} from './lib/manuscripts'
import { buildPlaintextExport } from './lib/export/plaintext'
import { buildKdpPdf } from './lib/export/pdfKdp'
import { buildEpub, epubFilename } from './lib/export/epub'
import { importDocxToChapters } from './lib/import/docx'
import { exportLibraryZip, exportProjectZip, importInkwellArchive } from './lib/projectArchive'
import { mergeDocContents, splitDocAtTopLevelIndex } from './lib/chapterSplit'
import { applyThemePreset, type ThemePresetId } from './lib/themePresets'
import { countWordsInDoc } from './lib/wordCount'
import type {
  BookAssembly,
  BookMeta,
  EbookTheme,
  InkwellProject,
  Manuscript,
  PrintTheme,
  SeriesBibleEntry,
  WritingGoals,
} from './types'
import type { MentionItem } from './lib/tiptap/mentionUi'
import type { Editor, JSONContent } from '@tiptap/core'

const THEME_KEY = 'inkwell-theme'
const CHAPTERS_ASIDE_COLLAPSED_KEY = 'inkwell-chapters-aside-collapsed'
const FORMAT_THEME_ASIDE_COLLAPSED_KEY = 'inkwell-format-theme-aside-collapsed'
/** Delay before writing the open book to localStorage after typing stops (keystrokes only update React state). */
const PERSIST_IDLE_MS = 450

type DeletedSnapshot = Manuscript & { originalIndex: number }

type Route = 'bookshelf' | 'write' | 'format_print' | 'format_ebook' | 'publish'

function readInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(THEME_KEY)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return stored === 'dark' || (!stored && prefersDark)
}

function readRouteFromHash(): Route {
  const hash = (typeof window === 'undefined' ? '' : window.location.hash).replace(/^#/, '')
  if (hash === 'bookshelf') return 'bookshelf'
  if (hash === 'format/print' || hash === 'review/print') return 'format_print'
  if (hash === 'format/ebook' || hash === 'review/ebook') return 'format_ebook'
  if (hash === 'publish') return 'publish'
  if (hash === 'write' || hash === '') return 'write'
  return 'write'
}

function routeToHash(route: Route): string {
  switch (route) {
    case 'bookshelf':
      return '#bookshelf'
    case 'format_print':
      return '#format/print'
    case 'format_ebook':
      return '#format/ebook'
    case 'publish':
      return '#publish'
    case 'write':
    default:
      return '#write'
  }
}

function slugDownload(name: string) {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'manuscript'
}

function readInitialEditorSession(): {
  project: InkwellProject
  currentId: number | null
} {
  const fromUrl = readOpenProjectIdFromLocation()
  if (fromUrl) {
    const p = loadProject(fromUrl)
    if (p) {
      setActiveProjectId(fromUrl)
      return { project: p, currentId: resolveResumeChapterId(p) }
    }
  }
  const project = ensureAtLeastOneProject()
  return { project, currentId: resolveResumeChapterId(project) }
}

export default function App() {
  const [route, setRouteState] = useState<Route>(() => readRouteFromHash())
  const [boot] = useState(readInitialEditorSession)
  const [project, setProject] = useState<InkwellProject>(() => boot.project)
  const [currentId, setCurrentId] = useState<number | null>(() => boot.currentId)
  const [ebookEditOpen, setEbookEditOpen] = useState(false)
  const [bookToolsOpen, setBookToolsOpen] = useState(false)
  const [chaptersAsideCollapsed, setChaptersAsideCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(CHAPTERS_ASIDE_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [formatThemeAsideCollapsed, setFormatThemeAsideCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(FORMAT_THEME_ASIDE_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [findReplaceOpen, setFindReplaceOpen] = useState(false)
  const [stickyNotePopoutId, setStickyNotePopoutId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ node: ReactNode; ms: number } | null>(null)
  const [darkMode, setDarkMode] = useState(readInitialDarkMode)
  const lastDeletedRef = useRef<DeletedSnapshot | null>(null)
  const lastDeletedProjectRef = useRef<{ blob: InkwellProject } | null>(null)
  const newProjectMenuRef = useRef<HTMLDivElement | null>(null)
  const docxShelfInputRef = useRef<HTMLInputElement | null>(null)
  const [newProjectMenuOpen, setNewProjectMenuOpen] = useState(false)
  const [stickNoteId, setStickNoteId] = useState<string | null>(null)
  const [stickSelectParentId, setStickSelectParentId] = useState<string>('')
  const [openNoteMenuId, setOpenNoteMenuId] = useState<string | null>(null)
  const [shelfContextMenu, setShelfContextMenu] = useState<{
    x: number
    y: number
    projectId: string
  } | null>(null)
  const shelfContextMenuRef = useRef<HTMLDivElement | null>(null)
  const [shelfDropHoverAttachId, setShelfDropHoverAttachId] = useState<string | null>(null)
  const [shelfDropHoverNotesSection, setShelfDropHoverNotesSection] = useState(false)
  const [shelfDropHoverProjectsSection, setShelfDropHoverProjectsSection] = useState(false)
  const [expandedShelfParentId, setExpandedShelfParentId] = useState<string | null>(null)
  const [, setShelfPinRev] = useState(0)
  const [, setShelfUiTick] = useState(0)
  const [shelfDropHoverTrash, setShelfDropHoverTrash] = useState(false)
  const [shelfProjectChildDropTarget, setShelfProjectChildDropTarget] = useState<{
    masterId: string
    targetId: string
    place: 'before' | 'after'
  } | null>(null)
  const [trashPull, setTrashPull] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const trashDropRef = useRef<HTMLDivElement | null>(null)
  const shelfDraggingNoteIdRef = useRef<string | null>(null)
  /** After a drag, suppress the click that some browsers emit on the source. */
  const shelfNoteHadDragRef = useRef(false)

  const editorRef = useRef<Editor | null>(null)
  const projectRef = useRef(project)
  const historyTimerRef = useRef<number | null>(null)
  const historyLastRecordAtRef = useRef<number>(0)
  const persistIdleTimerRef = useRef<number | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)
  const [historyRev, setHistoryRev] = useState(0)
  /** Bumps when in-place manuscript tree changes but `currentId` can stay the same (DOCX import, history restore). Forces TipTap to remount — otherwise useEditor([manuscriptId]) keeps stale ProseMirror doc and can white-screen. */
  const [editorEpoch, setEditorEpoch] = useState(0)
  const prevProjectIdForEditorRef = useRef(project.id)

  const chapters = project.chapters

  /** Shelf parent for linked notes: book/note id that owns the current project’s note cluster. */
  const shelfParentIdForLinkedNotes = useMemo(() => {
    if (project.kind === 'note' && project.linkedBookId?.trim()) return project.linkedBookId.trim()
    return project.id
  }, [project.kind, project.id, project.linkedBookId])

  /** First row in BookTools “Notes in this project” / “Linked notes”; book or note master. */
  const notesProjectMaster = useMemo(() => {
    if (project.kind !== 'book' && project.kind !== 'note') return null
    const parentId = project.linkedBookId?.trim()
    if (parentId) {
      const m = loadProject(parentId)
      if (!m) {
        return {
          id: parentId,
          title: '',
          kind: 'book' as const,
          isCurrent: false,
          missing: true as const,
        }
      }
      const title = m.kind === 'book' ? m.book.title.trim() || 'Untitled book' : deriveNoteMetaTitle(m)
      return { id: m.id, title, kind: m.kind, isCurrent: false, missing: false as const }
    }
    const title =
      project.kind === 'book' ? project.book.title.trim() || 'Untitled book' : deriveNoteMetaTitle(project)
    return { id: project.id, title, kind: project.kind, isCurrent: true, missing: false as const }
  }, [project.kind, project.id, project.linkedBookId, project.book.title, project.chapters])

  /** Child notes under the shelf parent; excludes current note so it isn’t duplicated in the list. */
  const linkedNotesForBookPanel = useMemo(() => {
    if (project.kind !== 'book' && project.kind !== 'note') return []
    return listLinkedNotesForBookInShelfOrder(shelfParentIdForLinkedNotes).filter((n) => n.id !== project.id)
  }, [project.kind, project.id, shelfParentIdForLinkedNotes])

  const mentionItems = useMemo((): MentionItem[] => {
    const items: MentionItem[] = []
    const author = project.book.authorName.trim()
    if (author) items.push({ id: 'mention:author', label: author })
    const bookTitle = project.book.title.trim()
    if (bookTitle) items.push({ id: 'mention:book', label: bookTitle })
    for (const ch of chapters) {
      const t = ch.title.trim()
      if (t) items.push({ id: `mention:ch-${ch.id}`, label: t })
    }
    return items
  }, [project.book.authorName, project.book.title, chapters])
  const isNote = project.kind === 'note'
  const current = chapters.find((m) => m.id === currentId) ?? null
  const currentChapterIndex = useMemo(() => {
    if (currentId == null) return -1
    return chapters.findIndex((c) => c.id === currentId)
  }, [chapters, currentId])

  const prevChapter = useCallback(() => {
    if (currentChapterIndex <= 0) return
    const prev = chapters[currentChapterIndex - 1]!
    setCurrentId(prev.id)
  }, [chapters, currentChapterIndex])

  const nextChapter = useCallback(() => {
    if (currentChapterIndex < 0 || currentChapterIndex >= chapters.length - 1) return
    const next = chapters[currentChapterIndex + 1]!
    setCurrentId(next.id)
  }, [chapters, currentChapterIndex])

  const deferredProject = useDeferredValue(project)
  const liveTotalBookWords = useMemo(() => totalWordsInChapters(chapters), [chapters])
  const totalBookWords = useMemo(
    () => totalWordsInChapters(deferredProject.chapters),
    [deferredProject.chapters],
  )
  const wordsWrittenToday = useMemo(
    () => Math.max(0, totalBookWords - deferredProject.goals.dailyBaselineWordCount),
    [totalBookWords, deferredProject.goals.dailyBaselineWordCount],
  )
  const historyEntries = useMemo(() => {
    void historyRev
    return listProjectHistory(project.id)
  }, [project.id, historyRev])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useLayoutEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => {
    rememberOpenChapter(project.id, currentId)
  }, [project.id, currentId])

  useEffect(() => {
    if (prevProjectIdForEditorRef.current !== project.id) {
      prevProjectIdForEditorRef.current = project.id
      setEditorEpoch((e) => e + 1)
    }
  }, [project.id])

  const setRoute = useCallback((next: Route) => {
    setRouteState(next)
    if (typeof window !== 'undefined') {
      window.location.hash = routeToHash(next)
    }
  }, [])

  const setChaptersAsideCollapsedPersisted = useCallback((collapsed: boolean) => {
    setChaptersAsideCollapsed(collapsed)
    try {
      localStorage.setItem(CHAPTERS_ASIDE_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const setFormatThemeAsideCollapsedPersisted = useCallback((collapsed: boolean) => {
    setFormatThemeAsideCollapsed(collapsed)
    try {
      localStorage.setItem(FORMAT_THEME_ASIDE_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const onHash = () => setRouteState(readRouteFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!newProjectMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const el = newProjectMenuRef.current
      if (el && !el.contains(e.target as Node)) setNewProjectMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNewProjectMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [newProjectMenuOpen])

  useEffect(() => {
    if (route !== 'bookshelf') {
      if (openNoteMenuId) setOpenNoteMenuId(null)
      return
    }
    if (!openNoteMenuId) return
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-shelf-note-actions]')) return
      setOpenNoteMenuId(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenNoteMenuId(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [openNoteMenuId, route])

  useEffect(() => {
    if (route !== 'bookshelf') setShelfContextMenu(null)
  }, [route])

  useEffect(() => {
    if (!shelfContextMenu) return
    const onDocMouseDown = (e: globalThis.MouseEvent) => {
      const el = shelfContextMenuRef.current
      if (el && el.contains(e.target as Node)) return
      setShelfContextMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShelfContextMenu(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [shelfContextMenu])

  const bumpHistory = useCallback(() => setHistoryRev((n) => (n + 1) % 1_000_000), [])

  const clearPersistIdleTimer = useCallback(() => {
    if (persistIdleTimerRef.current != null) {
      window.clearTimeout(persistIdleTimerRef.current)
      persistIdleTimerRef.current = null
    }
  }, [])

  /** Persist the in-memory book to localStorage and align goals; clears any pending debounced save. */
  const syncPersistedState = useCallback(() => {
    clearPersistIdleTimer()
    const saved = saveProject(projectRef.current)
    setProject(saved)
    return saved
  }, [clearPersistIdleTimer])

  const openLinkedNotePopout = useCallback(
    (noteId: string) => {
      syncPersistedState()
      setStickyNotePopoutId(noteId)
      setBookToolsOpen(false)
    },
    [syncPersistedState],
  )

  const scheduleIdlePersist = useCallback(() => {
    if (persistIdleTimerRef.current != null) {
      window.clearTimeout(persistIdleTimerRef.current)
    }
    persistIdleTimerRef.current = window.setTimeout(() => {
      persistIdleTimerRef.current = null
      setProject((prev) => saveProject(prev))
    }, PERSIST_IDLE_MS)
  }, [])

  const recordHistorySoon = useCallback((label: string) => {
    // Debounced "idle" snapshot: it should feel automatic but not spam storage.
    const now = Date.now()
    historyLastRecordAtRef.current = now
    if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current)
    historyTimerRef.current = window.setTimeout(() => {
      const entry = pushProjectHistorySnapshot(projectRef.current, { label })
      if (entry) bumpHistory()
    }, 2500)
  }, [bumpHistory])

  // Ensure we have at least one baseline snapshot per book.
  useEffect(() => {
    if (listProjectHistory(project.id).length === 0) {
      const entry = pushProjectHistorySnapshot(projectRef.current, { label: 'Initial', force: true })
      if (entry) bumpHistory()
    }
  }, [project.id, bumpHistory])

  // Flush a snapshot when the tab is hidden or page is closing.
  useEffect(() => {
    const flush = (label: string) => {
      clearPersistIdleTimer()
      if (historyTimerRef.current) {
        window.clearTimeout(historyTimerRef.current)
        historyTimerRef.current = null
      }
      const saved = saveProject(projectRef.current)
      setProject(saved)
      const entry = pushProjectHistorySnapshot(saved, { label })
      if (entry) bumpHistory()
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush('Auto (hidden)')
    }
    const onBeforeUnload = () => flush('Auto (close)')
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [bumpHistory, clearPersistIdleTimer])

  useLayoutEffect(() => {
    return () => {
      clearPersistIdleTimer()
      setProject((prev) => saveProject(prev))
    }
  }, [currentId, clearPersistIdleTimer])

  const persistProject = useCallback(
    (next: InkwellProject) => {
      clearPersistIdleTimer()
      setProject(saveProject(next))
      recordHistorySoon('Auto')
    },
    [clearPersistIdleTimer, recordHistorySoon],
  )

  const openProject = useCallback(
    (id: string) => {
      syncPersistedState()
      const p = loadProject(id)
      if (!p) return
      setActiveProjectId(id)
      setProject(p)
      setCurrentId(resolveResumeChapterId(p))
      setEbookEditOpen(false)
      setRoute('write')
      const force = listProjectHistory(p.id).length === 0
      const entry = pushProjectHistorySnapshot(p, { label: 'Opened', force })
      if (entry) bumpHistory()
    },
    [bumpHistory, setRoute, syncPersistedState],
  )

  useEffect(() => {
    if (!stickyNotePopoutId) return
    if (project.kind !== 'book' && project.kind !== 'note') {
      setStickyNotePopoutId(null)
      return
    }
    const linked = listLinkedNotesForBook(project.id)
    if (!linked.some((n) => n.id === stickyNotePopoutId)) {
      setStickyNotePopoutId(null)
    }
  }, [project.kind, project.id, stickyNotePopoutId])

  const patchBook = useCallback(
    (patch: Partial<BookMeta>) => {
      setProject((prev) => {
        const next = saveProject({ ...prev, book: { ...prev.book, ...patch } })
        return next
      })
      recordHistorySoon('Auto')
    },
    [recordHistorySoon],
  )

  const patchGoals = useCallback(
    (patch: Partial<WritingGoals>) => {
      setProject((prev) => {
        const next = saveProject({ ...prev, goals: { ...prev.goals, ...patch } })
        return next
      })
      recordHistorySoon('Auto')
    },
    [recordHistorySoon],
  )

  const patchTheme = useCallback(
    (patch: { print?: Partial<PrintTheme>; ebook?: Partial<EbookTheme> }) => {
      setProject((prev) =>
        saveProject({
          ...prev,
          theme: {
            print: { ...prev.theme.print, ...(patch.print ?? {}) },
            ebook: { ...prev.theme.ebook, ...(patch.ebook ?? {}) },
          },
        }),
      )
      recordHistorySoon('Auto')
    },
    [recordHistorySoon],
  )

  const patchAssembly = useCallback(
    (patch: Partial<BookAssembly>) => {
      setProject((prev) => saveProject({ ...prev, assembly: { ...prev.assembly, ...patch } }))
      recordHistorySoon('Auto')
    },
    [recordHistorySoon],
  )

  const patchSeriesBible = useCallback(
    (rows: SeriesBibleEntry[]) => {
      setProject((prev) => saveProject({ ...prev, seriesBible: rows }))
      recordHistorySoon('Auto')
    },
    [recordHistorySoon],
  )

  const applyInteriorPreset = useCallback(
    (id: ThemePresetId) => {
      setProject((prev) => saveProject({ ...prev, theme: applyThemePreset(prev.theme, id) }))
      recordHistorySoon('Auto')
    },
    [recordHistorySoon],
  )

  useEffect(() => {
    void hydrateInkwellStorage().then(() => {
      const next = readInitialEditorSession()
      setProject(next.project)
      setCurrentId(next.currentId)
    })
  }, [])

  useEffect(
    () => () => {
      if (toastTimeoutRef.current != null) window.clearTimeout(toastTimeoutRef.current)
    },
    [],
  )

  const showToast = useCallback((node: ReactNode, ms = 3200) => {
    if (toastTimeoutRef.current != null) window.clearTimeout(toastTimeoutRef.current)
    setToast({ node, ms })
    toastTimeoutRef.current = window.setTimeout(() => {
      toastTimeoutRef.current = null
      setToast(null)
    }, ms)
  }, [])

  const updateCurrentContent = useCallback(
    (json: JSONContent) => {
      if (currentId === null) return
      setProject((prev) => ({
        ...prev,
        chapters: prev.chapters.map((m) => (m.id === currentId ? { ...m, content: json } : m)),
      }))
      scheduleIdlePersist()
      recordHistorySoon('Auto')
    },
    [currentId, recordHistorySoon, scheduleIdlePersist],
  )

  const updateCurrentTitle = useCallback(
    (title: string) => {
      if (currentId === null) return
      setProject((prev) => ({
        ...prev,
        chapters: prev.chapters.map((m) => (m.id === currentId ? { ...m, title } : m)),
      }))
      scheduleIdlePersist()
      recordHistorySoon('Auto')
    },
    [currentId, recordHistorySoon, scheduleIdlePersist],
  )

  const undoDelete = useCallback(() => {
    const snap = lastDeletedRef.current
    if (!snap) return
    const { originalIndex, ...rest } = snap
    lastDeletedRef.current = null
    clearPersistIdleTimer()
    setProject((prev) => {
      const copy = [...prev.chapters]
      const idx = Math.min(originalIndex, copy.length)
      copy.splice(idx, 0, rest)
      return saveProject({ ...prev, chapters: copy })
    })
    setCurrentId(rest.id)
    showToast('Chapter restored')
  }, [clearPersistIdleTimer, showToast])

  const selectChapter = useCallback(
    (id: number) => {
      setCurrentId(id)
      if (route === 'format_ebook' && !ebookEditOpen) {
        setEbookEditOpen(false)
      }
    },
    [route, ebookEditOpen],
  )

  const deleteChapter = useCallback(
    (id: number) => {
      const proj = projectRef.current
      const ch = proj.chapters
      const index = ch.findIndex((m) => m.id === id)
      if (index === -1) return
      const removed = ch[index]
      lastDeletedRef.current = { ...removed, originalIndex: index }
      const nextChapters = ch.filter((m) => m.id !== id)
      persistProject({ ...proj, chapters: nextChapters })
      if (id === currentId) {
        setCurrentId(nextChapters[0]?.id ?? null)
      }
      showToast(
        <span className="flex flex-wrap items-center gap-2">
          Chapter deleted
          <button
            type="button"
            className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
            onClick={() => undoDelete()}
          >
            Undo
          </button>
        </span>,
        4500,
      )
    },
    [currentId, persistProject, showToast, undoDelete],
  )

  const onReorder = useCallback(
    (draggedId: number, targetId: number) => {
      if (draggedId === targetId) return
      const proj = projectRef.current
      const ch = proj.chapters
      const draggedIndex = ch.findIndex((m) => m.id === draggedId)
      const targetIndex = ch.findIndex((m) => m.id === targetId)
      if (draggedIndex === -1 || targetIndex === -1) return
      const copy = [...ch]
      const [row] = copy.splice(draggedIndex, 1)
      copy.splice(targetIndex, 0, row)
      persistProject({ ...proj, chapters: copy })
      recordHistorySoon('Auto')
      showToast('Chapters reordered')
    },
    [persistProject, recordHistorySoon, showToast],
  )

  const createManuscript = () => {
    clearPersistIdleTimer()
    let newId = 0
    setProject((prev) => {
      newId = nextManuscriptId(prev.chapters)
      const next: Manuscript = {
        id: newId,
        title: `Untitled Chapter ${newId}`,
        content: defaultDoc(),
      }
      return saveProject({ ...prev, chapters: [next, ...prev.chapters] })
    })
    setCurrentId(newId)
    recordHistorySoon('Auto')
    showToast('New chapter created')
  }

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const next = !prev
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
      return next
    })
  }

  const exportHtml = () => {
    const ed = editorRef.current
    const ms = current
    if (!ed || !ms) return
    const html = ed.getHTML()
    const docTitle =
      project.book.title.trim() || ms.title
    const wrapped = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(docTitle)}</title></head><body>${html}</body></html>`
    const blob = new Blob([wrapped], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugDownload(docTitle)}.html`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Exported as HTML')
  }

  const exportPdfKdp = async () => {
    try {
      const bytes = await buildKdpPdf(project)
      const docTitle = project.book.title.trim() || chapters[0]?.title || 'manuscript'
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const blob = new Blob([buf], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slugDownload(docTitle)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Exported PDF (KDP)')
    } catch {
      showToast('PDF export failed')
    }
  }

  const exportEpub = async () => {
    try {
      const bytes = await buildEpub(project)
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const blob = new Blob([buf], { type: 'application/epub+zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = epubFilename(project)
      a.click()
      URL.revokeObjectURL(url)
      showToast('Exported EPUB')
    } catch {
      showToast('EPUB export failed')
    }
  }

  const exportTxt = useCallback(() => {
    try {
      const text = buildPlaintextExport(project)
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slugDownload(project.book.title.trim() || chapters[0]?.title || 'book')}.txt`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Exported plain text')
    } catch {
      showToast('Text export failed')
    }
  }, [project, chapters, showToast])

  const exportBookArchive = useCallback(async () => {
    try {
      const blob = await exportProjectZip(project)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slugDownload(project.book.title.trim() || 'book')}.inkwell.zip`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Book backup downloaded')
    } catch {
      showToast('Backup export failed')
    }
  }, [project, showToast])

  const exportFullLibrary = useCallback(async () => {
    try {
      const blob = await exportLibraryZip()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'inkwell-library-backup.zip'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Library backup downloaded')
    } catch {
      showToast('Library export failed')
    }
  }, [showToast])

  const importArchiveFile = useCallback(
    async (file: File) => {
      try {
        const res = await importInkwellArchive(file)
        if (!res.ok) {
          showToast(res.error)
          return
        }
        if (res.mode === 'single') {
          syncPersistedState()
          setProject(res.project)
          setCurrentId(resolveResumeChapterId(res.project))
          setActiveProjectId(res.project.id)
          setEditorEpoch((e) => e + 1)
          showToast('Imported book')
        } else {
          showToast(`Imported ${res.imported} projects`)
        }
      } catch {
        showToast('Import failed')
      }
    },
    [showToast, syncPersistedState],
  )

  const applyGlobalReplace = useCallback(
    (next: Manuscript[]) => {
      setProject((prev) => saveProject({ ...prev, chapters: next }))
      recordHistorySoon('Find & replace')
    },
    [recordHistorySoon],
  )

  const splitChapterAtCursor = useCallback(
    (targetId: number) => {
      if (currentId !== targetId) {
        showToast('Open this section, place the cursor where the next section should start, then tap Split.')
        return
      }
      const ed = editorRef.current
      if (!ed) return
      const idx = ed.state.selection.$from.index(0)
      const split = splitDocAtTopLevelIndex(ed.getJSON() as JSONContent, idx)
      if (!split) {
        showToast('Place the cursor below the first block to split.')
        return
      }
      const [leftDoc, rightDoc] = split
      clearPersistIdleTimer()
      const newId = nextManuscriptId(projectRef.current.chapters)
      setProject((prev) => {
        const ix = prev.chapters.findIndex((c) => c.id === targetId)
        if (ix < 0) return prev
        const ch = prev.chapters[ix]!
        const rightCh: Manuscript = {
          id: newId,
          title: `${ch.title} (continued)`,
          content: rightDoc,
          sectionRole: ch.sectionRole,
        }
        const nextChapters = [...prev.chapters]
        nextChapters[ix] = { ...ch, content: leftDoc }
        nextChapters.splice(ix + 1, 0, rightCh)
        return saveProject({ ...prev, chapters: nextChapters })
      })
      setCurrentId(newId)
      setEditorEpoch((e) => e + 1)
      recordHistorySoon('Split chapter')
      showToast('Section split')
    },
    [currentId, clearPersistIdleTimer, recordHistorySoon, showToast],
  )

  const mergeChapterWithNext = useCallback(
    (id: number) => {
      const prevP = projectRef.current
      const ix = prevP.chapters.findIndex((c) => c.id === id)
      if (ix < 0 || ix >= prevP.chapters.length - 1) return
      clearPersistIdleTimer()
      const a = prevP.chapters[ix]!
      const b = prevP.chapters[ix + 1]!
      const mergedContent = mergeDocContents(a.content, b.content)
      const nextChapters = [
        ...prevP.chapters.slice(0, ix),
        { ...a, content: mergedContent },
        ...prevP.chapters.slice(ix + 2),
      ]
      setProject(saveProject({ ...prevP, chapters: nextChapters }))
      recordHistorySoon('Merged sections')
      showToast('Sections merged')
    },
    [clearPersistIdleTimer, recordHistorySoon, showToast],
  )

  const importDocxIntoProject = useCallback(
    async (file: File, baseProject: InkwellProject, confirmMessage: string) => {
      const ok = window.confirm(confirmMessage)
      if (!ok) return
      try {
        clearPersistIdleTimer()
        pushProjectHistorySnapshot(baseProject, { label: 'Before import', force: true })
        bumpHistory()
        const ab = await file.arrayBuffer()
        const res = await importDocxToChapters(ab)
        const nextChapters: Manuscript[] = res.chapters.map((c, i) => ({
          id: i + 1,
          title: c.title,
          content: c.content,
        }))
        const nextBookTitle =
          baseProject.book.title?.trim()
            ? baseProject.book
            : { ...baseProject.book, title: file.name.replace(/\.docx$/i, '') }
        const saved = saveProject({ ...baseProject, book: nextBookTitle, chapters: nextChapters })
        setProject(saved)
        recordHistorySoon('Auto')
        setCurrentId(nextChapters[0]?.id ?? null)
        setEditorEpoch((e) => e + 1)
        setEbookEditOpen(false)
        setRoute('write')
        showToast(`Imported ${nextChapters.length} chapter${nextChapters.length === 1 ? '' : 's'}`)
      } catch {
        showToast('DOCX import failed')
      }
    },
    [bumpHistory, clearPersistIdleTimer, recordHistorySoon, setRoute, showToast],
  )

  const importDocx = useCallback(
    async (file: File) => {
      await importDocxIntoProject(
        file,
        projectRef.current,
        'Importing a DOCX will replace the current book chapters. Continue?',
      )
    },
    [importDocxIntoProject],
  )

  const restoreHistory = useCallback(
    (snapshotId: string) => {
      const snap = loadProjectSnapshot(projectRef.current.id, snapshotId)
      if (!snap) {
        showToast('Snapshot not found')
        return
      }
      const ok = window.confirm(
        `Restore snapshot from ${new Date(
          historyEntries.find((h) => h.id === snapshotId)?.ts ?? Date.now(),
        ).toLocaleString()}? This will replace the current book.`,
      )
      if (!ok) return

      clearPersistIdleTimer()
      // Safety: snapshot current state first.
      pushProjectHistorySnapshot(projectRef.current, { label: 'Before restore', force: true })
      const normalized = saveProject(snap)
      setProject(normalized)
      setCurrentId(normalized.chapters[0]?.id ?? null)
      setEditorEpoch((e) => e + 1)
      setEbookEditOpen(false)
      setRoute('write')
      bumpHistory()
      showToast('Restored snapshot')
    },
    [clearPersistIdleTimer, historyEntries, showToast, bumpHistory, setRoute],
  )

  const clearHistory = useCallback(() => {
    clearProjectHistory(project.id)
    bumpHistory()
    showToast('Recovery history cleared')
  }, [project.id, bumpHistory, showToast])

  const undoDeleteProject = useCallback(() => {
    const snap = lastDeletedProjectRef.current
    if (!snap?.blob) return
    lastDeletedProjectRef.current = null
    saveProject(snap.blob)
    showToast('Project restored')
  }, [showToast])

  const deleteShelfProject = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      setShelfDropHoverTrash(false)
      if (!window.confirm('Delete this project from this device?')) return
      const blob = loadProject(id)
      clearProjectChildPins(id)
      removeChildNoteFromAllProjectPins(id)
      deleteProject(id)
      lastDeletedProjectRef.current = blob ? { blob } : null
      if (project.id === id) {
        const next = ensureAtLeastOneProject()
        setProject(next)
        setCurrentId(resolveResumeChapterId(next))
      }
      setOpenNoteMenuId(null)
      showToast(
        <span className="flex flex-wrap items-center gap-2">
          Project deleted
          <button
            type="button"
            className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
            onClick={() => undoDeleteProject()}
          >
            Undo
          </button>
        </span>,
        4500,
      )
    },
    [project.id, showToast, undoDeleteProject],
  )

  const deleteShelfProjectById = useCallback(
    (id: string) => {
      setShelfDropHoverTrash(false)
      if (!window.confirm('Delete this project from this device?')) return
      const blob = loadProject(id)
      clearProjectChildPins(id)
      removeChildNoteFromAllProjectPins(id)
      deleteProject(id)
      lastDeletedProjectRef.current = blob ? { blob } : null
      if (project.id === id) {
        const next = ensureAtLeastOneProject()
        setProject(next)
        setCurrentId(resolveResumeChapterId(next))
      }
      setOpenNoteMenuId(null)
      showToast(
        <span className="flex flex-wrap items-center gap-2">
          Project deleted
          <button
            type="button"
            className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
            onClick={() => undoDeleteProject()}
          >
            Undo
          </button>
        </span>,
        4500,
      )
    },
    [project.id, showToast, undoDeleteProject],
  )

  /** Collapse an expanded book card when it no longer has linked notes. */
  const collapseBookCardIfNoLinkedNotes = useCallback((parentShelfId: string) => {
    const p = loadProject(parentShelfId)
    if (p?.kind !== 'book') return
    if (listLinkedNotesForBook(parentShelfId).length > 0) return
    setExpandedShelfParentId((cur) => (cur === parentShelfId ? null : cur))
  }, [])

  const deleteShelfLinkedChildNote = useCallback(
    (noteId: string) => {
      setShelfDropHoverTrash(false)
      if (!window.confirm('Delete this note from this device?')) return
      const blob = loadProject(noteId)
      const formerParentId =
        blob?.kind === 'note' && blob.linkedBookId ? String(blob.linkedBookId) : null
      clearProjectChildPins(noteId)
      removeChildNoteFromAllProjectPins(noteId)
      deleteProject(noteId)
      lastDeletedProjectRef.current = blob ? { blob } : null
      if (project.id === noteId) {
        const next = ensureAtLeastOneProject()
        setProject(next)
        setCurrentId(resolveResumeChapterId(next))
      }
      setOpenNoteMenuId(null)
      if (formerParentId) collapseBookCardIfNoLinkedNotes(formerParentId)
      showToast(
        <span className="flex flex-wrap items-center gap-2">
          Note deleted
          <button
            type="button"
            className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
            onClick={() => undoDeleteProject()}
          >
            Undo
          </button>
        </span>,
        4500,
      )
      setShelfUiTick((n) => n + 1)
    },
    [collapseBookCardIfNoLinkedNotes, project.id, showToast, undoDeleteProject],
  )

  const spawnBookOnShelf = useCallback(() => {
    syncPersistedState()
    createBookProject({ activate: false })
    setShelfUiTick((n) => n + 1)
    showToast('Book added to shelf')
  }, [syncPersistedState, showToast])

  const spawnProjectOnShelf = useCallback(() => {
    syncPersistedState()
    const p = createNoteProject({ activate: false })
    pinProjectNote(p.id)
    setShelfUiTick((n) => n + 1)
    showToast('Project added to shelf')
  }, [syncPersistedState, showToast])

  const spawnNoteOnShelf = useCallback(() => {
    syncPersistedState()
    createNoteProject({ activate: false })
    setShelfUiTick((n) => n + 1)
    showToast('Note added to shelf')
  }, [syncPersistedState, showToast])

  const moveNoteUnderParent = useCallback(
    (noteId: string, parentId: string) => {
      const proj = loadProject(noteId)
      if (!proj || proj.kind !== 'note' || !parentId) return false
      const parent = loadProject(parentId)
      if (!parent || (parent.kind !== 'book' && parent.kind !== 'note')) return false
      if (wouldCreateNoteAttachmentCycle(noteId, parentId)) {
        showToast('Cannot attach a note under its own sub-note')
        return false
      }
      if (proj.linkedBookId === parentId) {
        showToast('Note is already attached here')
        return false
      }

      const previousParent = proj.linkedBookId
      const wasPinnedMaster = proj.linkedBookId == null && isProjectNotePinned(noteId)
      const kidsBeforeMove = wasPinnedMaster ? listLinkedNotesForBook(noteId, listProjects()) : []

      saveProject({ ...proj, linkedBookId: parentId })
      if (previousParent && previousParent !== parentId) {
        purgeChildNoteFromProjectShelfLists(previousParent, noteId)
      }
      if (parent.kind === 'note') pinProjectNote(parentId)

      if (wasPinnedMaster) {
        if (kidsBeforeMove.length === 0) {
          // Master was the only note; project should disappear.
          clearProjectChildPins(noteId)
          unpinProjectNote(noteId)
        } else {
          const sortedKids = kidsBeforeMove.slice().sort((a, b) => b.updatedAt - a.updatedAt)
          const newMasterId = sortedKids[0]!.id
          const newMaster = loadProject(newMasterId)
          if (newMaster && newMaster.kind === 'note') {
            saveProject({ ...newMaster, linkedBookId: null })
            pinProjectNote(newMasterId)
            migrateProjectChildPins(noteId, newMasterId)
            for (const k of sortedKids) {
              if (k.id === newMasterId) continue
              const child = loadProject(k.id)
              if (!child || child.kind !== 'note') continue
              saveProject({ ...child, linkedBookId: newMasterId })
            }
          }
          unpinProjectNote(noteId)
        }
      }

      registerNoteAttachedUnderMaster(parentId, noteId)
      if (previousParent && previousParent !== parentId) {
        collapseBookCardIfNoLinkedNotes(String(previousParent))
      }
      return true
    },
    [collapseBookCardIfNoLinkedNotes, showToast],
  )

  const linkNoteToParent = useCallback(
    (noteId: string, parentId: string) => {
      if (!moveNoteUnderParent(noteId, parentId)) return
      setStickNoteId(null)
      showToast('Note attached')
    },
    [moveNoteUnderParent, showToast],
  )

  const openStickModalForNote = useCallback(
    (noteId: string) => {
      const books = listBookMetas()
      const metas = listProjects()
      const eligibleNotes = metas.filter(
        (m) =>
          m.kind === 'note' && m.id !== noteId && !wouldCreateNoteAttachmentCycle(noteId, m.id),
      )
      if (books.length === 0 && eligibleNotes.length === 0) {
        showToast('Create another book or note first')
        return
      }
      const note = loadProject(noteId)
      let preferred = ''
      if (note?.kind === 'note' && note.linkedBookId) {
        const lid = note.linkedBookId
        if (books.some((b) => b.id === lid) || eligibleNotes.some((n) => n.id === lid)) {
          preferred = lid
        }
      }
      if (!preferred) {
        preferred = books[0]?.id ?? eligibleNotes[0]?.id ?? ''
      }
      setStickNoteId(noteId)
      setStickSelectParentId(preferred)
      setOpenNoteMenuId(null)
    },
    [showToast],
  )

  const tryOpenShelfNote = useCallback(
    (noteId: string) => {
      if (shelfNoteHadDragRef.current) {
        shelfNoteHadDragRef.current = false
        return
      }
      openProject(noteId)
    },
    [openProject],
  )

  const handleBookshelfContextMenu = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    const host = target?.closest('[data-inkwell-shelf-project]') as HTMLElement | null
    const id = host?.getAttribute('data-inkwell-shelf-project')?.trim()
    if (!id) {
      setShelfContextMenu(null)
      return
    }
    e.preventDefault()
    setShelfContextMenu({ x: e.clientX, y: e.clientY, projectId: id })
  }, [])

  const shelfContextMenuPosition = useMemo(() => {
    if (!shelfContextMenu || typeof window === 'undefined') return null
    const pad = 8
    const mw = 200
    const mh = 52
    const x = Math.min(Math.max(pad, shelfContextMenu.x), window.innerWidth - mw - pad)
    const y = Math.min(Math.max(pad, shelfContextMenu.y), window.innerHeight - mh - pad)
    return { x, y }
  }, [shelfContextMenu])

  const shelfNoteDragStart = useCallback((e: React.DragEvent, noteId: string, previewTitle: string) => {
    setOpenNoteMenuId(null)
    shelfDraggingNoteIdRef.current = noteId
    shelfNoteHadDragRef.current = true
    const el = e.currentTarget as HTMLElement
    el.classList.add('inkwell-drag-source-lift')
    e.dataTransfer.setData(NOTE_DRAG_MIME, noteId)
    e.dataTransfer.setData('text/plain', `${NOTE_DRAG_TEXT_PREFIX}${noteId}`)
    e.dataTransfer.effectAllowed = 'move'
    attachInkwellDragGhost(e.nativeEvent, previewTitle, { fallback: 'Note' })
  }, [])

  const shelfNoteDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement
    el.classList.remove('inkwell-drag-source-lift')
    shelfDraggingNoteIdRef.current = null
    setShelfDropHoverAttachId(null)
    setShelfDropHoverNotesSection(false)
    setShelfDropHoverProjectsSection(false)
    setShelfDropHoverTrash(false)
    setShelfProjectChildDropTarget(null)
    window.setTimeout(() => {
      shelfNoteHadDragRef.current = false
    }, 0)
  }, [])

  const shelfAttachTargetDragOver = useCallback((e: React.DragEvent, parentId: string) => {
    e.stopPropagation()
    const draggedId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
    if (!draggedId) return
    // If the drag started somewhere we didn't track (or a browser cleared state), recover from dataTransfer.
    shelfDraggingNoteIdRef.current = draggedId
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setShelfDropHoverNotesSection(false)
    setShelfDropHoverProjectsSection(false)
    setShelfDropHoverAttachId(parentId)
  }, [])

  const shelfAttachTargetDragLeave = useCallback((e: React.DragEvent, parentId: string) => {
    e.stopPropagation()
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setShelfDropHoverAttachId((cur) => (cur === parentId ? null : cur))
  }, [])

  const shelfAttachNoteDrop = useCallback(
    (e: React.DragEvent, parentId: string) => {
      e.stopPropagation()
      e.preventDefault()
      const noteId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
      shelfDraggingNoteIdRef.current = null
      setShelfDropHoverAttachId(null)
      setShelfDropHoverNotesSection(false)
      setShelfDropHoverProjectsSection(false)
      if (!noteId) return
      const drag = loadProject(noteId)
      const parent = loadProject(parentId)
      if (!drag || drag.kind !== 'note' || !parent) return
      if (parent.kind !== 'book' && parent.kind !== 'note') return

      // Linked note dropped onto a loose note card in Notes: return it to the loose list (don't nest under the card).
      if (
        parent.kind === 'note' &&
        parent.linkedBookId == null &&
        !isProjectNotePinned(parent.id) &&
        !noteHasChildren(parent.id, listProjects()) &&
        drag.linkedBookId != null &&
        drag.linkedBookId !== ''
      ) {
        const prev = drag.linkedBookId
        saveProject({ ...drag, linkedBookId: null })
        purgeChildNoteFromProjectShelfLists(prev, noteId)
        collapseBookCardIfNoLinkedNotes(String(prev))
        showToast('Note moved to Notes')
        return
      }

      if (!moveNoteUnderParent(noteId, parentId)) return
      showToast('Note attached')
    },
    [collapseBookCardIfNoLinkedNotes, moveNoteUnderParent, showToast],
  )

  const shelfNotesSectionDragOver = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    const draggedId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
    if (!draggedId) return
    shelfDraggingNoteIdRef.current = draggedId
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setShelfDropHoverAttachId(null)
    setShelfDropHoverNotesSection(true)
    setShelfDropHoverProjectsSection(false)
  }, [])

  const shelfNotesSectionDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setShelfDropHoverNotesSection(false)
  }, [])

  const shelfNotesSectionDrop = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const noteId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
      shelfDraggingNoteIdRef.current = null
      setShelfDropHoverAttachId(null)
      setShelfDropHoverNotesSection(false)
      setShelfDropHoverProjectsSection(false)
      if (!noteId) return
      const proj = loadProject(noteId)
      if (!proj || proj.kind !== 'note') return
      if (!proj.linkedBookId) {
        showToast('Note is already in Notes')
        return
      }
      const prev = proj.linkedBookId
      saveProject({ ...proj, linkedBookId: null })
      purgeChildNoteFromProjectShelfLists(prev, noteId)
      collapseBookCardIfNoLinkedNotes(String(prev))
      showToast('Note moved to Notes')
    },
    [collapseBookCardIfNoLinkedNotes, showToast],
  )

  const shelfProjectsSectionDragOver = useCallback((e: React.DragEvent) => {
    const draggedId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
    if (!draggedId) return
    shelfDraggingNoteIdRef.current = draggedId
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setShelfDropHoverAttachId(null)
    setShelfDropHoverNotesSection(false)
    setShelfDropHoverProjectsSection(true)
  }, [])

  const shelfProjectsSectionDragLeave = useCallback((e: React.DragEvent) => {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setShelfDropHoverProjectsSection(false)
  }, [])

  const shelfProjectsSectionDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const noteId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
      shelfDraggingNoteIdRef.current = null
      setShelfDropHoverAttachId(null)
      setShelfDropHoverNotesSection(false)
      setShelfDropHoverProjectsSection(false)
      setShelfDropHoverTrash(false)
      if (!noteId) return
      const proj = loadProject(noteId)
      if (!proj || proj.kind !== 'note') return
      if (proj.linkedBookId) {
        showToast('Only loose notes can be promoted to a project')
        return
      }
      if (noteHasChildren(noteId, listProjects()) || isProjectNotePinned(noteId)) {
        showToast('Already a project')
        return
      }
      pinProjectNote(noteId)
      showToast('Project created')
    },
    [showToast],
  )

  const shelfTrashDragOver = useCallback((e: React.DragEvent) => {
    const draggedId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
    if (!draggedId) return
    shelfDraggingNoteIdRef.current = draggedId
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setShelfDropHoverAttachId(null)
    setShelfDropHoverNotesSection(false)
    setShelfDropHoverProjectsSection(false)
    setShelfDropHoverTrash(true)

    // "Magnetism": gently pull the bin toward the cursor.
    const el = trashDropRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = (e.clientX ?? cx) - cx
      const dy = (e.clientY ?? cy) - cy
      const max = 14
      const dist = Math.max(1, Math.hypot(dx, dy))
      const strength = Math.min(1, 110 / dist)
      const x = Math.max(-max, Math.min(max, (dx / dist) * max * strength))
      const y = Math.max(-max, Math.min(max, (dy / dist) * max * strength))
      setTrashPull({ x, y })
    }
  }, [])

  const shelfTrashDragLeave = useCallback((e: React.DragEvent) => {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setShelfDropHoverTrash(false)
    setTrashPull({ x: 0, y: 0 })
  }, [])

  const shelfTrashDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const id = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
      shelfDraggingNoteIdRef.current = null
      setShelfDropHoverAttachId(null)
      setShelfDropHoverNotesSection(false)
      setShelfDropHoverProjectsSection(false)
      setShelfDropHoverTrash(false)
      setTrashPull({ x: 0, y: 0 })
      if (!id) return
      deleteShelfProjectById(id)
    },
    [deleteShelfProjectById],
  )

  const shelfMetas = listProjects()
  const shelfBooks = listBookMetas(shelfMetas)
  const shelfProjectNotes = listProjectNoteMetas(shelfMetas)
  const shelfLooseNotes = listLooseNoteMetas(shelfMetas)
  const stickModalEligibleNotes =
    stickNoteId == null
      ? []
      : shelfMetas.filter(
          (m) =>
            m.kind === 'note' &&
            m.id !== stickNoteId &&
            !wouldCreateNoteAttachmentCycle(stickNoteId, m.id),
        )

  return (
    <div className="flex h-full min-h-0 flex-col bg-parchment text-ink transition-colors dark:bg-panel-dark dark:text-ink-dark">
      {route === 'bookshelf' ? (
        <div
          className="inkwell-bookshelf mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10"
          onContextMenu={handleBookshelfContextMenu}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-parchment dark:bg-cream dark:text-ink">
                🪶
              </div>
              <div className="min-w-0">
                <h1 className="font-serif text-2xl font-semibold tracking-tight">Bookshelf</h1>
                <p className="text-sm text-ink/60 dark:text-ink-dark/60">Local projects on this device</p>
              </div>
            </div>
            <div className="flex shrink-0 justify-center px-2">
              <button
                type="button"
                onClick={() => {
                  setNewProjectMenuOpen(false)
                  syncPersistedState()
                  const p = createNoteProject()
                  setProject(p)
                  setCurrentId(p.chapters[0]?.id ?? null)
                  setEbookEditOpen(false)
                  setRoute('write')
                }}
                className="flex items-center gap-2 rounded-3xl bg-ink px-5 py-2.5 text-sm font-semibold text-parchment shadow-sm ring-1 ring-ink/10 hover:bg-walnut dark:bg-cream dark:text-ink dark:ring-cream/20 dark:hover:bg-accent-warm sm:px-6 sm:text-base"
              >
                <PenLine className="h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]" strokeWidth={2.25} />
                Start Writing
              </button>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-11 w-11 items-center justify-center rounded-3xl border border-dust bg-white/70 text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <input
                ref={docxShelfInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null
                  e.currentTarget.value = ''
                  if (!file) return
                  syncPersistedState()
                  const p = createBookProject()
                  setProject(p)
                  setCurrentId(p.chapters[0]?.id ?? null)
                  setEbookEditOpen(false)
                  setRoute('write')
                  setNewProjectMenuOpen(false)
                  await importDocxIntoProject(
                    file,
                    p,
                    'Importing a DOCX will replace chapters in this new book. Continue?',
                  )
                }}
              />
              <div className="relative" ref={newProjectMenuRef}>
                <button
                  type="button"
                  onClick={() => setNewProjectMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-3xl bg-ink px-4 py-2.5 text-sm font-semibold text-parchment hover:bg-walnut dark:bg-cream dark:text-ink dark:hover:bg-accent-warm"
                  aria-expanded={newProjectMenuOpen}
                  aria-haspopup="menu"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  New
                  <ChevronDown className="h-4 w-4 opacity-80" strokeWidth={2.5} />
                </button>
                {newProjectMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] overflow-hidden rounded-2xl border border-dust bg-white py-1 shadow-xl dark:border-border-dark dark:bg-panel-dark"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                      onClick={() => {
                        setNewProjectMenuOpen(false)
                        syncPersistedState()
                        const p = createNoteProject()
                        setProject(p)
                        setCurrentId(p.chapters[0]?.id ?? null)
                        setEbookEditOpen(false)
                        setRoute('write')
                      }}
                    >
                      Note
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                      onClick={() => {
                        setNewProjectMenuOpen(false)
                        syncPersistedState()
                        const p = createBookProject()
                        setProject(p)
                        setCurrentId(p.chapters[0]?.id ?? null)
                        setEbookEditOpen(false)
                        setRoute('write')
                      }}
                    >
                      Book
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                      onClick={() => {
                        setNewProjectMenuOpen(false)
                        docxShelfInputRef.current?.click()
                      }}
                    >
                      Import DOCX…
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <section className="mt-8 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                Books
              </h2>
              <button
                type="button"
                title="Add book"
                aria-label="Add book"
                onClick={spawnBookOnShelf}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-dust bg-white/70 text-ink shadow-sm transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <div
              className={`grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
                shelfBooks.length === 0
                  ? 'min-h-[14rem] rounded-3xl border-2 border-dashed border-dust/90 bg-white/60 px-5 py-6 dark:border-border-dark dark:bg-panel-dark/55'
                  : ''
              }`}
            >
              {shelfBooks.length === 0 ? (
                <div className="col-span-full flex min-h-[11rem] flex-col items-center justify-center gap-3 px-4 text-center sm:min-h-[12rem]">
                  <p className="max-w-lg text-sm leading-relaxed text-ink/65 dark:text-ink-dark/60">
                    No books yet. Click <strong>New → Book</strong> to start your first one, or{' '}
                    <strong>Import DOCX…</strong> to bring in a draft.
                  </p>
                </div>
              ) : null}
              {shelfBooks.map((p) => {
                const kidsOrdered = listLinkedNotesForBookInShelfOrder(p.id, shelfMetas)
                const top = kidsOrdered.slice(0, 3)
                const expanded = expandedShelfParentId === p.id
                return (
                  <div
                    key={p.id}
                    data-inkwell-shelf-project={p.id}
                    onDragEnter={(e) => shelfAttachTargetDragOver(e, p.id)}
                    onDragOver={(e) => shelfAttachTargetDragOver(e, p.id)}
                    onDragLeave={(e) => shelfAttachTargetDragLeave(e, p.id)}
                    onDrop={(e) => shelfAttachNoteDrop(e, p.id)}
                    className={`inkwell-shelf-card flex flex-col rounded-3xl border border-dust bg-white/70 text-left ease-out hover:-translate-y-px hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90 ${
                      shelfDropHoverAttachId === p.id
                        ? 'inkwell-shelf-drop-target z-10 scale-[1.02] shadow-xl ring-2 ring-cream ring-offset-2 ring-offset-parchment dark:ring-accent-warm dark:ring-offset-panel-dark'
                        : ''
                    }`}
                  >
                    <div className="flex w-full items-start justify-between gap-3 p-5">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (kidsOrdered.length > 0) {
                            setExpandedShelfParentId((cur) => (cur === p.id ? null : p.id))
                          } else {
                            openProject(p.id)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          if (kidsOrdered.length > 0) {
                            setExpandedShelfParentId((cur) => (cur === p.id ? null : p.id))
                          } else {
                            openProject(p.id)
                          }
                        }}
                        className="min-w-0 flex-1 cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-dust/60 text-walnut dark:bg-border-dark/60 dark:text-accent-warm">
                            <BookOpen className="h-5 w-5" strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-serif text-lg font-semibold">{p.title || 'Untitled book'}</div>
                            <div className="mt-1 text-xs text-ink/55 dark:text-ink-dark/55">
                              Updated {new Date(p.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex shrink-0 items-start gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {kidsOrdered.length > 0 ? (
                          <button
                            type="button"
                            title={expanded ? 'Collapse' : 'Expand linked notes'}
                            aria-label={expanded ? 'Collapse linked notes' : 'Expand linked notes'}
                            className="rounded-xl p-2 text-ink/50 hover:bg-dust/50 dark:text-ink-dark/50 dark:hover:bg-border-dark/50"
                            onClick={() => setExpandedShelfParentId((cur) => (cur === p.id ? null : p.id))}
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                              strokeWidth={2.5}
                            />
                          </button>
                        ) : null}
                        <div className="rounded-2xl bg-dust/40 px-2 py-1 text-[11px] font-semibold text-walnut dark:bg-border-dark/60 dark:text-accent-warm">
                          {kidsOrdered.length > 0
                            ? `${kidsOrdered.length} note${kidsOrdered.length === 1 ? '' : 's'}`
                            : 'Local'}
                        </div>
                        <button
                          type="button"
                          title="Delete book"
                          className="rounded-xl p-2 text-ink/50 hover:bg-red-500/10 hover:text-red-600 dark:text-ink-dark/50 dark:hover:bg-red-400/10 dark:hover:text-red-400"
                          onClick={(e) => deleteShelfProject(p.id, e)}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div
                        className="border-t border-dust px-3 pb-3 pt-3 dark:border-border-dark"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <div className="px-2 pb-2">
                          <div
                            role="button"
                            tabIndex={0}
                            data-inkwell-shelf-project={p.id}
                            onClick={() => {
                              openProject(p.id)
                              setExpandedShelfParentId(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return
                              e.preventDefault()
                              openProject(p.id)
                              setExpandedShelfParentId(null)
                            }}
                            className="w-full cursor-pointer rounded-2xl border border-dust bg-white/70 px-4 py-3 text-left outline-none transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90 focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-ink dark:text-ink-dark">
                                  {p.title || 'Untitled book'}
                                </div>
                                <div className="mt-0.5 text-[11px] text-ink/45 dark:text-ink-dark/45">
                                  Open manuscript
                                </div>
                              </div>
                              <div className="shrink-0 rounded-full bg-dust/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-walnut dark:bg-border-dark/60 dark:text-accent-warm">
                                Book
                              </div>
                            </div>
                          </div>
                        </div>
                        {kidsOrdered.length === 0 ? (
                          <div className="px-4 py-2 text-xs text-ink/55 dark:text-ink-dark/55">
                            No linked notes yet. Drag notes here to attach them.
                          </div>
                        ) : (
                          <ShelfLinkedNotesList
                            masterId={p.id}
                            kidsOrdered={kidsOrdered}
                            parentLabel="book"
                            shelfProjectChildDropTarget={shelfProjectChildDropTarget}
                            setShelfProjectChildDropTarget={setShelfProjectChildDropTarget}
                            shelfDraggingNoteIdRef={shelfDraggingNoteIdRef}
                            onLinkedNoteOpen={(id) => {
                              tryOpenShelfNote(id)
                              setExpandedShelfParentId(null)
                            }}
                            setShelfUiTick={setShelfUiTick}
                            setShelfDropHoverAttachId={setShelfDropHoverAttachId}
                            setShelfDropHoverNotesSection={setShelfDropHoverNotesSection}
                            setShelfDropHoverProjectsSection={setShelfDropHoverProjectsSection}
                            moveNoteUnderParent={moveNoteUnderParent}
                            showToast={showToast}
                            shelfNoteDragStart={shelfNoteDragStart}
                            shelfNoteDragEnd={shelfNoteDragEnd}
                            setShelfPinRev={setShelfPinRev}
                            onDeleteLinkedNote={deleteShelfLinkedChildNote}
                          />
                        )}
                      </div>
                    ) : top.length > 0 ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedShelfParentId((cur) => (cur === p.id ? null : p.id))}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          setExpandedShelfParentId((cur) => (cur === p.id ? null : p.id))
                        }}
                        className="cursor-pointer border-t border-dust px-5 pb-4 pt-3 text-left outline-none hover:bg-dust/20 dark:border-border-dark dark:hover:bg-border-dark/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cream dark:focus-visible:ring-cream"
                      >
                        <div className="space-y-1">
                          {top.map((n) => (
                            <div
                              key={n.id}
                              data-inkwell-shelf-project={n.id}
                              className="truncate text-xs text-ink/55 dark:text-ink-dark/55"
                            >
                              {n.title || 'Untitled note'}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>

          <section
            className={`mt-10 space-y-3 rounded-3xl transition-[transform,box-shadow] duration-300 ease-out ${
              shelfDropHoverProjectsSection
                ? 'inkwell-shelf-drop-target scale-[1.01] shadow-lg ring-2 ring-cream ring-offset-2 ring-offset-parchment dark:ring-accent-warm dark:ring-offset-panel-dark'
                : ''
            }`}
            onDragOver={shelfProjectsSectionDragOver}
            onDragLeave={shelfProjectsSectionDragLeave}
            onDrop={shelfProjectsSectionDrop}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                Projects
              </h2>
              <button
                type="button"
                title="Add project"
                aria-label="Add project"
                onClick={spawnProjectOnShelf}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-dust bg-white/70 text-ink shadow-sm transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <div
              className={`grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
                shelfProjectNotes.length === 0
                  ? 'min-h-[14rem] rounded-3xl border-2 border-dashed border-dust/90 bg-white/60 px-5 py-6 dark:border-border-dark dark:bg-panel-dark/55'
                  : ''
              }`}
            >
              {shelfProjectNotes.length === 0 ? (
                <div className="col-span-full flex min-h-[11rem] flex-col items-center justify-center gap-3 px-4 text-center sm:min-h-[12rem]">
                  <p className="max-w-lg text-sm leading-relaxed text-ink/65 dark:text-ink-dark/60">
                    Projects appear automatically when a note has other notes attached under it. Drag a note onto
                    another note to create one.
                  </p>
                </div>
              ) : null}

              {shelfProjectNotes.map((p) => {
                const kidsOrdered = listLinkedNotesForBookInShelfOrder(p.id, shelfMetas)
                const top = kidsOrdered.slice(0, 3)
                const expanded = expandedShelfParentId === p.id
                return (
                  <div
                    key={p.id}
                    data-inkwell-shelf-project={p.id}
                    onDragEnter={(e) => shelfAttachTargetDragOver(e, p.id)}
                    onDragOver={(e) => shelfAttachTargetDragOver(e, p.id)}
                    onDragLeave={(e) => shelfAttachTargetDragLeave(e, p.id)}
                    onDrop={(e) => shelfAttachNoteDrop(e, p.id)}
                    className={`inkwell-shelf-card flex flex-col rounded-3xl border border-dust bg-white/70 text-left ease-out hover:-translate-y-px hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90 ${
                      shelfDropHoverAttachId === p.id
                        ? 'inkwell-shelf-drop-target z-10 scale-[1.02] shadow-xl ring-2 ring-cream ring-offset-2 ring-offset-parchment dark:ring-accent-warm dark:ring-offset-panel-dark'
                        : ''
                    }`}
                  >
                    <div className="flex w-full items-start justify-between gap-3 p-5">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedShelfParentId((cur) => (cur === p.id ? null : p.id))}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          setExpandedShelfParentId((cur) => (cur === p.id ? null : p.id))
                        }}
                        className="min-w-0 flex-1 cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-dust/60 text-walnut dark:bg-border-dark/60 dark:text-accent-warm">
                            <Folders className="h-5 w-5" strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-serif text-lg font-semibold">{p.title || 'Untitled project'}</div>
                            <div className="mt-1 text-xs text-ink/55 dark:text-ink-dark/55">
                              Updated {new Date(p.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex shrink-0 items-start gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title={expanded ? 'Collapse' : 'Expand'}
                          aria-label={expanded ? 'Collapse project' : 'Expand project'}
                          className="rounded-xl p-2 text-ink/50 hover:bg-dust/50 dark:text-ink-dark/50 dark:hover:bg-border-dark/50"
                          onClick={() => setExpandedShelfParentId((cur) => (cur === p.id ? null : p.id))}
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                            strokeWidth={2.5}
                          />
                        </button>
                        <div className="rounded-2xl bg-dust/40 px-2 py-1 text-[11px] font-semibold text-walnut dark:bg-border-dark/60 dark:text-accent-warm">
                          {kidsOrdered.length} note{kidsOrdered.length === 1 ? '' : 's'}
                        </div>
                        <button
                          type="button"
                          title="Delete project"
                          className="rounded-xl p-2 text-ink/50 hover:bg-red-500/10 hover:text-red-600 dark:text-ink-dark/50 dark:hover:bg-red-400/10 dark:hover:text-red-400"
                          onClick={(e) => deleteShelfProject(p.id, e)}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div
                        className="border-t border-dust px-3 pb-3 pt-3 dark:border-border-dark"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <div className="px-2 pb-2">
                          <div
                            draggable
                            data-inkwell-shelf-project={p.id}
                            title="Drag onto a book, project, note, or into Notes"
                            aria-label={`Master note: ${p.title || 'Untitled note'}. Drag to move, or activate to open.`}
                            onDragStart={(e) => shelfNoteDragStart(e, p.id, p.title || 'Untitled note')}
                            onDragEnd={shelfNoteDragEnd}
                            className="w-full cursor-grab rounded-2xl border border-dust bg-white/70 px-4 py-3 text-left outline-none transition-colors hover:bg-white active:cursor-grabbing dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90 focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              tryOpenShelfNote(p.id)
                              setExpandedShelfParentId(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                tryOpenShelfNote(p.id)
                                setExpandedShelfParentId(null)
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-ink dark:text-ink-dark">
                                  {p.title || 'Untitled note'}
                                </div>
                                <div className="mt-0.5 text-[11px] text-ink/45 dark:text-ink-dark/45">
                                  Updated {new Date(p.updatedAt).toLocaleString()}
                                </div>
                              </div>
                              <div className="shrink-0 rounded-full bg-dust/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-walnut dark:bg-border-dark/60 dark:text-accent-warm">
                                Master
                              </div>
                            </div>
                          </div>
                        </div>
                        {kidsOrdered.length === 0 ? (
                          <div className="px-4 py-2 text-xs text-ink/55 dark:text-ink-dark/55">
                            No notes in this project yet.
                          </div>
                        ) : (
                          <ShelfLinkedNotesList
                            masterId={p.id}
                            kidsOrdered={kidsOrdered}
                            parentLabel="project"
                            shelfProjectChildDropTarget={shelfProjectChildDropTarget}
                            setShelfProjectChildDropTarget={setShelfProjectChildDropTarget}
                            shelfDraggingNoteIdRef={shelfDraggingNoteIdRef}
                            onLinkedNoteOpen={(id) => {
                              tryOpenShelfNote(id)
                              setExpandedShelfParentId(null)
                            }}
                            setShelfUiTick={setShelfUiTick}
                            setShelfDropHoverAttachId={setShelfDropHoverAttachId}
                            setShelfDropHoverNotesSection={setShelfDropHoverNotesSection}
                            setShelfDropHoverProjectsSection={setShelfDropHoverProjectsSection}
                            moveNoteUnderParent={moveNoteUnderParent}
                            showToast={showToast}
                            shelfNoteDragStart={shelfNoteDragStart}
                            shelfNoteDragEnd={shelfNoteDragEnd}
                            setShelfPinRev={setShelfPinRev}
                            onDeleteLinkedNote={deleteShelfLinkedChildNote}
                          />
                        )}
                      </div>
                    ) : top.length > 0 ? (
                      <div className="border-t border-dust px-5 pb-4 pt-3 dark:border-border-dark">
                        <div className="space-y-1">
                          {top.map((n) => (
                            <div
                              key={n.id}
                              data-inkwell-shelf-project={n.id}
                              className="truncate text-xs text-ink/55 dark:text-ink-dark/55"
                            >
                              {n.title || 'Untitled note'}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>

          <section
            className={`mt-10 space-y-3 rounded-3xl transition-[transform,box-shadow] duration-300 ease-out ${
              shelfDropHoverNotesSection
                ? 'inkwell-shelf-drop-target scale-[1.01] shadow-lg ring-2 ring-cream ring-offset-2 ring-offset-parchment dark:ring-accent-warm dark:ring-offset-panel-dark'
                : ''
            }`}
            onDragEnter={shelfNotesSectionDragOver}
            onDragOver={shelfNotesSectionDragOver}
            onDragLeave={shelfNotesSectionDragLeave}
            onDrop={shelfNotesSectionDrop}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                  Notes
                </h2>
                <button
                  type="button"
                  title="Add note"
                  aria-label="Add note"
                  onClick={spawnNoteOnShelf}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-dust bg-white/70 text-ink shadow-sm transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              {shelfLooseNotes.length > 0 ? (
                <p className="mt-1 text-sm text-ink/55 dark:text-ink-dark/55">
                  Drag a note onto a book or another note to attach it, or drop here to move a linked note back into
                  Notes.
                </p>
              ) : null}
            </div>
            <div
              className={`grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
                shelfLooseNotes.length === 0
                  ? 'min-h-[14rem] rounded-3xl border-2 border-dashed border-dust/90 bg-white/60 px-5 py-6 dark:border-border-dark dark:bg-panel-dark/55'
                  : ''
              }`}
            >
              {shelfLooseNotes.length === 0 ? (
                <div className="col-span-full flex min-h-[11rem] flex-col items-center justify-center gap-3 px-4 text-center sm:min-h-[12rem]">
                  <p className="max-w-lg text-sm leading-relaxed text-ink/65 dark:text-ink-dark/60">
                    Drag a note onto a book or another note to attach it, or drop here to move a linked note back into
                    Notes.
                  </p>
                  <p className="text-xs font-medium text-walnut/80 dark:text-accent-warm/85">
                    Drop zone — park linked notes here when the list is empty
                  </p>
                </div>
              ) : null}
              {shelfLooseNotes.map((p) => {
                return (
                  <div
                    key={p.id}
                    data-inkwell-shelf-project={p.id}
                    onDragEnter={(e) => shelfAttachTargetDragOver(e, p.id)}
                    onDragOver={(e) => shelfAttachTargetDragOver(e, p.id)}
                    onDragLeave={(e) => shelfAttachTargetDragLeave(e, p.id)}
                    onDrop={(e) => shelfAttachNoteDrop(e, p.id)}
                    className={`inkwell-shelf-card flex flex-col rounded-3xl border border-dust bg-white/70 text-left ease-out hover:-translate-y-px hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90 ${
                      shelfDropHoverAttachId === p.id
                        ? 'inkwell-shelf-drop-target z-10 scale-[1.02] shadow-xl ring-2 ring-cream ring-offset-2 ring-offset-parchment dark:ring-accent-warm dark:ring-offset-panel-dark'
                        : ''
                    }`}
                  >
                    <div className="flex w-full items-start justify-between gap-3 p-5">
                      <div
                        draggable
                        title="Drag onto a book or note to attach"
                        aria-label={`Note: ${p.title || 'Untitled note'}. Drag to move, or activate to open.`}
                        onDragStart={(e) => shelfNoteDragStart(e, p.id, p.title || 'Untitled note')}
                        onDragEnd={shelfNoteDragEnd}
                        className="group min-w-0 flex-1 cursor-grab rounded-xl text-left outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                        role="button"
                        tabIndex={0}
                        onClick={() => tryOpenShelfNote(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            tryOpenShelfNote(p.id)
                          }
                        }}
                      >
                        <div className="truncate font-serif text-lg font-semibold">{p.title || 'Untitled note'}</div>
                        <div className="mt-1 text-xs text-ink/55 dark:text-ink-dark/55">
                          Updated {new Date(p.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      <div
                        className="flex shrink-0 items-start gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title="Delete note"
                          className="rounded-xl p-2 text-ink/50 hover:bg-red-500/10 hover:text-red-600 dark:text-ink-dark/50 dark:hover:bg-red-400/10 dark:hover:text-red-400"
                          onClick={(e) => deleteShelfProject(p.id, e)}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            className="rounded-xl p-2 text-ink/50 hover:bg-dust/50 dark:text-ink-dark/50 dark:hover:bg-border-dark/50"
                            title="More"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenNoteMenuId((cur) => (cur === p.id ? null : p.id))
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openNoteMenuId === p.id ? (
                            <div
                              className="absolute right-0 top-full z-[80] mt-1 w-44 rounded-xl border border-dust bg-white py-1 shadow-lg dark:border-border-dark dark:bg-panel-dark"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-xs font-medium hover:bg-dust/30 dark:hover:bg-border-dark/50"
                                onClick={() => openStickModalForNote(p.id)}
                              >
                                Attach to book or note…
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-dust/30 dark:text-red-400 dark:hover:bg-border-dark/50"
                                onClick={(ev) => deleteShelfProject(p.id, ev)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {stickNoteId ? (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[1px] dark:bg-black/50"
              role="presentation"
              onMouseDown={() => setStickNoteId(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="stick-note-title"
                className="w-full max-w-md rounded-3xl border border-dust bg-white p-6 shadow-2xl dark:border-border-dark dark:bg-panel-dark"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h3 id="stick-note-title" className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
                  Attach note
                </h3>
                <p className="mt-1 text-sm text-ink/65 dark:text-ink-dark/65">
                  Choose a book or note this entry appears under on the shelf (like pinning a sheet to another).
                </p>
                <label className="mt-4 block text-xs font-medium text-ink/70 dark:text-ink-dark/70">
                  Attach under
                  <select
                    value={stickSelectParentId}
                    onChange={(e) => setStickSelectParentId(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-dust bg-parchment px-3 py-2.5 text-sm dark:border-border-dark dark:bg-panel-dark"
                  >
                    {shelfBooks.length > 0 ? (
                      <optgroup label="Books">
                        {shelfBooks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title || 'Untitled book'}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {stickModalEligibleNotes.length > 0 ? (
                      <optgroup label="Notes">
                        {stickModalEligibleNotes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title || 'Untitled note'}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                </label>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-2xl px-4 py-2 text-sm font-medium text-ink/80 hover:bg-dust/40 dark:text-ink-dark/80 dark:hover:bg-border-dark/50"
                    onClick={() => setStickNoteId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-ink px-4 py-2 text-sm font-semibold text-parchment dark:bg-cream dark:text-ink"
                    onClick={() => linkNoteToParent(stickNoteId, stickSelectParentId)}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {shelfContextMenu && shelfContextMenuPosition ? (
            <div
              ref={shelfContextMenuRef}
              role="menu"
              aria-label="Bookshelf"
              className="fixed z-[260] min-w-[12rem] rounded-xl border border-dust bg-white py-1 shadow-xl dark:border-border-dark dark:bg-panel-dark"
              style={{ left: shelfContextMenuPosition.x, top: shelfContextMenuPosition.y }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                onClick={() => {
                  openInkwellProjectInNewTab(shelfContextMenu.projectId)
                  setShelfContextMenu(null)
                }}
              >
                Open in new tab
              </button>
            </div>
          ) : null}

          <div className="pointer-events-none fixed bottom-4 right-4 z-[250] sm:bottom-6 sm:right-6">
            <div
              ref={trashDropRef}
              onDragOver={shelfTrashDragOver}
              onDragEnter={shelfTrashDragOver}
              onDragLeave={shelfTrashDragLeave}
              onDrop={shelfTrashDrop}
              className="pointer-events-auto relative h-44 w-44 sm:h-52 sm:w-52"
              role="button"
              tabIndex={-1}
              aria-label="Drag here to delete"
              title="Drag here to delete"
            >
              {/* Aura hitbox + glow */}
              <div
                className={`absolute inset-0 rounded-full transition-[opacity,transform,filter] duration-150 ${
                  shelfDropHoverTrash ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(239,68,68,0.20) 0%, rgba(239,68,68,0.10) 34%, rgba(239,68,68,0.00) 70%)',
                  transform: `translate3d(${trashPull.x * 0.35}px, ${trashPull.y * 0.35}px, 0) scale(1.02)`,
                  filter: 'blur(0.2px)',
                }}
              />

              {/* The bin itself — light mode: darker icon + stronger fill so it reads on parchment */}
              <div
                className={`absolute bottom-2 right-2 flex h-20 w-20 items-center justify-center rounded-3xl shadow-xl transition-[transform,box-shadow,background-color,border-color] duration-150 sm:bottom-3 sm:right-3 sm:h-24 sm:w-24 ${
                  shelfDropHoverTrash
                    ? 'scale-[1.08] bg-red-200/95 ring-2 ring-red-600/55 dark:bg-red-500/25 dark:ring-red-500/60'
                    : 'bg-red-100/95 ring-1 ring-red-500/45 dark:bg-red-500/14 dark:ring-red-500/25'
                }`}
                style={{
                  transform: `translate3d(${trashPull.x}px, ${trashPull.y}px, 0) scale(${shelfDropHoverTrash ? 1.08 : 1})`,
                }}
              >
                <Trash2
                  className={`h-10 w-10 sm:h-12 sm:w-12 ${
                    shelfDropHoverTrash
                      ? 'text-red-900 dark:text-red-100'
                      : 'text-red-800 dark:text-red-100/90'
                  }`}
                  strokeWidth={2.35}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <header className="sticky top-0 z-50 border-b border-dust bg-white/90 backdrop-blur-md dark:border-border-dark dark:bg-panel-dark/90">
            <div className="mx-auto grid max-w-screen-2xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-3 sm:gap-4 sm:px-6">
              <button
                type="button"
                onClick={() => {
                  syncPersistedState()
                  setRoute('bookshelf')
                }}
                className="inkwell-header-brand group inline-flex w-fit items-center gap-2 rounded-2xl px-2 py-1.5 focus:outline-none sm:gap-3"
                aria-label="Back to Bookshelf"
                title="Bookshelf"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-ink text-lg text-parchment transition-colors group-hover:bg-cream dark:bg-cream dark:text-ink dark:group-hover:bg-accent-warm sm:text-xl">
                  🪶
                </div>
                <span className="hidden font-serif text-xl font-semibold tracking-tight sm:block sm:text-2xl">
                  Inkwell
                </span>
              </button>

              <div className="min-w-0 px-1 sm:px-4">
                {isNote ? (
                  <input
                    type="text"
                    value={current?.title ?? ''}
                    disabled={!current || route !== 'write'}
                    onChange={(e) => updateCurrentTitle(e.target.value)}
                    placeholder="Note title"
                    className="w-[min(44rem,calc(100vw-10rem))] min-w-0 rounded-2xl border border-transparent bg-transparent px-3 py-2 text-center text-base font-medium focus:border-cream focus:outline-none dark:focus:border-cream sm:px-4 sm:text-lg"
                  />
                ) : route === 'write' || route === 'publish' ? (
                  <div
                    className="mx-auto max-w-[min(44rem,calc(100vw-10rem))] truncate text-center font-serif text-sm font-semibold text-ink/80 dark:text-ink-dark/80 sm:text-base"
                    title={project.book.title.trim() || 'Untitled book'}
                  >
                    {project.book.title.trim() || 'Untitled book'}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={current?.title ?? ''}
                    disabled={!current}
                    onChange={(e) => updateCurrentTitle(e.target.value)}
                    placeholder="Chapter title"
                    className="w-[min(44rem,calc(100vw-10rem))] min-w-0 rounded-2xl border border-transparent bg-transparent px-3 py-2 text-center text-base font-medium focus:border-cream focus:outline-none dark:focus:border-cream sm:px-4 sm:text-lg disabled:opacity-80"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-1 sm:gap-2">
                <div className="flex items-center gap-0 sm:gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBookToolsOpen(true)
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl text-ink transition-colors hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                    aria-label={isNote ? 'Note tools' : 'Book tools'}
                    title={isNote ? 'Note tools' : 'Book tools'}
                  >
                    <Library className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl text-ink transition-colors hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                    aria-label="Toggle theme"
                  >
                    {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (route === 'format_ebook') setEbookEditOpen((v) => !v)
                  }}
                  className={`items-center gap-2 rounded-3xl border border-dust bg-white/70 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90 ${
                    route === 'format_ebook' ? 'hidden sm:flex' : 'hidden'
                  }`}
                  title="Toggle editor for ebook review"
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span>{ebookEditOpen ? 'Hide editor' : 'Edit'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFindReplaceOpen(true)}
                  disabled={route !== 'write'}
                  className="flex items-center gap-2 rounded-3xl border border-dust bg-white/80 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-white disabled:opacity-40 dark:border-border-dark dark:bg-panel-dark/80 dark:text-ink-dark dark:hover:bg-panel-dark sm:px-4 sm:py-2.5"
                  title="Find and replace across all sections"
                >
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Find</span>
                </button>
                <button
                  type="button"
                  onClick={exportHtml}
                  disabled={!current || route !== 'write'}
                  className="flex items-center gap-2 rounded-3xl bg-ink px-3 py-2 text-sm font-medium text-parchment transition-colors hover:bg-walnut disabled:opacity-40 dark:bg-cream dark:text-ink dark:hover:bg-accent-warm sm:px-5 sm:py-2.5"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1">
            {!isNote ?
              chaptersAsideCollapsed ?
                <aside className="flex w-11 shrink-0 flex-col items-center gap-2 border-r border-dust bg-white/70 py-3 dark:border-border-dark dark:bg-panel-dark/70 sm:w-12 sm:py-4">
                  <button
                    type="button"
                    onClick={() => setChaptersAsideCollapsedPersisted(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl text-ink transition-colors hover:bg-dust/40 dark:text-ink-dark dark:hover:bg-border-dark/50"
                    aria-label="Expand chapters list"
                    title="Show chapters"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    onClick={createManuscript}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ink text-parchment transition-transform hover:scale-105 dark:bg-cream dark:text-ink"
                    aria-label="New chapter"
                    title="New chapter"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </aside>
              : <aside className="flex w-[15.5rem] shrink-0 flex-col border-r border-dust bg-white/70 p-3 dark:border-border-dark dark:bg-panel-dark/70 sm:w-72 sm:p-5">
                  <div className="mb-3 flex items-center gap-1.5 sm:mb-5 sm:gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
                      <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                        Chapters
                      </h2>
                      <button
                        type="button"
                        onClick={createManuscript}
                        className="flex h-8 w-8 shrink-0 -translate-x-px items-center justify-center rounded-2xl bg-ink text-parchment transition-transform hover:scale-105 dark:bg-cream dark:text-ink sm:translate-x-0"
                        aria-label="New chapter"
                        title="New chapter"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChaptersAsideCollapsedPersisted(true)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-ink transition-colors hover:bg-dust/40 dark:text-ink-dark dark:hover:bg-border-dark/50"
                      aria-label="Collapse chapters list"
                      title="Collapse chapters"
                    >
                      <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-1 overflow-auto">
                    {chapters.map((ms, i) => (
                      <ManuscriptRow
                        key={ms.id}
                        manuscript={ms}
                        active={ms.id === currentId}
                        onSelectChapter={selectChapter}
                        onDeleteChapter={deleteChapter}
                        onDropReorder={onReorder}
                        wordCount={countWordsInDoc(ms.content)}
                        onSplitChapter={splitChapterAtCursor}
                        onMergeWithNext={mergeChapterWithNext}
                        canMergeWithNext={i < chapters.length - 1}
                      />
                    ))}
                  </div>
                  <p className="mt-auto border-t border-dust pt-3 text-[11px] leading-snug opacity-60 dark:border-border-dark">
                    Drag a section by its book icon. Split uses the cursor position in the open section.
                  </p>
                </aside>
            : null}

            <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-parchment/40 dark:bg-panel-dark/40">
              {route === 'format_print' ? (
                <PrintReview
                  chapters={chapters}
                  theme={project.theme}
                  book={project.book}
                  scrollToChapterId={currentId}
                  onChapterSelect={setCurrentId}
                  formatModeBar={
                    <FormatPreviewModeBar
                      mode="print"
                      onSelectEbook={() => {
                        setEbookEditOpen(false)
                        setRoute('format_ebook')
                      }}
                      onSelectPrint={() => {
                        setEbookEditOpen(false)
                        setRoute('format_print')
                      }}
                    />
                  }
                  onJumpToChapter={(id) => {
                    setCurrentId(id)
                    setRoute('write')
                  }}
                />
              ) : route === 'format_ebook' ? (
                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                  {ebookEditOpen && (
                    <div className="min-h-0 flex-1">
                      {current ? (
                        <ManuscriptEditor
                          key={`${current.id}-${editorEpoch}`}
                          manuscriptId={current.id}
                          content={current.content}
                          onDocumentChange={updateCurrentContent}
                          editorRef={editorRef}
                          toolbarVariant="full"
                          compactFooterStats
                          chapterTitle={current.title}
                          onChapterTitleChange={updateCurrentTitle}
                          showChapterTitleOnPage
                          mentionItems={mentionItems}
                          totalBookWords={liveTotalBookWords}
                          statsBookLabel={isNote ? 'Entire note' : 'Entire book'}
                          statsScopeLabel={isNote ? 'Note' : 'Chapter'}
                          wordStatStorageKey={project.id}
                        />
                      ) : (
                        <div className="flex flex-1 items-center justify-center p-8 font-serif text-lg text-walnut/80 dark:text-accent-warm/80">
                          Create a chapter to begin.
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${ebookEditOpen ? 'border-t border-dust dark:border-border-dark lg:border-l lg:border-t-0' : ''}`}
                  >
                    <EbookReview
                      chapters={chapters}
                      theme={project.theme}
                      activeChapterId={currentId}
                      formatModeBar={
                        <FormatPreviewModeBar
                          mode="ebook"
                          onSelectEbook={() => {
                            setEbookEditOpen(false)
                            setRoute('format_ebook')
                          }}
                          onSelectPrint={() => {
                            setEbookEditOpen(false)
                            setRoute('format_print')
                          }}
                        />
                      }
                      onPrevChapter={prevChapter}
                      onNextChapter={nextChapter}
                    />
                  </div>
                </div>
              ) : route === 'publish' && !isNote ? (
                <PublishHub
                  book={project.book}
                  onOpenBookTools={() => setBookToolsOpen(true)}
                  onExportPdfKdp={() => void exportPdfKdp()}
                  onExportEpub={() => void exportEpub()}
                  onImportDocx={(file) => void importDocx(file)}
                  onExportTxt={exportTxt}
                  onExportProjectArchive={() => void exportBookArchive()}
                  onExportLibraryArchive={() => void exportFullLibrary()}
                  onImportProjectArchive={(file) => void importArchiveFile(file)}
                  onOpenFormatPrint={() => setRoute('format_print')}
                  onOpenFormatEbook={() => {
                    setEbookEditOpen(false)
                    setRoute('format_ebook')
                  }}
                />
              ) : current ? (
                <ManuscriptEditor
                  key={`${current.id}-${editorEpoch}`}
                  manuscriptId={current.id}
                  content={current.content}
                  onDocumentChange={updateCurrentContent}
                  editorRef={editorRef}
                  toolbarVariant={route === 'write' ? 'writeMinimal' : 'full'}
                  compactFooterStats
                  chapterTitle={current.title}
                  onChapterTitleChange={updateCurrentTitle}
                  showChapterTitleOnPage
                  mentionItems={mentionItems}
                  totalBookWords={liveTotalBookWords}
                  statsBookLabel={isNote ? 'Entire note' : 'Entire book'}
                  statsScopeLabel={isNote ? 'Note' : 'Chapter'}
                  wordStatStorageKey={project.id}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 font-serif text-lg text-walnut/80 dark:text-accent-warm/80">
                  Create a chapter to begin.
                </div>
              )}
            </main>
            {!isNote && (route === 'format_print' || route === 'format_ebook') ? (
              <FormatThemeSidebar
                theme={project.theme}
                onThemeChange={patchTheme}
                onApplyThemePreset={applyInteriorPreset}
                collapsed={formatThemeAsideCollapsed}
                onSetCollapsed={setFormatThemeAsideCollapsedPersisted}
              />
            ) : null}
          </div>

          <BookTools
            open={bookToolsOpen}
            onClose={() => setBookToolsOpen(false)}
            projectId={project.id}
            variant={isNote ? 'note' : 'book'}
            workspaceRoute={
              isNote ? 'write'
              : route === 'format_print' ? 'format_print'
              : route === 'format_ebook' ? 'format_ebook'
              : route === 'publish' ? 'publish'
              : 'write'
            }
            onSetWorkspaceRoute={(next) => setRoute(next)}
            book={project.book}
            onBookChange={patchBook}
            goals={project.goals}
            onGoalsChange={patchGoals}
            totalBookWords={totalBookWords}
            wordsWrittenToday={wordsWrittenToday}
            onExportPdfKdp={() => {
              void exportPdfKdp()
              setBookToolsOpen(false)
            }}
            onExportEpub={() => {
              void exportEpub()
              setBookToolsOpen(false)
            }}
            onImportDocx={(file) => {
              void importDocx(file)
              setBookToolsOpen(false)
            }}
            historyEntries={historyEntries}
            onRestoreHistory={(id) => {
              restoreHistory(id)
              setBookToolsOpen(false)
            }}
            onClearHistory={clearHistory}
            onNewNoteForBook={
              project.kind === 'book' || project.kind === 'note'
                ? () => {
                    syncPersistedState()
                    const p = createNoteProject({ linkedBookId: shelfParentIdForLinkedNotes })
                    setProject(p)
                    setCurrentId(p.chapters[0]?.id ?? null)
                    setEbookEditOpen(false)
                    setBookToolsOpen(false)
                    setRoute('write')
                  }
                : undefined
            }
            linkedNotesForBook={linkedNotesForBookPanel}
            onPopoutLinkedNote={openLinkedNotePopout}
            notesProjectMaster={notesProjectMaster}
            onOpenProjectInMain={(id) => {
              syncPersistedState()
              openProject(id)
              setBookToolsOpen(false)
            }}
            assembly={project.assembly}
            onAssemblyChange={patchAssembly}
            seriesBible={project.seriesBible}
            onSeriesBibleChange={patchSeriesBible}
            onExportProjectArchive={() => {
              void exportBookArchive()
              setBookToolsOpen(false)
            }}
            onExportLibraryArchive={() => {
              void exportFullLibrary()
              setBookToolsOpen(false)
            }}
            onImportProjectArchive={(file) => {
              void importArchiveFile(file)
              setBookToolsOpen(false)
            }}
            onExportTxt={() => {
              exportTxt()
              setBookToolsOpen(false)
            }}
          />

          <FindReplaceModal
            open={findReplaceOpen}
            onClose={() => setFindReplaceOpen(false)}
            chapters={chapters}
            onApply={applyGlobalReplace}
          />

          {stickyNotePopoutId && (project.kind === 'book' || project.kind === 'note') ? (
            <StickyNotePopout
              noteId={stickyNotePopoutId}
              bookTitle={
                project.kind === 'book'
                  ? project.book.title.trim() || 'Untitled book'
                  : deriveNoteMetaTitle(project)
              }
              onClose={() => setStickyNotePopoutId(null)}
              onOpenInMainEditor={(id) => {
                syncPersistedState()
                openProject(id)
                setStickyNotePopoutId(null)
                setBookToolsOpen(false)
              }}
            />
          ) : null}

          {toast && (
            <div
              role="status"
              className="fixed bottom-8 right-8 z-[9999] flex max-w-sm items-center gap-3 rounded-3xl bg-ink px-6 py-4 text-sm font-medium text-parchment shadow-2xl dark:bg-cream dark:text-ink"
            >
              {toast.node}
            </div>
          )}
        </>
      )}
    </div>
  )
}
