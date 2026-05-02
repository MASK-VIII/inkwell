import {
  BookOpen,
  ChevronDown,
  Download,
  Library,
  Moon,
  MoreVertical,
  PenLine,
  Plus,
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
  type ReactNode,
} from 'react'
import { BookTools } from './components/BookTools'
import { StickyNotePopout } from './components/book-tools/StickyNotePopout'
import { EbookReview } from './components/EbookReview'
import { ManuscriptEditor } from './components/ManuscriptEditor'
import { ManuscriptRow } from './components/ManuscriptRow'
import { PrintReview } from './components/PrintReview'
import { attachInkwellDragGhost } from './lib/dragGhost'
import { escapeHtml } from './lib/escapeHtml'
import {
  createBookProject,
  createNoteProject,
  defaultDoc,
  deleteProject,
  ensureAtLeastOneProject,
  listBookMetas,
  listGeneralNoteMetas,
  listLinkedNotesForBook,
  listProjects,
  loadProject,
  nextManuscriptId,
  pushProjectHistorySnapshot,
  listProjectHistory,
  loadProjectSnapshot,
  clearProjectHistory,
  rememberOpenChapter,
  resolveResumeChapterId,
  saveProject,
  setActiveProjectId,
  totalWordsInChapters,
} from './lib/manuscripts'
import { buildKdpPdf } from './lib/export/pdfKdp'
import { buildEpub, epubFilename } from './lib/export/epub'
import { importDocxToChapters } from './lib/import/docx'
import type { BookMeta, EbookTheme, InkwellProject, Manuscript, PrintTheme, WritingGoals } from './types'
import type { Editor, JSONContent } from '@tiptap/core'

const THEME_KEY = 'inkwell-theme'
/** Delay before writing the open book to localStorage after typing stops (keystrokes only update React state). */
const PERSIST_IDLE_MS = 450

type DeletedSnapshot = Manuscript & { originalIndex: number }

type Route = 'bookshelf' | 'write' | 'review_print' | 'review_ebook'

function readInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(THEME_KEY)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return stored === 'dark' || (!stored && prefersDark)
}

