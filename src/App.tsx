import { BookOpen, Download, Library, Moon, Plus, Sun } from 'lucide-react'
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
import { EbookReview } from './components/EbookReview'
import { ManuscriptEditor } from './components/ManuscriptEditor'
import { ManuscriptRow } from './components/ManuscriptRow'
import { PrintReview } from './components/PrintReview'
import { escapeHtml } from './lib/escapeHtml'
import {
  createProject,
  defaultDoc,
  ensureAtLeastOneProject,
  listProjects,
  loadProject,
  nextManuscriptId,
  pushProjectHistorySnapshot,
  listProjectHistory,
  loadProjectSnapshot,
  clearProjectHistory,
  saveProject,
  totalWordsInChapters,
} from './lib/manuscripts'
import { buildKdpPdf } from './lib/export/pdfKdp'
import { buildEpub, epubFilename } from './lib/export/epub'
import { importDocxToChapters } from './lib/import/docx'
import type { BookMeta, EbookTheme, InkwellProject, Manuscript, PrintTheme, ProjectMeta, WritingGoals } from './types'
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

export default function App() {
  const [route, setRouteState] = useState<Route>(() => readRouteFromHash())
  const [project, setProject] = useState<InkwellProject>(() => ensureAtLeastOneProject())
  const [currentId, setCurrentId] = useState<number | null>(() => project.chapters[0]?.id ?? null)
  const [ebookEditOpen, setEbookEditOpen] = useState(false)
  const [bookToolsOpen, setBookToolsOpen] = useState(false)
  const [toast, setToast] = useState<{ node: ReactNode; ms: number } | null>(null)
  const [darkMode, setDarkMode] = useState(readInitialDarkMode)
  const lastDeletedRef = useRef<DeletedSnapshot | null>(null)

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
      setProject(p)
      setCurrentId(p.chapters[0]?.id ?? null)
      setEbookEditOpen(false)
      setRoute('write')
      const force = listProjectHistory(p.id).length === 0
      const entry = pushProjectHistorySnapshot(p, { label: 'Opened', force })
      if (entry) bumpHistory()
    },
    [bumpHistory, setRoute, syncPersistedState],
  )

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

  const importDocx = async (file: File) => {
    const ok = window.confirm(
      'Importing a DOCX will replace the current book chapters. Continue?',
    )
    if (!ok) return
    try {
      clearPersistIdleTimer()
      pushProjectHistorySnapshot(projectRef.current, { label: 'Before import', force: true })
      bumpHistory()
      const ab = await file.arrayBuffer()
      const res = await importDocxToChapters(ab)
      const nextChapters: Manuscript[] = res.chapters.map((c, i) => ({
        id: i + 1,
        title: c.title,
        content: c.content,
      }))
      setProject((prev) => {
        const nextBookTitle =
          prev.book.title?.trim() ? prev.book : { ...prev.book, title: file.name.replace(/\.docx$/i, '') }
        return saveProject({ ...prev, book: nextBookTitle, chapters: nextChapters })
      })
      recordHistorySoon('Auto')
      setCurrentId(nextChapters[0]?.id ?? null)
      setEditorEpoch((e) => e + 1)
      setEbookEditOpen(false)
      setRoute('write')
      showToast(`Imported ${nextChapters.length} chapter${nextChapters.length === 1 ? '' : 's'}`)
    } catch {
      showToast('DOCX import failed')
    }
  }

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-parchment text-ink transition-colors dark:bg-panel-dark dark:text-ink-dark">
      {route === 'bookshelf' ? (
        <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-parchment dark:bg-cream dark:text-ink">
                🪶
              </div>
              <div>
                <h1 className="font-serif text-2xl font-semibold tracking-tight">Bookshelf</h1>
                <p className="text-sm text-ink/60 dark:text-ink-dark/60">Local projects on this device</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-11 w-11 items-center justify-center rounded-3xl border border-dust bg-white/70 text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  syncPersistedState()
                  const p = createProject()
                  setProject(p)
                  setCurrentId(p.chapters[0]?.id ?? null)
                  setEbookEditOpen(false)
                  setRoute('write')
                }}
                className="flex items-center gap-2 rounded-3xl bg-ink px-4 py-2.5 text-sm font-semibold text-parchment hover:bg-walnut dark:bg-cream dark:text-ink dark:hover:bg-accent-warm"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                New book
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
            {listProjects().map((p: ProjectMeta) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openProject(p.id)}
                className="group rounded-3xl border border-dust bg-white/70 p-5 text-left transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-serif text-lg font-semibold">{p.title || 'Untitled book'}</div>
                    <div className="mt-1 text-xs text-ink/55 dark:text-ink-dark/55">
                      Updated {new Date(p.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-dust/40 px-2 py-1 text-[11px] font-semibold text-walnut dark:bg-border-dark/60 dark:text-accent-warm">
                    Local
                  </div>
                </div>
              </button>
            ))}
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
                <input
                  type="text"
                  value={current?.title ?? ''}
                  disabled={!current || route !== 'write'}
                  onChange={(e) => updateCurrentTitle(e.target.value)}
                  placeholder="Chapter title"
                  className="w-[min(44rem,calc(100vw-10rem))] min-w-0 rounded-2xl border border-transparent bg-transparent px-3 py-2 text-center text-base font-medium focus:border-walnut focus:outline-none dark:focus:border-cream sm:px-4 sm:text-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-1 sm:gap-2">
                <div className="flex items-center gap-0 sm:gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBookToolsOpen(true)
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl text-ink transition-colors hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                    aria-label="Book tools"
                    title="Book tools"
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
                Drag handle to reorder
              </p>
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-parchment/40 dark:bg-panel-dark/40">
              {route === 'review_print' ? (
                <PrintReview
                  chapters={chapters}
                  theme={project.theme}
                  book={project.book}
                  scrollToChapterId={currentId}
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
          />

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