function readRouteFromHash(): Route {
  const hash = (typeof window === 'undefined' ? '' : window.location.hash).replace(/^#/, '')
  if (hash === 'bookshelf') return 'bookshelf'
  if (hash === 'review/print') return 'review_print'
  if (hash === 'review/ebook') return 'review_ebook'
  return 'write'
}

function routeToHash(route: Route): string {
  switch (route) {
    case 'bookshelf':
      return '#bookshelf'
    case 'review_print':
      return '#review/print'
    case 'review_ebook':
      return '#review/ebook'
    case 'write':
    default:
      return '#write'
  }
}

function slugDownload(name: string) {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'manuscript'
}

const NOTE_DRAG_MIME = 'application/x-inkwell-note-id'
const NOTE_DRAG_TEXT_PREFIX = 'inkwell-note:'

function readInitialEditorSession(): {
  project: InkwellProject
  currentId: number | null
} {
  const project = ensureAtLeastOneProject()
  return { project, currentId: resolveResumeChapterId(project) }
}

function readShelfDragNoteId(dt: DataTransfer): string | null {
  try {
    const id = dt.getData(NOTE_DRAG_MIME).trim()
    if (id) return id
    const plain = dt.getData('text/plain')
    if (plain.startsWith(NOTE_DRAG_TEXT_PREFIX)) {
      return plain.slice(NOTE_DRAG_TEXT_PREFIX.length).trim()
    }
  } catch {
    /* ignore */
  }
  return null
}

export default function App() {
  const [route, setRouteState] = useState<Route>(() => readRouteFromHash())
  const [boot] = useState(readInitialEditorSession)
  const [project, setProject] = useState<InkwellProject>(() => boot.project)
  const [currentId, setCurrentId] = useState<number | null>(() => boot.currentId)
  const [ebookEditOpen, setEbookEditOpen] = useState(false)
  const [bookToolsOpen, setBookToolsOpen] = useState(false)
  const [stickyNotePopoutId, setStickyNotePopoutId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ node: ReactNode; ms: number } | null>(null)
  const [darkMode, setDarkMode] = useState(readInitialDarkMode)
  const lastDeletedRef = useRef<DeletedSnapshot | null>(null)
  const lastDeletedProjectRef = useRef<{ blob: InkwellProject } | null>(null)
  const newProjectMenuRef = useRef<HTMLDivElement | null>(null)
  const docxShelfInputRef = useRef<HTMLInputElement | null>(null)
  const [newProjectMenuOpen, setNewProjectMenuOpen] = useState(false)
  const [stickNoteId, setStickNoteId] = useState<string | null>(null)
  const [stickSelectBookId, setStickSelectBookId] = useState<string>('')
  const [openNoteMenuId, setOpenNoteMenuId] = useState<string | null>(null)
  const [shelfDropHoverBookId, setShelfDropHoverBookId] = useState<string | null>(null)
  const [shelfDropHoverNotesSection, setShelfDropHoverNotesSection] = useState(false)
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
    if (project.kind !== 'book') {
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
      if (route === 'review_ebook' && !ebookEditOpen) {
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
      if (!window.confirm('Delete this project from this device?')) return
      const blob = loadProject(id)
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

  const linkNoteToBook = useCallback(
    (noteId: string, bookId: string) => {
      const p = loadProject(noteId)
      if (!p || p.kind !== 'note' || !bookId) return
      saveProject({ ...p, linkedBookId: bookId })
      setStickNoteId(null)
      showToast('Note linked to book')
    },
    [showToast],
  )

  const unlinkNoteToGeneral = useCallback(
    (noteId: string) => {
      const p = loadProject(noteId)
      if (!p || p.kind !== 'note') return
      saveProject({ ...p, linkedBookId: null })
      setOpenNoteMenuId(null)
      showToast('Note moved to Notes')
    },
    [showToast],
  )

  const openStickModalForNote = useCallback(
    (noteId: string) => {
      const books = listBookMetas()
      if (books.length === 0) {
        showToast('Create a book first')
        return
      }
      const note = loadProject(noteId)
      const preferred =
        note?.kind === 'note' && note.linkedBookId && books.some((b) => b.id === note.linkedBookId)
          ? note.linkedBookId!
          : books[0]!.id
      setStickNoteId(noteId)
      setStickSelectBookId(preferred)
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
    setShelfDropHoverBookId(null)
    setShelfDropHoverNotesSection(false)
    window.setTimeout(() => {
      shelfNoteHadDragRef.current = false
    }, 0)
  }, [])

  const shelfBookDragOver = useCallback((e: React.DragEvent, bookId: string) => {
    if (!shelfDraggingNoteIdRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setShelfDropHoverNotesSection(false)
    setShelfDropHoverBookId(bookId)
  }, [])

  const shelfBookDragLeave = useCallback((e: React.DragEvent, bookId: string) => {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setShelfDropHoverBookId((cur) => (cur === bookId ? null : cur))
  }, [])

  const shelfBookDrop = useCallback(
    (e: React.DragEvent, bookId: string) => {
      e.preventDefault()
      const noteId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
      shelfDraggingNoteIdRef.current = null
      setShelfDropHoverBookId(null)
      setShelfDropHoverNotesSection(false)
      if (!noteId) return
      const proj = loadProject(noteId)
      if (!proj || proj.kind !== 'note') return
      if (proj.linkedBookId === bookId) {
        showToast('Note is already on this book')
        return
      }
      saveProject({ ...proj, linkedBookId: bookId })
      showToast('Note linked to book')
    },
    [showToast],
  )

  const shelfNotesSectionDragOver = useCallback((e: React.DragEvent) => {
    if (!shelfDraggingNoteIdRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setShelfDropHoverBookId(null)
    setShelfDropHoverNotesSection(true)
  }, [])

  const shelfNotesSectionDragLeave = useCallback((e: React.DragEvent) => {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setShelfDropHoverNotesSection(false)
  }, [])

  const shelfNotesSectionDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const noteId = readShelfDragNoteId(e.dataTransfer) ?? shelfDraggingNoteIdRef.current
      shelfDraggingNoteIdRef.current = null
      setShelfDropHoverBookId(null)
      setShelfDropHoverNotesSection(false)
      if (!noteId) return
      const proj = loadProject(noteId)
      if (!proj || proj.kind !== 'note') return
      if (!proj.linkedBookId) {
        showToast('Note is already in Notes')
        return
      }
      saveProject({ ...proj, linkedBookId: null })
      showToast('Note moved to Notes')
    },
    [showToast],
  )

  const shelfMetas = listProjects()
  const shelfBooks = listBookMetas(shelfMetas)
  const shelfGeneralNotes = listGeneralNoteMetas(shelfMetas)

  return (
    <div className="flex h-full min-h-0 flex-col bg-parchment text-ink transition-colors dark:bg-panel-dark dark:text-ink-dark">
      {route === 'bookshelf' ? (
        <div className="inkwell-bookshelf mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
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
            <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              Books
            </h2>
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
                const linked = listLinkedNotesForBook(p.id, shelfMetas)
                return (
                  <div
                    key={p.id}
                    onDragOver={(e) => shelfBookDragOver(e, p.id)}
                    onDragLeave={(e) => shelfBookDragLeave(e, p.id)}
                    onDrop={(e) => shelfBookDrop(e, p.id)}
                    className={`inkwell-shelf-card flex flex-col rounded-3xl border border-dust bg-white/70 text-left ease-out hover:-translate-y-px hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90 ${
                      shelfDropHoverBookId === p.id
                        ? 'inkwell-shelf-drop-target z-10 scale-[1.02] shadow-xl ring-2 ring-walnut ring-offset-2 ring-offset-parchment dark:ring-accent-warm dark:ring-offset-panel-dark'
                        : ''
                    }`}
                  >
                    <div className="flex w-full items-start justify-between gap-3 p-5">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openProject(p.id)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          openProject(p.id)
                        }}
                        className="min-w-0 flex-1 cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-walnut focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                      >
                        <div className="truncate font-serif text-lg font-semibold">
                          {p.title || 'Untitled book'}
                        </div>
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
                          title="Delete book"
                          className="rounded-xl p-2 text-ink/50 hover:bg-red-500/10 hover:text-red-600 dark:text-ink-dark/50 dark:hover:bg-red-400/10 dark:hover:text-red-400"
                          onClick={(e) => deleteShelfProject(p.id, e)}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <div className="rounded-2xl bg-dust/40 px-2 py-1 text-[11px] font-semibold text-walnut dark:bg-border-dark/60 dark:text-accent-warm">
                          Local
                        </div>
                      </div>
                    </div>
                    {linked.length > 0 ? (
                      <div className="border-t border-dust px-5 pb-4 pt-2 dark:border-border-dark">
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink/45 dark:text-ink-dark/45">
                          Notes for this book
                        </div>
                        <ul className="space-y-1">
                          {linked.map((n) => (
                            <li
                              key={n.id}
                              draggable
                              title="Drag onto another book or into Notes"
                              aria-label={`Note: ${n.title || 'Untitled note'}. Drag to move, or activate to open.`}
                              onDragStart={(e) =>
                                shelfNoteDragStart(e, n.id, n.title || 'Untitled note')
                              }
                              onDragEnd={shelfNoteDragEnd}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('[data-shelf-note-actions]')) return
                                tryOpenShelfNote(n.id)
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter' && e.key !== ' ') return
                                if ((e.target as HTMLElement).closest('[data-shelf-note-actions]')) return
                                e.preventDefault()
                                tryOpenShelfNote(n.id)
                              }}
                              tabIndex={0}
                              role="button"
                              className="flex cursor-grab touch-none items-center gap-1 rounded-xl border border-transparent px-1 py-0.5 outline-none transition-[transform,box-shadow,background-color,border-color] duration-200 ease-out hover:border-dust/70 hover:bg-dust/25 active:cursor-grabbing dark:hover:border-border-dark/60 dark:hover:bg-border-dark/35 focus-visible:ring-2 focus-visible:ring-walnut focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                            >
                              <div className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-xs font-medium text-ink dark:text-ink-dark">
                                {n.title || 'Untitled note'}
                              </div>
                              <div data-shelf-note-actions className="relative shrink-0">
                                <button
                                  type="button"
                                  className="rounded-lg p-1.5 text-ink/45 hover:bg-dust/40 dark:text-ink-dark/45 dark:hover:bg-border-dark/40"
                                  title="Note actions"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenNoteMenuId((cur) => (cur === n.id ? null : n.id))
                                  }}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                                {openNoteMenuId === n.id ? (
                                  <div
                                    className="absolute right-0 top-full z-[80] mt-1 w-44 rounded-xl border border-dust bg-white py-1 shadow-lg dark:border-border-dark dark:bg-panel-dark"
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs font-medium hover:bg-dust/30 dark:hover:bg-border-dark/50"
                                      onClick={() => {
                                        unlinkNoteToGeneral(n.id)
                                      }}
                                    >
                                      Move to Notes
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs font-medium hover:bg-dust/30 dark:hover:bg-border-dark/50"
                                      onClick={() => openStickModalForNote(n.id)}
                                    >
                                      Change book…
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-dust/30 dark:text-red-400 dark:hover:bg-border-dark/50"
                                      onClick={(ev) => deleteShelfProject(n.id, ev)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
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
                ? 'inkwell-shelf-drop-target scale-[1.01] shadow-lg ring-2 ring-walnut ring-offset-2 ring-offset-parchment dark:ring-accent-warm dark:ring-offset-panel-dark'
                : ''
            }`}
            onDragOver={shelfNotesSectionDragOver}
            onDragLeave={shelfNotesSectionDragLeave}
            onDrop={shelfNotesSectionDrop}
          >
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                Notes
              </h2>
              {shelfGeneralNotes.length > 0 ? (
                <p className="mt-1 text-sm text-ink/55 dark:text-ink-dark/55">
                  Drag a note onto a book to attach it, or drop here to move a linked note back into Notes.
                </p>
              ) : null}
            </div>
            <div
              className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
                shelfGeneralNotes.length === 0
                  ? 'min-h-[14rem] rounded-3xl border-2 border-dashed border-dust/90 bg-white/60 px-5 py-6 dark:border-border-dark dark:bg-panel-dark/55'
                  : ''
              }`}
            >
              {shelfGeneralNotes.length === 0 ? (
                <div className="col-span-full flex min-h-[11rem] flex-col items-center justify-center gap-3 px-4 text-center sm:min-h-[12rem]">
                  <p className="max-w-lg text-sm leading-relaxed text-ink/65 dark:text-ink-dark/60">
                    Drag a note onto a book to attach it, or drop here to move a linked note back into Notes.
                  </p>
                  <p className="text-xs font-medium text-walnut/80 dark:text-accent-warm/85">
                    Drop zone — park linked notes here when the list is empty
                  </p>
                </div>
              ) : null}
              {shelfGeneralNotes.map((p) => (
                <div
                  key={p.id}
                  draggable
                  title="Drag onto a book to link"
                  aria-label={`Note: ${p.title || 'Untitled note'}. Drag to move, or activate to open.`}
                  onDragStart={(e) =>
                    shelfNoteDragStart(e, p.id, p.title || 'Untitled note')
                  }
                  onDragEnd={shelfNoteDragEnd}
                  onClick={() => tryOpenShelfNote(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      tryOpenShelfNote(p.id)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="inkwell-shelf-card group flex cursor-grab rounded-3xl border border-dust bg-white/70 outline-none ease-out hover:-translate-y-px hover:bg-white active:cursor-grabbing dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90 focus-visible:ring-2 focus-visible:ring-walnut focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                >
                  <div className="min-w-0 flex-1 p-5 text-left">
                    <div className="truncate font-serif text-lg font-semibold">{p.title || 'Untitled note'}</div>
                    <div className="mt-1 text-xs text-ink/55 dark:text-ink-dark/55">
                      Updated {new Date(p.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div
                    className="flex shrink-0 flex-col items-end gap-1 p-3"
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
                            Stick to book…
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
              ))}
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
                  Link note to book
                </h3>
                <p className="mt-1 text-sm text-ink/65 dark:text-ink-dark/65">
                  Choose which book this note appears under on the shelf.
                </p>
                <label className="mt-4 block text-xs font-medium text-ink/70 dark:text-ink-dark/70">
                  Book
                  <select
                    value={stickSelectBookId}
                    onChange={(e) => setStickSelectBookId(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-dust bg-parchment px-3 py-2.5 text-sm dark:border-border-dark dark:bg-panel-dark"
                  >
                    {shelfBooks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title || 'Untitled book'}
                      </option>
                    ))}
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
                    onClick={() => linkNoteToBook(stickNoteId, stickSelectBookId)}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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
                className="group inline-flex w-fit items-center gap-2 rounded-2xl pr-2 transition-colors hover:bg-dust/30 focus:outline-none dark:hover:bg-border-dark/50 sm:gap-3"
                aria-label="Back to Bookshelf"
                title="Bookshelf"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-ink text-lg text-parchment transition-colors group-hover:bg-walnut dark:bg-cream dark:text-ink dark:group-hover:bg-accent-warm sm:text-xl">
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
                    className="w-[min(44rem,calc(100vw-10rem))] min-w-0 rounded-2xl border border-transparent bg-transparent px-3 py-2 text-center text-base font-medium focus:border-walnut focus:outline-none dark:focus:border-cream sm:px-4 sm:text-lg"
                  />
                ) : route === 'write' ? (
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
                    className="w-[min(44rem,calc(100vw-10rem))] min-w-0 rounded-2xl border border-transparent bg-transparent px-3 py-2 text-center text-base font-medium focus:border-walnut focus:outline-none dark:focus:border-cream sm:px-4 sm:text-lg disabled:opacity-80"
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
                    if (route === 'review_ebook') setEbookEditOpen((v) => !v)
                  }}
                  className={`items-center gap-2 rounded-3xl border border-dust bg-white/70 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90 ${
                    route === 'review_ebook' ? 'hidden sm:flex' : 'hidden'
                  }`}
                  title="Toggle editor for ebook review"
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span>{ebookEditOpen ? 'Hide editor' : 'Edit'}</span>
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
            {!isNote ? (
              <aside className="flex w-56 shrink-0 flex-col border-r border-dust bg-white/70 p-3 dark:border-border-dark dark:bg-panel-dark/70 sm:w-64 sm:p-5">
                <div className="mb-3 flex items-center justify-between sm:mb-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                    Chapters
                  </h2>
                  <button
                    type="button"
                    onClick={createManuscript}
                    className="flex h-8 w-8 items-center justify-center rounded-2xl bg-ink text-parchment transition-transform hover:scale-105 dark:bg-cream dark:text-ink"
                    aria-label="New chapter"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-1 overflow-auto">
                  {chapters.map((ms) => (
                    <ManuscriptRow
                      key={ms.id}
                      manuscript={ms}
                      active={ms.id === currentId}
                      onSelectChapter={selectChapter}
                      onDeleteChapter={deleteChapter}
                      onDropReorder={onReorder}
                    />
                  ))}
                </div>
                <p className="mt-auto border-t border-dust pt-3 text-[11px] leading-snug opacity-60 dark:border-border-dark">
                  Drag chapters to reorder
                </p>
              </aside>
            ) : null}

            <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-parchment/40 dark:bg-panel-dark/40">
              {route === 'review_print' ? (
                <PrintReview
                  chapters={chapters}
                  theme={project.theme}
                  book={project.book}
                  scrollToChapterId={currentId}
                  onChapterSelect={setCurrentId}
                  onPrevChapter={prevChapter}
                  onNextChapter={nextChapter}
                  onJumpToChapter={(id) => {
                    setCurrentId(id)
                    setRoute('write')
                  }}
                />
              ) : route === 'review_ebook' ? (
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
                          compactFooterStats
                          chapterTitle={current.title}
                          onChapterTitleChange={updateCurrentTitle}
                          showChapterTitleOnPage
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
                      onPrevChapter={prevChapter}
                      onNextChapter={nextChapter}
                    />
                  </div>
                </div>
              ) : current ? (
                <ManuscriptEditor
                  key={`${current.id}-${editorEpoch}`}
                  manuscriptId={current.id}
                  content={current.content}
                  onDocumentChange={updateCurrentContent}
                  editorRef={editorRef}
                  compactFooterStats
                  chapterTitle={current.title}
                  onChapterTitleChange={updateCurrentTitle}
                  showChapterTitleOnPage
                />
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 font-serif text-lg text-walnut/80 dark:text-accent-warm/80">
                  Create a chapter to begin.
                </div>
              )}
            </main>
          </div>

          <BookTools
            open={bookToolsOpen}
            onClose={() => setBookToolsOpen(false)}
            projectId={project.id}
            variant={isNote ? 'note' : 'book'}
            mode={route === 'write' ? 'write' : route === 'review_print' ? 'review_print' : 'review_ebook'}
            onSetMode={(next) => setRoute(next)}
            book={project.book}
            onBookChange={patchBook}
            goals={project.goals}
            onGoalsChange={patchGoals}
            theme={project.theme}
            onThemeChange={patchTheme}
            totalBookWords={totalBookWords}
            wordsWrittenToday={wordsWrittenToday}
            onOpenPrintReview={() => {
              setRoute('review_print')
              setBookToolsOpen(false)
            }}
            onOpenEbookReview={() => {
              setRoute('review_ebook')
              setEbookEditOpen(false)
              setBookToolsOpen(false)
            }}
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
              project.kind === 'book'
                ? () => {
                    syncPersistedState()
                    const p = createNoteProject({ linkedBookId: project.id })
                    setProject(p)
                    setCurrentId(p.chapters[0]?.id ?? null)
                    setEbookEditOpen(false)
                    setBookToolsOpen(false)
                    setRoute('write')
                  }
                : undefined
            }
            linkedNotesForBook={project.kind === 'book' ? listLinkedNotesForBook(project.id) : []}
            onPopoutLinkedNote={(noteId) => setStickyNotePopoutId(noteId)}
          />

          {stickyNotePopoutId && project.kind === 'book' ? (
            <StickyNotePopout
              noteId={stickyNotePopoutId}
              bookTitle={project.book.title.trim() || 'Untitled book'}
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
