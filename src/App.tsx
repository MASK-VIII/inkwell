import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  Download,
  Folders,
  LayoutTemplate,
  Library,
  Moon,
  MoreVertical,
  PenLine,
  Plus,
  Rocket,
  Sun,
  Trash2,
} from 'lucide-react'
import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { BookTools } from './components/BookTools'
import { FindReplaceModal } from './components/FindReplaceModal'
import { InkwellEmblem } from './components/InkwellEmblem'
import { InkwellWordmark } from './components/InkwellWordmark'
import { GettingStartedTour, type TourRouteBucket } from './components/GettingStartedTour'
import { NotesTour } from './components/NotesTour'
import { InkwellProfileMenu } from './components/InkwellProfileMenu'
import { SignInScreen } from './components/SignInScreen'
import { useThemeShine } from './components/useThemeShine'
import { SyncConflictModal } from './components/SyncConflictModal'
import { SyncStatusStrip } from './components/SyncStatusStrip'
import { ShelfLinkedNotesList } from './components/ShelfLinkedNotesList'
import { StickyNotePopout } from './components/book-tools/StickyNotePopout'
import { ManuscriptEditor } from './components/ManuscriptEditor'
import { ManuscriptRow } from './components/ManuscriptRow'
import { FormatPreviewModeBar } from './components/FormatPreviewModeBar'
import { devMarkChaptersToggleEnd, devMarkChaptersToggleStart } from './lib/dev/chaptersOverlayPerf'
import {
  FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS,
  FORMAT_WORKSPACE_SIDE_RAIL_WIDTH_CLASS,
} from './lib/formatWorkspaceLayout'
import { readInkwellPanelMotionDurationMs } from './lib/panelMotionMs'
import {
  devClearForceSignInFlag,
  devIsForceSignInActive,
  markNotesTutorialSeen,
  markSignInComplete,
  markSignedOut,
  markTutorialSeen,
  readBootstrap,
  shouldShowNotesTutorial,
  shouldShowSignIn,
  shouldShowTutorial,
} from './lib/bootstrapState'
import { attachInkwellDragGhost } from './lib/dragGhost'
import { NOTE_DRAG_MIME, NOTE_DRAG_TEXT_PREFIX, readShelfDragNoteId } from './lib/shelfDrag'
import {
  createBookProject,
  createNoteProject,
  createShelfProjectWithMasterNote,
  defaultDoc,
  deleteProject,
  deriveNoteMetaTitle,
  ensureAtLeastOneProject,
  hydrateInkwellStorage,
  buildInkwellUrlForProject,
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
  getTabSessionProjectId,
  loadProjectIndex,
  readOpenProjectIdFromLocation,
  rememberOpenChapter,
  resolveResumeChapterId,
  saveProject,
  setTabSessionProjectId,
  totalWordsInChapters,
  wouldCreateNoteAttachmentCycle,
} from './lib/manuscripts'
import { buildPlaintextExport } from './lib/export/plaintext'
import { tiptapDocToMarkdown } from './lib/export/tiptapToMarkdown'
import { buildWebHtmlDocument } from './lib/export/webHtml'
import { buildKdpPdf } from './lib/export/pdfKdp'
import { buildEpub, epubFilename } from './lib/export/epub'
import { importDocxToChapters } from './lib/import/docx'
import { isCloudBackupConfigured, uploadFullLibraryCloudBackup } from './lib/cloudBackup'
import { signInWithEmailPassword } from './lib/sync/authSession'
import { getInkwellSupabasePublicConfig, isInkwellCloudSyncConfigured } from './lib/sync/syncEnv'
import { useInkwellLibrarySync } from './lib/sync/useInkwellLibrarySync'
import {
  exportLibraryZip,
  exportProjectZip,
  importInkwellArchive,
  type ImportArchiveResult,
} from './lib/projectArchive'
import { mergeDocContents, splitDocAtTopLevelIndex } from './lib/chapterSplit'
import type { NotesTourStepId } from './lib/notesTutorialSteps'
import type { TourStepId } from './lib/tutorialSteps'
import { applyThemePreset, type ThemePresetId } from './lib/themePresets'
import { countWordsInDoc } from './lib/wordCount'
import { listBacklinksToNote } from './lib/noteLinkScan'
import type {
  BookAssembly,
  BookMeta,
  EbookTheme,
  InkwellProject,
  Manuscript,
  PrintTheme,
  SeriesBibleEntry,
  Theme,
  WritingGoals,
} from './types'
import type { MentionItem } from './lib/tiptap/mentionUi'
import type { Editor, JSONContent } from '@tiptap/core'

const PrintReview = lazy(() => import('./components/PrintReview').then((m) => ({ default: m.PrintReview })))
const EbookReview = lazy(() => import('./components/EbookReview').then((m) => ({ default: m.EbookReview })))
const PublishHub = lazy(() => import('./components/PublishHub').then((m) => ({ default: m.PublishHub })))
const NoteExportHub = lazy(() => import('./components/NoteExportHub').then((m) => ({ default: m.NoteExportHub })))
const FormatThemeSidebar = lazy(() =>
  import('./components/FormatThemeSidebar').then((m) => ({ default: m.FormatThemeSidebar })),
)

function RouteWorkspaceFallback() {
  return (
    <div
      className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-3 bg-parchment/30 px-6 py-12 text-center dark:bg-panel-dark/30"
      role="status"
      aria-live="polite"
    >
      <div className="h-1 w-24 rounded-full bg-dust/70 dark:bg-border-dark/90" />
      <p className="text-xs font-medium uppercase tracking-widest text-walnut/75 dark:text-accent-warm/75">
        Loading workspace
      </p>
    </div>
  )
}

const THEME_KEY = 'inkwell-theme'
const CHAPTERS_ASIDE_COLLAPSED_KEY = 'inkwell-chapters-aside-collapsed'
const FORMAT_THEME_ASIDE_COLLAPSED_KEY = 'inkwell-format-theme-aside-collapsed'
/** Delay before writing the open book to localStorage after typing stops (keystrokes only update React state). */
const PERSIST_IDLE_MS = 450

type DeletedSnapshot = Manuscript & { originalIndex: number }

type Route =
  | 'signin'
  | 'bookshelf'
  | 'write'
  | 'format_print'
  | 'format_ebook'
  | 'publish'
  | 'note_export'

type EbookFormatSlice = {
  ebook: EbookTheme
  lastEbookInteriorPresetId?: string
}

type PrintFormatSlice = {
  print: PrintTheme
  lastPrintInteriorPresetId?: string
}

function ebookSliceDirty(slice: EbookFormatSlice | null, theme: Theme): boolean {
  if (!slice) return false
  return (
    JSON.stringify(slice.ebook) !== JSON.stringify(theme.ebook) ||
    (slice.lastEbookInteriorPresetId ?? '') !== (theme.lastEbookInteriorPresetId ?? '')
  )
}

function printSliceDirty(slice: PrintFormatSlice | null, theme: Theme): boolean {
  if (!slice) return false
  return (
    JSON.stringify(slice.print) !== JSON.stringify(theme.print) ||
    (slice.lastPrintInteriorPresetId ?? '') !== (theme.lastPrintInteriorPresetId ?? '')
  )
}

function readInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(THEME_KEY)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return stored === 'dark' || (!stored && prefersDark)
}

function readRouteFromHash(): Route {
  const hash = (typeof window === 'undefined' ? '' : window.location.hash).replace(/^#/, '')
  if (hash === 'signin' || hash === 'welcome' || hash === 'cloud-signin') return 'signin'
  if (hash === 'bookshelf') return 'bookshelf'
  if (hash === 'format/print' || hash === 'review/print') return 'format_print'
  if (hash === 'format/ebook' || hash === 'review/ebook') return 'format_ebook'
  if (hash === 'publish') return 'publish'
  if (hash === 'export') return 'note_export'
  if (hash === '') {
    // Avoid booting into a random open project when the URL has no hash (common for `npm run dev`).
    if (typeof window !== 'undefined' && readBootstrap().welcomeDone && !readOpenProjectIdFromLocation()) {
      if (window.location.hash !== '#bookshelf') window.history.replaceState(null, '', '#bookshelf')
      return 'bookshelf'
    }
    return 'write'
  }
  if (hash === 'write') return 'write'
  return 'write'
}

function normalizeRouteForProject(route: Route, proj: InkwellProject): Route {
  const note = proj.kind === 'note'
  if (note && route === 'publish') return 'note_export'
  if (!note && route === 'note_export') return 'write'
  return route
}

function routeToHash(route: Route): string {
  switch (route) {
    case 'signin':
      return '#signin'
    case 'bookshelf':
      return '#bookshelf'
    case 'format_print':
      return '#format/print'
    case 'format_ebook':
      return '#format/ebook'
    case 'publish':
      return '#publish'
    case 'note_export':
      return '#export'
    case 'write':
    default:
      return '#write'
  }
}

function readInitialAppRoute(): Route {
  if (typeof window === 'undefined') return 'write'
  if (readOpenProjectIdFromLocation()) return readRouteFromHash()
  if (devIsForceSignInActive()) {
    if (window.location.hash !== '#signin') {
      window.history.replaceState(null, '', '#signin')
    }
    return 'signin'
  }
  const boot = readBootstrap()
  if (shouldShowSignIn(boot)) {
    if (window.location.hash !== '#signin') {
      window.history.replaceState(null, '', '#signin')
    }
    return 'signin'
  }
  if (
    window.location.hash === '#welcome' ||
    window.location.hash === '#signin' ||
    window.location.hash === '#cloud-signin'
  ) {
    const allowCloudSignInWhileWelcomeDone =
      (window.location.hash === '#signin' || window.location.hash === '#cloud-signin') &&
      isInkwellCloudSyncConfigured()
    if (!allowCloudSignInWhileWelcomeDone) {
      window.history.replaceState(null, '', routeToHash('bookshelf'))
      return 'bookshelf'
    }
  }
  return readRouteFromHash()
}

function slugDownload(name: string) {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'manuscript'
}

function projectIdIsIndexed(id: string): boolean {
  return loadProjectIndex().projects.some((row) => row.id === id)
}

function readInitialEditorSession(): {
  project: InkwellProject
  currentId: number | null
} {
  const fromUrl = readOpenProjectIdFromLocation()
  if (fromUrl) {
    const p = loadProject(fromUrl)
    if (p) {
      setTabSessionProjectId(fromUrl)
      return { project: p, currentId: resolveResumeChapterId(p) }
    }
    // Project blob may still be loading from IndexedDB; index is already in localStorage.
    if (projectIdIsIndexed(fromUrl)) {
      const fallback = ensureAtLeastOneProject()
      return { project: fallback, currentId: resolveResumeChapterId(fallback) }
    }
  }
  const tabId = getTabSessionProjectId()
  if (tabId) {
    const p = loadProject(tabId)
    if (p) {
      setTabSessionProjectId(p.id)
      return { project: p, currentId: resolveResumeChapterId(p) }
    }
    if (projectIdIsIndexed(tabId)) {
      const fallback = ensureAtLeastOneProject()
      return { project: fallback, currentId: resolveResumeChapterId(fallback) }
    }
    setTabSessionProjectId(null)
  }
  const project = ensureAtLeastOneProject()
  setTabSessionProjectId(project.id)
  return { project, currentId: resolveResumeChapterId(project) }
}

export default function App() {
  const [route, setRouteState] = useState<Route>(() => readInitialAppRoute())
  const [boot] = useState(readInitialEditorSession)
  const [project, setProject] = useState<InkwellProject>(() => boot.project)
  const [currentId, setCurrentId] = useState<number | null>(() => boot.currentId)
  const [ebookEditOpen, setEbookEditOpen] = useState(false)
  const [bookToolsOpen, setBookToolsOpen] = useState(false)
  const [cloudBackupBusy, setCloudBackupBusy] = useState(false)
  const [chaptersAsideCollapsed, setChaptersAsideCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(CHAPTERS_ASIDE_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [chaptersPanelMotionLive, setChaptersPanelMotionLive] = useState(false)
  const [formatThemeAsideCollapsed, setFormatThemeAsideCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(FORMAT_THEME_ASIDE_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [ebookFormatSlice, setEbookFormatSlice] = useState<EbookFormatSlice | null>(null)
  const [printFormatSlice, setPrintFormatSlice] = useState<PrintFormatSlice | null>(null)
  const ebookFormatSliceRef = useRef<EbookFormatSlice | null>(null)
  const printFormatSliceRef = useRef<PrintFormatSlice | null>(null)
  const routeRef = useRef<Route>(readInitialAppRoute())
  const [gettingStartedTourOpen, setGettingStartedTourOpen] = useState(false)
  const [tourPersistRemindLater, setTourPersistRemindLater] = useState(true)
  const [tourResumeStepId, setTourResumeStepId] = useState<string | null>(null)
  const [tourBookMenuCreate, setTourBookMenuCreate] = useState(false)
  const activeTourStepRef = useRef<TourStepId | null>(null)
  const [notesTourStepId, setNotesTourStepId] = useState<NotesTourStepId | null>(null)
  const [notesTourOpen, setNotesTourOpen] = useState(false)
  /** True after Note (or Start Writing during the choose-note step) while the Notes tour expects auto-advance. */
  const [notesTourNoteFromMenu, setNotesTourNoteFromMenu] = useState(false)
  const [notesTourPersistRemindLater, setNotesTourPersistRemindLater] = useState(true)
  const [notesTourResumeStepId, setNotesTourResumeStepId] = useState<string | null>(null)
  const [shelfHelpMenuOpen, setShelfHelpMenuOpen] = useState(false)
  const shelfHelpMenuRef = useRef<HTMLDivElement | null>(null)
  const prevRouteForSliceInitRef = useRef<Route | null>(null)
  const [findReplaceOpen, setFindReplaceOpen] = useState(false)
  const [stickyNotePopoutId, setStickyNotePopoutId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ node: ReactNode; ms: number } | null>(null)
  const [darkMode, setDarkMode] = useState(readInitialDarkMode)
  /** Set in `toggleTheme`, cleared when `inkwell:theme-change` fires after `html.dark` sync (see layout effect). */
  const pendingInkwellThemeShineRef = useRef(false)
  const bookshelfBrandRef = useRef<HTMLButtonElement | null>(null)
  const writeHeaderBrandRef = useRef<HTMLAnchorElement | null>(null)
  useThemeShine(bookshelfBrandRef)
  useThemeShine(writeHeaderBrandRef)
  const lastDeletedRef = useRef<DeletedSnapshot | null>(null)
  const lastDeletedProjectRef = useRef<{ blob: InkwellProject } | null>(null)
  const newProjectMenuRef = useRef<HTMLDivElement | null>(null)
  const docxShelfInputRef = useRef<HTMLInputElement | null>(null)
  const libraryShelfInputRef = useRef<HTMLInputElement | null>(null)
  const [newProjectMenuOpen, setNewProjectMenuOpen] = useState(false)
  const [shelfNewImportSubmenuOpen, setShelfNewImportSubmenuOpen] = useState(false)
  const [shelfAccountMenuOpen, setShelfAccountMenuOpen] = useState(false)
  const [stickNoteId, setStickNoteId] = useState<string | null>(null)
  const [stickSelectParentId, setStickSelectParentId] = useState<string>('')
  const [openNoteMenuId, setOpenNoteMenuId] = useState<string | null>(null)
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
  const cloudSyncNotifyRef = useRef<() => void>(() => {})
  const cloudSignOutRef = useRef<(() => Promise<void>) | null>(null)
  const librarySyncMenuRef = useRef<{ syncNow: () => void }>({ syncNow() {} })
  const toastTimeoutRef = useRef<number | null>(null)
  const [historyRev, setHistoryRev] = useState(0)
  /** Bumps when in-place manuscript tree changes but `currentId` can stay the same (DOCX import, history restore). Forces TipTap to remount — otherwise useEditor([manuscriptId]) keeps stale ProseMirror doc and can white-screen. */
  const [editorEpoch, setEditorEpoch] = useState(0)
  const prevProjectIdForEditorRef = useRef(project.id)
  /** Avoid syncing sessionStorage from a provisional `project` until IDB hydration — wrong id would overwrite the tab binding. */
  const tabSessionSyncReadyRef = useRef(false)

  const chapters = project.chapters

  /** Shelf parent for linked notes: book/note id that owns the current project’s note cluster. */
  const shelfParentIdForLinkedNotes = useMemo(() => {
    if (project.kind === 'note' && project.linkedBookId?.trim()) return project.linkedBookId.trim()
    return project.id
  }, [project.kind, project.id, project.linkedBookId])

  /** First row in BookTools “Notebook” / “Linked notes”; book or note master. */
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

  const wikilinkMentionItems = useMemo((): MentionItem[] => {
    if (project.kind !== 'book' && project.kind !== 'note') return []
    const metas = listLinkedNotesForBookInShelfOrder(shelfParentIdForLinkedNotes)
    const out: MentionItem[] = []
    for (const m of metas) {
      if (m.id === project.id) continue
      const p = loadProject(m.id)
      if (!p || p.kind !== 'note') continue
      const label = deriveNoteMetaTitle(p).trim() || 'Untitled note'
      out.push({ id: m.id, label })
    }
    return out.slice(0, 64)
  }, [project.kind, project.id, shelfParentIdForLinkedNotes])

  const wikilinkItemsRef = useRef<MentionItem[]>([])
  useLayoutEffect(() => {
    wikilinkItemsRef.current = wikilinkMentionItems
  }, [wikilinkMentionItems])

  const noteBacklinks = useMemo(() => {
    if (project.kind !== 'note') return []
    return listBacklinksToNote(project.id, shelfParentIdForLinkedNotes)
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
    for (const n of linkedNotesForBookPanel) {
      const p = loadProject(n.id)
      const label =
        p?.kind === 'note' ? deriveNoteMetaTitle(p).trim() || 'Untitled note' : n.title.trim() || 'Untitled note'
      items.push({ id: `mention:note:${n.id}`, label, noteProjectId: n.id })
    }
    return items
  }, [project.book.authorName, project.book.title, chapters, linkedNotesForBookPanel])
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

  const displayTheme = useMemo((): Theme => {
    if (route === 'format_ebook' && ebookFormatSlice) {
      return {
        ...project.theme,
        ebook: ebookFormatSlice.ebook,
        lastEbookInteriorPresetId:
          ebookFormatSlice.lastEbookInteriorPresetId ?? project.theme.lastEbookInteriorPresetId,
      }
    }
    if (route === 'format_print' && printFormatSlice) {
      return {
        ...project.theme,
        print: printFormatSlice.print,
        lastPrintInteriorPresetId:
          printFormatSlice.lastPrintInteriorPresetId ?? project.theme.lastPrintInteriorPresetId,
      }
    }
    return project.theme
  }, [route, project.theme, ebookFormatSlice, printFormatSlice])

  const themeCommitDirty =
    route === 'format_ebook'
      ? ebookSliceDirty(ebookFormatSlice, project.theme)
      : route === 'format_print'
        ? printSliceDirty(printFormatSlice, project.theme)
        : false

  const isFormatWorkspace = route === 'format_print' || route === 'format_ebook'

  /** Chapters column width; format workspace keeps chapters always visible (full panel). Theme sidebar collapse uses symmetric inner rails via FormatThemeSidebar. */
  const chaptersAsideWidthClass = useMemo(() => {
    if (isFormatWorkspace) return FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS
    return chaptersAsideCollapsed ? FORMAT_WORKSPACE_SIDE_RAIL_WIDTH_CLASS : FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS
  }, [isFormatWorkspace, chaptersAsideCollapsed])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    if (pendingInkwellThemeShineRef.current) {
      pendingInkwellThemeShineRef.current = false
      window.dispatchEvent(new CustomEvent('inkwell:theme-change', { detail: { dark: darkMode } }))
    }
  }, [darkMode])

  useLayoutEffect(() => {
    projectRef.current = project
  }, [project])

  useLayoutEffect(() => {
    if (!tabSessionSyncReadyRef.current) return
    setTabSessionProjectId(project.id)
  }, [project.id])

  useEffect(() => {
    rememberOpenChapter(project.id, currentId)
  }, [project.id, currentId])

  useEffect(() => {
    if (prevProjectIdForEditorRef.current !== project.id) {
      prevProjectIdForEditorRef.current = project.id
      setEditorEpoch((e) => e + 1)
    }
  }, [project.id])

  const tryDiscardFormatDraftsIfNeeded = useCallback((from: Route, to: Route): boolean => {
    if (from === 'format_ebook' && to !== 'format_ebook') {
      if (ebookSliceDirty(ebookFormatSliceRef.current, projectRef.current.theme)) {
        if (!window.confirm('Discard unsaved theme changes?')) return false
        setEbookFormatSlice(null)
      }
    }
    if (from === 'format_print' && to !== 'format_print') {
      if (printSliceDirty(printFormatSliceRef.current, projectRef.current.theme)) {
        if (!window.confirm('Discard unsaved theme changes?')) return false
        setPrintFormatSlice(null)
      }
    }
    return true
  }, [])

  const navigateRoute = useCallback(
    (next: Route) => {
      const from = routeRef.current
      if (!tryDiscardFormatDraftsIfNeeded(from, next)) return
      routeRef.current = next
      setRouteState(next)
      if (typeof window !== 'undefined') window.location.hash = routeToHash(next)
    },
    [tryDiscardFormatDraftsIfNeeded],
  )

  const navigateToCloudSignIn = useCallback(() => {
    const from = routeRef.current
    if (!tryDiscardFormatDraftsIfNeeded(from, 'signin')) return
    routeRef.current = 'signin'
    setRouteState('signin')
    if (typeof window !== 'undefined') window.location.hash = '#cloud-signin'
  }, [tryDiscardFormatDraftsIfNeeded])

  useLayoutEffect(() => {
    const normalized = normalizeRouteForProject(route, project)
    if (normalized === route) return
    if (!tryDiscardFormatDraftsIfNeeded(route, normalized)) {
      if (typeof window !== 'undefined' && window.location.hash !== routeToHash(route)) {
        window.history.replaceState(null, '', routeToHash(route))
      }
      return
    }
    navigateRoute(normalized)
  }, [project.kind, project.id, route, tryDiscardFormatDraftsIfNeeded, navigateRoute])

  useLayoutEffect(() => {
    routeRef.current = route
  }, [route])

  useLayoutEffect(() => {
    ebookFormatSliceRef.current = ebookFormatSlice
  }, [ebookFormatSlice])

  useLayoutEffect(() => {
    printFormatSliceRef.current = printFormatSlice
  }, [printFormatSlice])

  useEffect(() => {
    const prev = prevRouteForSliceInitRef.current
    prevRouteForSliceInitRef.current = route
    const t = projectRef.current.theme
    if (route === 'format_ebook' && prev !== 'format_ebook') {
      setEbookFormatSlice({
        ebook: structuredClone(t.ebook),
        lastEbookInteriorPresetId: t.lastEbookInteriorPresetId,
      })
    }
    if (route === 'format_print' && prev !== 'format_print') {
      setPrintFormatSlice({
        print: structuredClone(t.print),
        lastPrintInteriorPresetId: t.lastPrintInteriorPresetId,
      })
    }
  }, [route])

  const setChaptersAsideCollapsedPersisted = useCallback((collapsed: boolean) => {
    devMarkChaptersToggleStart(!collapsed)
    setChaptersPanelMotionLive(true)
    setChaptersAsideCollapsed(collapsed)
    try {
      localStorage.setItem(CHAPTERS_ASIDE_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const onChaptersPanelTransitionEnd = useCallback((e: TransitionEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
    devMarkChaptersToggleEnd(!chaptersAsideCollapsed)
    setChaptersPanelMotionLive(false)
  }, [chaptersAsideCollapsed])

  useEffect(() => {
    if (!chaptersPanelMotionLive) return
    const ms = readInkwellPanelMotionDurationMs()
    const id = window.setTimeout(() => setChaptersPanelMotionLive(false), ms + 150)
    return () => window.clearTimeout(id)
  }, [chaptersPanelMotionLive])

  const setFormatThemeAsideCollapsedPersisted = useCallback((collapsed: boolean) => {
    setFormatThemeAsideCollapsed(collapsed)
    try {
      localStorage.setItem(FORMAT_THEME_ASIDE_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const handleTourStepChange = useCallback((id: TourStepId | null) => {
    activeTourStepRef.current = id
  }, [])

  const handleNotesTourStepChange = useCallback((id: NotesTourStepId | null) => {
    setNotesTourStepId(id)
  }, [])

  useEffect(() => {
    if (!notesTourOpen || route !== 'bookshelf') return
    if (notesTourStepId !== 'notes-shelf-create-note') return
    setShelfHelpMenuOpen(false)
    setShelfAccountMenuOpen(false)
    setNewProjectMenuOpen(true)
  }, [notesTourOpen, route, notesTourStepId])

  useEffect(() => {
    if (!notesTourOpen || route !== 'write') return
    if (notesTourStepId !== 'notes-write-tools' && notesTourStepId !== 'notes-write-linked-panel') return
    setBookToolsOpen(true)
  }, [notesTourOpen, route, notesTourStepId])

  const handleTourClose = useCallback((reason: 'complete' | 'remind') => {
    if (reason === 'complete') markTutorialSeen()
    setGettingStartedTourOpen(false)
    setTourBookMenuCreate(false)
  }, [])

  const handleNotesTourClose = useCallback((reason: 'complete' | 'remind') => {
    if (reason === 'complete') markNotesTutorialSeen()
    setNotesTourOpen(false)
    setNotesTourNoteFromMenu(false)
  }, [])

  const tourRouteBucket = useMemo((): TourRouteBucket => {
    if (route === 'bookshelf') return 'bookshelf'
    if (route === 'write') return 'write'
    if (route === 'format_print' || route === 'format_ebook') return 'format'
    if (route === 'publish') return 'publish'
    return 'other'
  }, [route])

  useEffect(() => {
    if (route !== 'bookshelf') return
    if (!shouldShowTutorial(readBootstrap())) return
    queueMicrotask(() => {
      setTourPersistRemindLater(true)
      setTourResumeStepId(readBootstrap().tutorialStepId ?? null)
      setGettingStartedTourOpen(true)
    })
  }, [route])

  useEffect(() => {
    const onHash = () => {
      let raw = readRouteFromHash()
      if (
        raw === 'signin' &&
        readBootstrap().welcomeDone &&
        !devIsForceSignInActive() &&
        !isInkwellCloudSyncConfigured()
      ) {
        raw = 'bookshelf'
        window.history.replaceState(null, '', routeToHash('bookshelf'))
      }
      const next = normalizeRouteForProject(raw, projectRef.current)
      if (next !== raw && typeof window !== 'undefined') {
        window.history.replaceState(null, '', routeToHash(next))
      }
      const from = routeRef.current
      if (next === from) return
      if (!tryDiscardFormatDraftsIfNeeded(from, next)) {
        const h = routeToHash(from)
        if (window.location.hash !== h) window.history.replaceState(null, '', h)
        return
      }
      routeRef.current = next
      setRouteState(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [tryDiscardFormatDraftsIfNeeded])

  useEffect(() => {
    if (!newProjectMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const el = newProjectMenuRef.current
      if (el && !el.contains(e.target as Node)) {
        setNewProjectMenuOpen(false)
        setShelfNewImportSubmenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewProjectMenuOpen(false)
        setShelfNewImportSubmenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [newProjectMenuOpen])

  useEffect(() => {
    if (!shelfHelpMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const el = shelfHelpMenuRef.current
      if (el && !el.contains(e.target as Node)) setShelfHelpMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShelfHelpMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [shelfHelpMenuOpen])

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

  const tourGoBookshelf = useCallback(() => {
    syncPersistedState()
    navigateRoute('bookshelf')
  }, [syncPersistedState, navigateRoute])

  const tourGoWrite = useCallback(() => {
    navigateRoute('write')
  }, [navigateRoute])

  const tourGoFormat = useCallback(() => {
    setEbookEditOpen(false)
    navigateRoute('format_ebook')
  }, [navigateRoute])

  const tourGoPublish = useCallback(() => {
    navigateRoute('publish')
  }, [navigateRoute])

  const openLinkedNotePopout = useCallback(
    (noteId: string) => {
      syncPersistedState()
      setStickyNotePopoutId(noteId)
      setBookToolsOpen(false)
    },
    [syncPersistedState],
  )

  const onBookshelfSignOut = useCallback(() => {
    syncPersistedState()
    devClearForceSignInFlag()
    void cloudSignOutRef.current?.()
    markSignedOut()
    setGettingStartedTourOpen(false)
    setShelfAccountMenuOpen(false)
    navigateRoute('signin')
  }, [syncPersistedState, navigateRoute])

  const scheduleIdlePersist = useCallback(() => {
    if (persistIdleTimerRef.current != null) {
      window.clearTimeout(persistIdleTimerRef.current)
    }
    persistIdleTimerRef.current = window.setTimeout(() => {
      persistIdleTimerRef.current = null
      setProject((prev) => saveProject(prev))
      cloudSyncNotifyRef.current()
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
      setCurrentId(resolveResumeChapterId(p))
      setEbookEditOpen(false)
      navigateRoute('write')
      const force = listProjectHistory(p.id).length === 0
      const entry = pushProjectHistorySnapshot(p, { label: 'Opened', force })
      if (entry) bumpHistory()
    },
    [bumpHistory, navigateRoute, syncPersistedState],
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
      const ebookOnly = patch.ebook !== undefined && patch.print === undefined
      const printOnly = patch.print !== undefined && patch.ebook === undefined
      if (route === 'format_ebook' && ebookOnly) {
        setEbookFormatSlice((prev) => {
          const t = projectRef.current.theme
          const base =
            prev ??
            ({
              ebook: structuredClone(t.ebook),
              lastEbookInteriorPresetId: t.lastEbookInteriorPresetId,
            } satisfies EbookFormatSlice)
          return {
            ebook: { ...base.ebook, ...patch.ebook },
            lastEbookInteriorPresetId: base.lastEbookInteriorPresetId,
          }
        })
        return
      }
      if (route === 'format_print' && printOnly) {
        setPrintFormatSlice((prev) => {
          const t = projectRef.current.theme
          const base =
            prev ??
            ({
              print: structuredClone(t.print),
              lastPrintInteriorPresetId: t.lastPrintInteriorPresetId,
            } satisfies PrintFormatSlice)
          return {
            print: { ...base.print, ...patch.print },
            lastPrintInteriorPresetId: base.lastPrintInteriorPresetId,
          }
        })
        return
      }
      setProject((prev) =>
        saveProject({
          ...prev,
          theme: {
            ...prev.theme,
            print: { ...prev.theme.print, ...(patch.print ?? {}) },
            ebook: { ...prev.theme.ebook, ...(patch.ebook ?? {}) },
          },
        }),
      )
      recordHistorySoon('Auto')
    },
    [recordHistorySoon, route],
  )

  const commitActiveFormatTheme = useCallback(() => {
    if (route === 'format_ebook') {
      const s = ebookFormatSliceRef.current
      if (!s) return
      setProject((prev) =>
        saveProject({
          ...prev,
          theme: {
            ...prev.theme,
            ebook: s.ebook,
            lastEbookInteriorPresetId: s.lastEbookInteriorPresetId,
          },
        }),
      )
      recordHistorySoon('Theme')
      return
    }
    if (route === 'format_print') {
      const s = printFormatSliceRef.current
      if (!s) return
      setProject((prev) =>
        saveProject({
          ...prev,
          theme: {
            ...prev.theme,
            print: s.print,
            lastPrintInteriorPresetId: s.lastPrintInteriorPresetId,
          },
        }),
      )
      recordHistorySoon('Theme')
    }
  }, [route, recordHistorySoon])

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
      if (route === 'format_ebook') {
        setEbookFormatSlice((prev) => {
          const t = projectRef.current.theme
          const merged: Theme = prev
            ? {
                ...t,
                ebook: prev.ebook,
                lastEbookInteriorPresetId: prev.lastEbookInteriorPresetId,
              }
            : t
          const next = applyThemePreset(merged, id, 'ebook')
          return {
            ebook: next.ebook,
            lastEbookInteriorPresetId: next.lastEbookInteriorPresetId,
          }
        })
        return
      }
      if (route === 'format_print') {
        setPrintFormatSlice((prev) => {
          const t = projectRef.current.theme
          const merged: Theme = prev
            ? {
                ...t,
                print: prev.print,
                lastPrintInteriorPresetId: prev.lastPrintInteriorPresetId,
              }
            : t
          const next = applyThemePreset(merged, id, 'print')
          return {
            print: next.print,
            lastPrintInteriorPresetId: next.lastPrintInteriorPresetId,
          }
        })
        return
      }
      const scope: 'print' | 'ebook' = 'ebook'
      setProject((prev) =>
        saveProject({ ...prev, theme: applyThemePreset(prev.theme, id, scope) }),
      )
      recordHistorySoon('Auto')
    },
    [recordHistorySoon, route],
  )

  useEffect(() => {
    void hydrateInkwellStorage().then(() => {
      tabSessionSyncReadyRef.current = true
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

  const toggleTheme = useCallback(() => {
    const apply = () => {
      pendingInkwellThemeShineRef.current = true
      setDarkMode((prev) => {
        const next = !prev
        localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
        return next
      })
    }
    if (typeof document === 'undefined') {
      apply()
      return
    }
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => { finished: Promise<void> }
    }
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => {
        flushSync(apply)
      })
    } else {
      apply()
    }
  }, [])

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

  const uploadLibraryCloudBackup = useCallback(async () => {
    if (!isCloudBackupConfigured()) return
    setCloudBackupBusy(true)
    try {
      const r = await uploadFullLibraryCloudBackup()
      showToast(r.ok ? 'Library backup uploaded' : r.error)
    } finally {
      setCloudBackupBusy(false)
    }
  }, [showToast])

  const importArchiveFile = useCallback(
    async (file: File): Promise<ImportArchiveResult | null> => {
      try {
        const res = await importInkwellArchive(file)
        if (!res.ok) {
          showToast(res.error)
          return res
        }
        if (res.mode === 'single') {
          syncPersistedState()
          setProject(res.project)
          setCurrentId(resolveResumeChapterId(res.project))
          setEditorEpoch((e) => e + 1)
          showToast('Imported book')
        } else {
          syncPersistedState()
          showToast(`Imported ${res.imported} projects`)
        }
        return res
      } catch {
        showToast('Import failed')
        return null
      }
    },
    [showToast, syncPersistedState],
  )

  const importFromNativeDialog = useCallback(async () => {
    const bridge = typeof window !== 'undefined' ? window.inkwellDesktop : undefined
    const picked = await bridge?.importArchiveDialog?.()
    if (!picked?.buffer) return
    const file = new File([picked.buffer], picked.name || 'backup.inkwell', { type: 'application/zip' })
    const res = await importArchiveFile(file)
    if (res?.ok && res.mode === 'library') window.location.reload()
  }, [importArchiveFile])

  const runShelfFullLibraryImport = useCallback(async () => {
    setShelfNewImportSubmenuOpen(false)
    setNewProjectMenuOpen(false)
    const bridge = typeof window !== 'undefined' ? window.inkwellDesktop : undefined
    if (bridge?.importArchiveDialog) {
      try {
        const picked = await bridge.importArchiveDialog()
        if (!picked?.buffer) return
        const file = new File([picked.buffer], picked.name || 'inkwell-library-backup.zip', {
          type: 'application/zip',
        })
        const res = await importArchiveFile(file)
        if (res?.ok && res.mode === 'library') window.location.reload()
      } catch {
        showToast('Import failed')
      }
      return
    }
    libraryShelfInputRef.current?.click()
  }, [importArchiveFile, showToast])

  const exportBookArchiveDesktop = useCallback(async () => {
    const bridge = typeof window !== 'undefined' ? window.inkwellDesktop : undefined
    if (!bridge?.saveBookBackup) {
      await exportBookArchive()
      return
    }
    try {
      const blob = await exportProjectZip(project)
      const buf = await blob.arrayBuffer()
      const r = await bridge.saveBookBackup(slugDownload(project.book.title.trim() || 'book'), buf)
      if (r?.ok) showToast('Book backup saved')
      else showToast('Export canceled')
    } catch {
      showToast('Backup export failed')
    }
  }, [project, showToast, exportBookArchive])

  const exportFullLibraryDesktop = useCallback(async () => {
    const bridge = typeof window !== 'undefined' ? window.inkwellDesktop : undefined
    if (!bridge?.saveLibraryBackup) {
      await exportFullLibrary()
      return
    }
    try {
      const blob = await exportLibraryZip()
      const buf = await blob.arrayBuffer()
      const r = await bridge.saveLibraryBackup(buf)
      if (r?.ok) showToast('Library backup saved')
      else showToast('Export canceled')
    } catch {
      showToast('Library export failed')
    }
  }, [showToast, exportFullLibrary])

  const runShelfFullLibraryExport = useCallback(async () => {
    setShelfNewImportSubmenuOpen(false)
    setNewProjectMenuOpen(false)
    await exportFullLibraryDesktop()
  }, [exportFullLibraryDesktop])

  const consumeDesktopPendingImport = useCallback(async () => {
    const bridge = typeof window !== 'undefined' ? window.inkwellDesktop : undefined
    const picked = await bridge?.takePendingImport?.()
    if (!picked?.buffer) return
    const file = new File([picked.buffer], picked.name || 'backup.inkwell', { type: 'application/zip' })
    const res = await importArchiveFile(file)
    if (res?.ok && res.mode === 'library') window.location.reload()
  }, [importArchiveFile])

  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.inkwellDesktop : undefined
    if (!bridge?.onMenuAction) return
    const off = bridge.onMenuAction((action) => {
      switch (action) {
        case 'import-backup':
          void importFromNativeDialog()
          break
        case 'export-book-backup':
          void exportBookArchiveDesktop()
          break
        case 'export-library-backup':
          void exportFullLibraryDesktop()
          break
        case 'toggle-theme':
          toggleTheme()
          break
        case 'sync-library-now':
          librarySyncMenuRef.current.syncNow()
          break
        default:
          break
      }
    })
    return off
  }, [
    importFromNativeDialog,
    exportBookArchiveDesktop,
    exportFullLibraryDesktop,
    toggleTheme,
  ])

  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.inkwellDesktop : undefined
    if (!bridge?.takePendingImport) return
    const boot = window.setTimeout(() => {
      void consumeDesktopPendingImport()
    }, 0)
    if (!bridge.onPendingImport) {
      return () => window.clearTimeout(boot)
    }
    const off = bridge.onPendingImport(() => {
      window.setTimeout(() => {
        void consumeDesktopPendingImport()
      }, 0)
    })
    return () => {
      window.clearTimeout(boot)
      off()
    }
  }, [consumeDesktopPendingImport])

  const noteWebDoc = useMemo(() => chapters[0]?.content ?? null, [chapters])

  const copyFormattedHtmlForWeb = useCallback(async () => {
    const doc = noteWebDoc
    if (!doc || doc.type !== 'doc') {
      showToast('Nothing to copy')
      return
    }
    try {
      const html = buildWebHtmlDocument(doc)
      const plain = buildPlaintextExport(project).trim()
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(plain)
      }
      showToast('Copied formatted HTML')
    } catch {
      showToast('Copy failed')
    }
  }, [noteWebDoc, project, showToast])

  const copyMarkdownForWeb = useCallback(async () => {
    const doc = noteWebDoc
    if (!doc || doc.type !== 'doc') {
      showToast('Nothing to copy')
      return
    }
    try {
      const md = tiptapDocToMarkdown(doc)
      await navigator.clipboard.writeText(md)
      showToast('Copied Markdown')
    } catch {
      showToast('Copy failed')
    }
  }, [noteWebDoc, showToast])

  const downloadNoteWebHtml = useCallback(() => {
    const doc = noteWebDoc
    if (!doc || doc.type !== 'doc') {
      showToast('Nothing to export')
      return
    }
    try {
      const html = buildWebHtmlDocument(doc)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slugDownload(project.book.title.trim() || chapters[0]?.title || 'note')}.html`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Downloaded HTML')
    } catch {
      showToast('HTML export failed')
    }
  }, [noteWebDoc, project.book.title, chapters, showToast])

  const applyGlobalReplace = useCallback(
    (next: Manuscript[]) => {
      setProject((prev) => saveProject({ ...prev, chapters: next }))
      recordHistorySoon('Find & replace')
    },
    [recordHistorySoon],
  )

  const openFindReplaceModal = useCallback(() => setFindReplaceOpen(true), [])

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
        navigateRoute('write')
        showToast(`Imported ${nextChapters.length} chapter${nextChapters.length === 1 ? '' : 's'}`)
      } catch {
        showToast('DOCX import failed')
      }
    },
    [bumpHistory, clearPersistIdleTimer, recordHistorySoon, navigateRoute, showToast],
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
      navigateRoute('write')
      bumpHistory()
      showToast('Restored snapshot')
    },
    [clearPersistIdleTimer, historyEntries, showToast, bumpHistory, navigateRoute],
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
    const p = createShelfProjectWithMasterNote()
    openProject(p.id)
    setShelfUiTick((n) => n + 1)
  }, [syncPersistedState, openProject])

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

  const writeChaptersOverlay = useMemo(() => {
    if (isNote || route !== 'write') return null
    return (
      <div
        data-inkwell-tour="write-chapters"
        className={`inkwell-chapters-overlay-clip ${FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS} pointer-events-none absolute left-0 top-0 z-40 isolate h-full min-w-0 shrink-0 overflow-hidden ${
          chaptersAsideCollapsed ? 'inkwell-chapters-overlay-clip--collapsed' : 'inkwell-chapters-overlay-clip--expanded'
        }`}
      >
          <aside
            className={`inkwell-chapters-overlay-rail pointer-events-auto absolute left-0 top-0 z-20 flex h-full shrink-0 flex-col items-center gap-2 rounded-r-2xl border-r border-dust bg-white/90 py-3 shadow-xl backdrop-blur-sm dark:border-border-dark dark:bg-panel-dark/90 sm:py-4 ${FORMAT_WORKSPACE_SIDE_RAIL_WIDTH_CLASS}${chaptersPanelMotionLive ? ' inkwell-panel-motion--live' : ''}`}
          >
            <button
              type="button"
              onClick={() => setChaptersAsideCollapsedPersisted(false)}
              className="inkwell-btn-icon-sm"
              aria-label="Expand chapters list"
              title="Show chapters"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={createManuscript}
              className="inkwell-btn-chapter-new-sm"
              aria-label="New chapter"
              title="New chapter"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </aside>
          <aside
            className={`inkwell-chapters-overlay-panel absolute left-0 top-0 z-10 flex h-full shrink-0 flex-col rounded-r-2xl border-r border-dust bg-white/90 shadow-2xl backdrop-blur-sm dark:border-border-dark dark:bg-panel-dark/90 ${FORMAT_WORKSPACE_SIDE_PANEL_WIDTH_CLASS}${chaptersPanelMotionLive ? ' inkwell-panel-motion--live' : ''}`}
            onTransitionEnd={onChaptersPanelTransitionEnd}
          >
            <div className="flex items-center gap-1.5 border-b border-dust px-3 py-3 dark:border-border-dark sm:gap-2 sm:px-5 sm:py-5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                  Chapters
                </h2>
                <button
                  type="button"
                  onClick={createManuscript}
                  className="inkwell-btn-chapter-new-xs"
                  aria-label="New chapter"
                  title="New chapter"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setChaptersAsideCollapsedPersisted(true)}
                className="inkwell-btn-icon-xs"
                aria-label="Collapse chapters list"
                title="Collapse chapters"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>
            <div className="min-h-0 flex-1 touch-pan-y space-y-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-5 sm:py-5">
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
            <p className="mt-auto border-t border-dust px-3 py-3 text-[11px] leading-snug text-ink/55 dark:border-border-dark dark:text-ink-dark/55 sm:px-5">
              Drag a section by its book icon. Split uses the cursor position in the open section.
            </p>
          </aside>
      </div>
    )
  }, [
    isNote,
    route,
    chaptersAsideCollapsed,
    chaptersPanelMotionLive,
    onChaptersPanelTransitionEnd,
    chapters,
    currentId,
    setChaptersAsideCollapsedPersisted,
    createManuscript,
    selectChapter,
    deleteChapter,
    onReorder,
    splitChapterAtCursor,
    mergeChapterWithNext,
  ])

  const supabasePublicConfig = useMemo(() => getInkwellSupabasePublicConfig(), [])
  const librarySyncOptions = useMemo(
    () => ({
      supabaseConfig: supabasePublicConfig,
      showToast: (m: string) => showToast(m),
      reloadApp: () => window.location.reload(),
    }),
    [supabasePublicConfig, showToast],
  )
  const inkwellLibrarySync = useInkwellLibrarySync(librarySyncOptions)
  const [cloudSignInBusy, setCloudSignInBusy] = useState(false)
  const [syncConflictBusy, setSyncConflictBusy] = useState(false)

  useEffect(() => {
    cloudSyncNotifyRef.current = () => {
      if (supabasePublicConfig) inkwellLibrarySync.notifyLocalSaved()
    }
  }, [supabasePublicConfig, inkwellLibrarySync.notifyLocalSaved])

  useEffect(() => {
    librarySyncMenuRef.current = { syncNow: inkwellLibrarySync.syncNow }
  }, [inkwellLibrarySync.syncNow])

  useEffect(() => {
    cloudSignOutRef.current = inkwellLibrarySync.signOutCloudOnly
  }, [inkwellLibrarySync.signOutCloudOnly])

  const signInWithPasswordFromSignIn = useCallback(
    async (email: string, password: string) => {
      if (!supabasePublicConfig) return { ok: false as const, error: 'Cloud sync is not configured' }
      setCloudSignInBusy(true)
      try {
        const r = await signInWithEmailPassword(supabasePublicConfig, email, password)
        if (r.ok) {
          devClearForceSignInFlag()
          markSignInComplete()
          navigateRoute('bookshelf')
        }
        return r
      } finally {
        setCloudSignInBusy(false)
      }
    },
    [supabasePublicConfig, navigateRoute],
  )

  return (
    <div className="inkwell-theme-bridge flex h-full min-h-0 flex-col bg-parchment text-ink dark:bg-panel-dark dark:text-ink-dark">
      {route === 'signin' ? (
        <SignInScreen
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
          onComplete={() => {
            devClearForceSignInFlag()
            markSignInComplete()
            navigateRoute('bookshelf')
          }}
          cloudSync={
            isInkwellCloudSyncConfigured() && supabasePublicConfig ?
              {
                sessionEmail: inkwellLibrarySync.userEmail,
                cloudSignInBusy,
                onSignInWithEmailPassword: signInWithPasswordFromSignIn,
                onSignOutCloud: () => void inkwellLibrarySync.signOutCloudOnly(),
              }
            : undefined
          }
          profileMenu={{
            userEmail: inkwellLibrarySync.userEmail,
            cloudSyncConfigured: isInkwellCloudSyncConfigured(),
            onSyncNow: () => inkwellLibrarySync.syncNow(),
            onSignOutCloud: () => void inkwellLibrarySync.signOutCloudOnly(),
            onAppSignOut: onBookshelfSignOut,
            showLibraryHubLink: !shouldShowSignIn(readBootstrap()),
            onGoToLibraryHub: () => {
              syncPersistedState()
              navigateRoute('bookshelf')
            },
          }}
        />
      ) : route === 'bookshelf' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="inkwell-chrome-header sticky top-0 z-50 border-b border-dust bg-white/90 backdrop-blur-md dark:border-border-dark dark:bg-panel-dark/90">
            <div className="flex w-full min-h-[3.25rem] items-stretch sm:min-h-[3.5rem]">
              <div className="inkwell-theme-bridge flex min-w-0 flex-1 items-center justify-start bg-white/70 py-2 pl-3 sm:py-3 sm:pl-5 dark:bg-panel-dark/70">
                <button
                  ref={bookshelfBrandRef}
                  type="button"
                  onClick={() => {
                    syncPersistedState()
                  }}
                  className="inkwell-header-brand group inline-flex w-fit max-w-full items-center gap-2 rounded-2xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark sm:gap-3"
                  aria-label="Inkwell"
                  title="Inkwell"
                >
                  <InkwellEmblem darkMode={darkMode} />
                  <InkwellWordmark className="hidden sm:block" />
                </button>
              </div>

              <div className="flex shrink-0 flex-col items-center justify-center px-3 py-2 sm:px-4 sm:py-3">
                <div className="flex min-h-0 min-w-0 max-w-[min(44rem,100%)] flex-col items-center justify-center px-1 text-center sm:px-2">
                  <h1 className="w-full truncate font-serif text-xl font-semibold tracking-tight text-ink dark:text-ink-dark sm:text-2xl">
                    Bookshelf
                  </h1>
                  <p className="mt-0.5 max-w-[min(22rem,100%)] text-pretty text-[11px] leading-snug text-ink/60 dark:text-ink-dark/60 sm:text-sm sm:leading-normal">
                    Local projects on this device
                  </p>
                </div>
              </div>

              <div className="relative z-10 flex min-w-0 flex-1 items-center justify-end py-2 pl-2 pr-3 sm:py-3 sm:pl-3 sm:pr-5">
                <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
                  <div className="relative" ref={shelfHelpMenuRef}>
                    <button
                      type="button"
                      aria-expanded={shelfHelpMenuOpen}
                      aria-haspopup="menu"
                      onClick={() => {
                        setShelfAccountMenuOpen(false)
                        setNewProjectMenuOpen(false)
                        setShelfNewImportSubmenuOpen(false)
                        setShelfHelpMenuOpen((v) => !v)
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-3xl border border-dust bg-white/70 text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
                      aria-label="Help"
                      title="Help"
                    >
                      <CircleHelp className="h-5 w-5" strokeWidth={2.25} />
                    </button>
                    {shelfHelpMenuOpen ? (
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-[60] mt-2 min-w-[14rem] overflow-hidden rounded-2xl border border-dust bg-white py-1 shadow-xl dark:border-border-dark dark:bg-panel-dark"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                          onClick={() => {
                            setShelfHelpMenuOpen(false)
                            const b = readBootstrap()
                            const persist = shouldShowTutorial(b)
                            setTourPersistRemindLater(persist)
                            setTourResumeStepId(persist ? (b.tutorialStepId ?? null) : null)
                            setGettingStartedTourOpen(true)
                          }}
                        >
                          Getting Started
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                          onClick={() => {
                            setShelfHelpMenuOpen(false)
                            const b = readBootstrap()
                            setNotesTourPersistRemindLater(shouldShowNotesTutorial(b))
                            setNotesTourResumeStepId(b.notesTutorialStepId ?? null)
                            setNotesTourOpen(true)
                          }}
                        >
                          Notes and Projects
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShelfAccountMenuOpen(false)
                      setNewProjectMenuOpen(false)
                      setShelfNewImportSubmenuOpen(false)
                      toggleTheme()
                    }}
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
                      navigateRoute('write')
                      setNewProjectMenuOpen(false)
                      setShelfNewImportSubmenuOpen(false)
                      await importDocxIntoProject(
                        file,
                        p,
                        'Importing a DOCX will replace chapters in this new book. Continue?',
                      )
                    }}
                  />
                  <input
                    ref={libraryShelfInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0] ?? null
                      e.currentTarget.value = ''
                      if (!file) return
                      const res = await importArchiveFile(file)
                      if (res?.ok && res.mode === 'library') window.location.reload()
                    }}
                  />
                  <div className="relative" ref={newProjectMenuRef}>
                    <button
                      type="button"
                      data-inkwell-tour="shelf-new"
                      onClick={() => {
                        setShelfAccountMenuOpen(false)
                        setNewProjectMenuOpen((v) => {
                          const next = !v
                          if (!next) setShelfNewImportSubmenuOpen(false)
                          return next
                        })
                      }}
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
                        className="absolute right-0 top-full z-50 mt-2 min-w-[13.5rem] overflow-visible rounded-2xl border border-dust bg-white py-1 shadow-xl dark:border-border-dark dark:bg-panel-dark"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          data-inkwell-tour="shelf-menu-book"
                          className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                          onClick={() => {
                            setNewProjectMenuOpen(false)
                            setShelfNewImportSubmenuOpen(false)
                            syncPersistedState()
                            if (gettingStartedTourOpen && activeTourStepRef.current === 'shelf-pick-book') {
                              setTourBookMenuCreate(true)
                            }
                            const p = createBookProject()
                            setProject(p)
                            setCurrentId(p.chapters[0]?.id ?? null)
                            setEbookEditOpen(false)
                            navigateRoute('write')
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
                            setShelfNewImportSubmenuOpen(false)
                            syncPersistedState()
                            const p = createShelfProjectWithMasterNote()
                            openProject(p.id)
                            setShelfUiTick((n) => n + 1)
                          }}
                        >
                          Project
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          data-inkwell-tour="shelf-menu-note"
                          className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                          onClick={() => {
                            setNewProjectMenuOpen(false)
                            setShelfNewImportSubmenuOpen(false)
                            syncPersistedState()
                            if (notesTourOpen && notesTourStepId === 'notes-shelf-create-note') {
                              setNotesTourNoteFromMenu(true)
                            }
                            const p = createNoteProject()
                            setProject(p)
                            setCurrentId(p.chapters[0]?.id ?? null)
                            setEbookEditOpen(false)
                            navigateRoute('write')
                          }}
                        >
                          Note
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            role="menuitem"
                            aria-expanded={shelfNewImportSubmenuOpen}
                            aria-haspopup="menu"
                            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                            onClick={() => setShelfNewImportSubmenuOpen((v) => !v)}
                          >
                            Import / export
                            <ChevronRight className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2.25} aria-hidden />
                          </button>
                          {shelfNewImportSubmenuOpen ? (
                            <div
                              role="menu"
                              className="absolute right-full top-0 z-[60] mr-1 min-w-[13.5rem] overflow-hidden rounded-2xl border border-dust bg-white py-1 shadow-xl dark:border-border-dark dark:bg-panel-dark"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                                onClick={() => {
                                  setShelfNewImportSubmenuOpen(false)
                                  setNewProjectMenuOpen(false)
                                  docxShelfInputRef.current?.click()
                                }}
                              >
                                Import docx...
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                                onClick={() => void runShelfFullLibraryImport()}
                              >
                                Import full library...
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50"
                                onClick={() => void runShelfFullLibraryExport()}
                              >
                                Export full library...
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <InkwellProfileMenu
                    userEmail={inkwellLibrarySync.userEmail}
                    cloudSyncConfigured={isInkwellCloudSyncConfigured()}
                    onSyncNow={() => inkwellLibrarySync.syncNow()}
                    onSignOutCloud={() => void inkwellLibrarySync.signOutCloudOnly()}
                    onAppSignOut={onBookshelfSignOut}
                    showLibraryHubLink
                    onGoToLibraryHub={() => {
                      syncPersistedState()
                      navigateRoute('bookshelf')
                    }}
                    menuOpen={shelfAccountMenuOpen}
                    onMenuOpenChange={setShelfAccountMenuOpen}
                    onRequestExclusiveOpen={() => {
                      setNewProjectMenuOpen(false)
                      setShelfNewImportSubmenuOpen(false)
                      setShelfHelpMenuOpen(false)
                    }}
                  />
                </div>
              </div>
            </div>
          </header>

          {isInkwellCloudSyncConfigured() ? (
            <SyncStatusStrip
              status={inkwellLibrarySync.status}
              detail={inkwellLibrarySync.statusDetail}
              signedIn={Boolean(inkwellLibrarySync.userEmail)}
              queueHasWork={inkwellLibrarySync.queueHasWork}
            />
          ) : null}

          {isInkwellCloudSyncConfigured() && !inkwellLibrarySync.userEmail ? (
            <div
              role="region"
              aria-label="Cloud library sync"
              className="border-b border-sky-200/90 bg-sky-50/95 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/45 sm:px-8"
            >
              <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 items-start gap-2.5 text-sm text-sky-950 dark:text-sky-100/95">
                  <Cloud
                    className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <p className="min-w-0 leading-snug">
                    <span className="font-semibold">Sign in to sync</span>
                    <span className="text-sky-900/85 dark:text-sky-200/85">
                      {' '}
                      Open the cloud sign-in screen to use the same library as the web app.
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShelfAccountMenuOpen(false)
                    navigateToCloudSignIn()
                  }}
                  className="shrink-0 self-start rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 sm:self-auto dark:bg-sky-500 dark:text-sky-950 dark:hover:bg-sky-400"
                >
                  Open sign-in
                </button>
              </div>
            </div>
          ) : null}

          <div className="inkwell-bookshelf mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 pb-6 sm:px-8 sm:pb-10">
            <div className="flex justify-center pb-2 pt-4 sm:pb-3 sm:pt-5">
              <button
                type="button"
                onClick={() => {
                  setNewProjectMenuOpen(false)
                  setShelfNewImportSubmenuOpen(false)
                  syncPersistedState()
                  if (notesTourOpen && notesTourStepId === 'notes-shelf-create-note') {
                    setNotesTourNoteFromMenu(true)
                  }
                  const p = createNoteProject()
                  setProject(p)
                  setCurrentId(p.chapters[0]?.id ?? null)
                  setEbookEditOpen(false)
                  navigateRoute('write')
                }}
                className="flex items-center gap-2 rounded-3xl bg-ink px-5 py-2.5 text-sm font-semibold text-parchment shadow-sm ring-1 ring-ink/10 hover:bg-walnut dark:bg-cream dark:text-ink dark:ring-cream/20 dark:hover:bg-accent-warm sm:px-6 sm:text-base"
              >
                <PenLine className="h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]" strokeWidth={2.25} />
                Start Writing
              </button>
            </div>

          <section className="mt-4 space-y-3 sm:mt-5 sm:space-y-4" data-inkwell-tour="shelf-books">
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
                    No books yet. Click <strong>New → Book</strong> to start your first one, use{' '}
                    <strong>New → Project</strong> for a project hub, or{' '}
                    <strong>New → Import / export → Import docx…</strong> to bring in a draft.
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
                      <a
                        href={buildInkwellUrlForProject(p.id)}
                        onClick={(e) => {
                          e.preventDefault()
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
                          <div
                            className={`mt-0.5 flex h-10 w-10 shrink-0 overflow-hidden rounded-2xl ${
                              p.coverImageDataUrl
                                ? 'ring-1 ring-ink/10 dark:ring-white/15'
                                : 'items-center justify-center bg-dust/60 text-walnut dark:bg-border-dark/60 dark:text-accent-warm'
                            }`}
                          >
                            {p.coverImageDataUrl ? (
                              <img
                                src={p.coverImageDataUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <BookOpen className="h-5 w-5" strokeWidth={2} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-serif text-lg font-semibold">{p.title || 'Untitled book'}</div>
                            <div className="mt-1 text-xs text-ink/55 dark:text-ink-dark/55">
                              Updated {new Date(p.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </a>
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
                          <a
                            href={buildInkwellUrlForProject(p.id)}
                            onClick={(e) => {
                              e.preventDefault()
                              openProject(p.id)
                              setExpandedShelfParentId(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return
                              e.preventDefault()
                              openProject(p.id)
                              setExpandedShelfParentId(null)
                            }}
                            className="block w-full cursor-pointer rounded-2xl border border-dust bg-white/70 px-4 py-3 text-left outline-none transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90 focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
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
                          </a>
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
                            <a
                              key={n.id}
                              href={buildInkwellUrlForProject(n.id)}
                              onClick={(e) => e.preventDefault()}
                              className="block truncate text-xs text-ink/55 dark:text-ink-dark/55"
                            >
                              {n.title || 'Untitled note'}
                            </a>
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
            className={`mt-10 space-y-3 sm:space-y-4 rounded-3xl transition-[transform,box-shadow] duration-300 ease-out ${
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
                    Use <strong>New → Project</strong> or the <strong>+</strong> button for a new project hub. Projects
                    also appear when a note has other notes attached under it — drag a note onto another note to
                    create one.
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
                      <a
                        href={buildInkwellUrlForProject(p.id)}
                        onClick={(e) => {
                          e.preventDefault()
                          setExpandedShelfParentId((cur) => (cur === p.id ? null : p.id))
                        }}
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
                      </a>

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
                          <a
                            draggable
                            href={buildInkwellUrlForProject(p.id)}
                            title="Drag onto a book, project, note, or into Notes"
                            aria-label={`Master note: ${p.title || 'Untitled note'}. Drag to move, or activate to open.`}
                            onDragStart={(e) => shelfNoteDragStart(e, p.id, p.title || 'Untitled note')}
                            onDragEnd={shelfNoteDragEnd}
                            className="block w-full cursor-grab rounded-2xl border border-dust bg-white/70 px-4 py-3 text-left outline-none transition-colors hover:bg-white active:cursor-grabbing dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90 focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                            onClick={(e) => {
                              e.preventDefault()
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
                          </a>
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
                            <a
                              key={n.id}
                              href={buildInkwellUrlForProject(n.id)}
                              onClick={(e) => e.preventDefault()}
                              className="block truncate text-xs text-ink/55 dark:text-ink-dark/55"
                            >
                              {n.title || 'Untitled note'}
                            </a>
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
            data-inkwell-tour="shelf-notes"
            className={`mt-10 space-y-3 sm:space-y-4 rounded-3xl transition-[transform,box-shadow] duration-300 ease-out ${
              shelfDropHoverNotesSection
                ? 'inkwell-shelf-drop-target scale-[1.01] shadow-lg ring-2 ring-cream ring-offset-2 ring-offset-parchment dark:ring-accent-warm dark:ring-offset-panel-dark'
                : ''
            }`}
            onDragEnter={shelfNotesSectionDragOver}
            onDragOver={shelfNotesSectionDragOver}
            onDragLeave={shelfNotesSectionDragLeave}
            onDrop={shelfNotesSectionDrop}
          >
            <div className="flex flex-col gap-2">
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
                <p className="text-sm text-ink/55 dark:text-ink-dark/55">
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
                      <a
                        draggable
                        href={buildInkwellUrlForProject(p.id)}
                        title="Drag onto a book or note to attach"
                        aria-label={`Note: ${p.title || 'Untitled note'}. Drag to move, or activate to open.`}
                        onDragStart={(e) => shelfNoteDragStart(e, p.id, p.title || 'Untitled note')}
                        onDragEnd={shelfNoteDragEnd}
                        className="group min-w-0 flex-1 cursor-grab rounded-xl text-left outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream dark:focus-visible:ring-offset-panel-dark"
                        onClick={(e) => {
                          e.preventDefault()
                          tryOpenShelfNote(p.id)
                        }}
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
                      </a>

                      <div
                        className="flex shrink-0 items-start gap-2"
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
        </div>
      ) : (
        <>
          <header className="inkwell-chrome-header sticky top-0 z-50 border-b border-dust bg-white/90 backdrop-blur-md dark:border-border-dark dark:bg-panel-dark/90">
            <div className="flex w-full min-h-[3.25rem] items-stretch sm:min-h-[3.5rem]">
              <div className="inkwell-theme-bridge flex min-w-0 flex-1 items-center justify-start bg-white/70 py-2 pl-3 sm:py-3 sm:pl-5 dark:bg-panel-dark/70">
                <div className={!isNote && isFormatWorkspace ? chaptersAsideWidthClass : 'min-w-0'}>
                  <a
                    ref={writeHeaderBrandRef}
                    href={buildInkwellUrlForProject(project.id)}
                    onClick={(e) => {
                      e.preventDefault()
                      syncPersistedState()
                      navigateRoute('bookshelf')
                    }}
                    onContextMenu={() => {
                      syncPersistedState()
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
                        syncPersistedState()
                      }
                    }}
                    className="inkwell-header-brand group inline-flex w-fit max-w-full items-center gap-2 rounded-2xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark sm:gap-3"
                    aria-label="Back to Bookshelf"
                    title="Bookshelf"
                  >
                    <InkwellEmblem darkMode={darkMode} />
                    <InkwellWordmark className="hidden sm:block" />
                  </a>
                </div>
              </div>

              <div className="flex min-h-[3.25rem] shrink-0 flex-col items-center justify-center px-3 py-2 sm:min-h-[3.5rem] sm:px-4 sm:py-3">
                <div className="min-w-0 w-full max-w-[min(44rem,100%)]">
                  {isNote ? (
                    <input
                      type="text"
                      value={current?.title ?? ''}
                      disabled={!current || (route !== 'write' && route !== 'note_export')}
                      onChange={(e) => updateCurrentTitle(e.target.value)}
                      placeholder="Note title"
                      className="w-full min-w-0 rounded-2xl border border-transparent bg-transparent px-3 py-2 text-center text-base font-medium focus:border-cream focus:outline-none dark:focus:border-cream sm:px-4 sm:text-lg"
                    />
                  ) : route === 'write' ? (
                    <div
                      className="truncate px-3 py-2 text-center text-base font-semibold text-ink dark:text-ink-dark sm:px-4 sm:text-lg"
                      title={project.book.title.trim() || 'Untitled book'}
                    >
                      {project.book.title.trim() || 'Untitled book'}
                    </div>
                  ) : route === 'publish' ? (
                    <div
                      className="truncate px-3 py-2 text-center text-base font-semibold text-ink dark:text-ink-dark sm:px-4 sm:text-lg"
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
                      className="w-full min-w-0 rounded-2xl border border-transparent bg-transparent px-3 py-2 text-center text-base font-semibold text-ink focus:border-cream focus:outline-none dark:text-ink-dark dark:focus:border-cream sm:px-4 sm:text-lg disabled:opacity-80"
                    />
                  )}
                </div>
              </div>

              <div className="relative z-10 flex min-w-0 flex-1 items-center justify-end gap-2 py-2 pl-2 pr-3 sm:py-3 sm:pr-5">
                <div
                  className={`flex min-w-0 max-w-full items-center justify-end gap-1 sm:gap-2 ${
                    !isNote && isFormatWorkspace
                      ? 'flex-nowrap overflow-x-auto overscroll-x-contain px-0.5 sm:px-1'
                      : 'flex-wrap'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (route === 'format_ebook') setEbookEditOpen((v) => !v)
                    }}
                    className={`shrink-0 items-center gap-2 rounded-3xl border border-dust bg-white/70 px-2.5 py-2 text-sm font-medium text-ink outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-walnut/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90 dark:focus-visible:ring-cream/45 dark:focus-visible:ring-offset-panel-dark sm:px-3 ${
                      route === 'format_ebook' ? 'flex' : 'hidden'
                    }`}
                    title="Toggle editor for ebook review"
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span>{ebookEditOpen ? 'Hide editor' : 'Edit'}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0 sm:gap-0.5">
                    <button
                      type="button"
                      data-inkwell-tour="header-book-tools"
                      onClick={() => {
                        setBookToolsOpen(true)
                      }}
                      className="inkwell-btn-icon"
                      aria-label={isNote ? 'Note tools' : 'Book tools'}
                      title={isNote ? 'Note tools' : 'Book tools'}
                    >
                      <Library className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="inkwell-btn-icon"
                      aria-label="Toggle theme"
                    >
                      {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                  </div>
                  {isNote ? (
                    <button
                      type="button"
                      onClick={() => {
                        syncPersistedState()
                        if (route === 'note_export') navigateRoute('write')
                        else navigateRoute('note_export')
                      }}
                      disabled={!current}
                      className="flex items-center gap-2 rounded-3xl bg-ink px-3 py-2 text-sm font-medium text-parchment outline-none transition-colors hover:bg-walnut focus-visible:ring-2 focus-visible:ring-walnut/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-40 dark:bg-cream dark:text-ink dark:hover:bg-accent-warm dark:focus-visible:ring-cream/55 dark:focus-visible:ring-offset-panel-dark sm:px-5 sm:py-2.5"
                      aria-label={route === 'note_export' ? 'Back to Write' : 'Open Export workspace'}
                      title={route === 'note_export' ? 'Back to writing' : 'Export for the web and backups'}
                    >
                      {route === 'note_export' ? (
                        <PenLine className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                      ) : (
                        <Download className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                      )}
                      <span className="hidden sm:inline">{route === 'note_export' ? 'Write' : 'Export'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-inkwell-tour={isFormatWorkspace ? 'header-workspace-publish' : 'header-workspace-format'}
                      onClick={() => {
                        if (isFormatWorkspace) navigateRoute('publish')
                        else {
                          syncPersistedState()
                          setEbookEditOpen(false)
                          navigateRoute('format_ebook')
                        }
                      }}
                      disabled={isFormatWorkspace ? false : !current || route !== 'write'}
                      className="flex shrink-0 items-center gap-2 rounded-3xl bg-ink px-3 py-2 text-sm font-medium text-parchment outline-none transition-colors hover:bg-walnut focus-visible:ring-2 focus-visible:ring-walnut/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-40 dark:bg-cream dark:text-ink dark:hover:bg-accent-warm dark:focus-visible:ring-cream/55 dark:focus-visible:ring-offset-panel-dark sm:px-5 sm:py-2.5"
                      aria-label={isFormatWorkspace ? 'Go to Publish workspace' : 'Open Format workspace'}
                      title={isFormatWorkspace ? 'Open Publish workspace' : 'Ebook & print previews'}
                    >
                      {isFormatWorkspace ? (
                        <Rocket className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                      ) : (
                        <LayoutTemplate className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                      )}
                      <span className="hidden sm:inline">{isFormatWorkspace ? 'Publish!' : 'Format'}</span>
                    </button>
                  )}
                  <InkwellProfileMenu
                    userEmail={inkwellLibrarySync.userEmail}
                    cloudSyncConfigured={isInkwellCloudSyncConfigured()}
                    onSyncNow={() => inkwellLibrarySync.syncNow()}
                    onSignOutCloud={() => void inkwellLibrarySync.signOutCloudOnly()}
                    onAppSignOut={onBookshelfSignOut}
                    showLibraryHubLink
                    onGoToLibraryHub={() => {
                      syncPersistedState()
                      navigateRoute('bookshelf')
                    }}
                    onRequestExclusiveOpen={() => setBookToolsOpen(false)}
                  />
                </div>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 w-full flex-1">
            {!isNote && route !== 'write' ?
              <aside
                className={`flex shrink-0 flex-col border-r border-dust bg-white/70 transition-[width] duration-300 ease-out dark:border-border-dark dark:bg-panel-dark/70 ${chaptersAsideWidthClass}`}
              >
                {chaptersAsideCollapsed && !isFormatWorkspace ?
                  <div className="flex min-h-0 flex-1 flex-col items-end py-3 sm:py-4">
                    <div
                      className={`flex flex-col items-center gap-2 ${FORMAT_WORKSPACE_SIDE_RAIL_WIDTH_CLASS}`}
                    >
                      <button
                        type="button"
                        onClick={() => setChaptersAsideCollapsedPersisted(false)}
                        className="inkwell-btn-icon-sm"
                        aria-label="Expand chapters list"
                        title="Show chapters"
                      >
                        <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        onClick={createManuscript}
                        className="inkwell-btn-chapter-new-sm"
                        aria-label="New chapter"
                        title="New chapter"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                : <>
                    <div className="flex items-center gap-1.5 border-b border-dust px-3 py-3 dark:border-border-dark sm:gap-2 sm:px-5 sm:py-5">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                          Chapters
                        </h2>
                        <button
                          type="button"
                          onClick={createManuscript}
                          className="inkwell-btn-chapter-new-xs"
                          aria-label="New chapter"
                          title="New chapter"
                        >
                          <Plus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      </div>
                      {!isFormatWorkspace ? (
                        <button
                          type="button"
                          onClick={() => setChaptersAsideCollapsedPersisted(true)}
                          className="inkwell-btn-icon-xs"
                          aria-label="Collapse chapters list"
                          title="Collapse chapters"
                        >
                          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                      ) : null}
                    </div>
                    <div className="min-h-0 flex-1 space-y-1 overflow-auto px-3 py-4 sm:px-5 sm:py-5">
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
                    <p className="mt-auto border-t border-dust px-3 py-3 text-[11px] leading-snug text-ink/55 dark:border-border-dark dark:text-ink-dark/55 sm:px-5">
                      Drag a section by its book icon. Split uses the cursor position in the open section.
                    </p>
                  </>
                }
              </aside>
            : null}

            <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-parchment/40 dark:bg-panel-dark/40">
              {route === 'format_print' ? (
                <Suspense fallback={<RouteWorkspaceFallback />}>
                  <PrintReview
                    chapters={chapters}
                    theme={displayTheme}
                    book={project.book}
                    scrollToChapterId={currentId}
                    onChapterSelect={setCurrentId}
                    formatModeBar={
                      <FormatPreviewModeBar
                        mode="print"
                        onSelectEbook={() => {
                          setEbookEditOpen(false)
                          navigateRoute('format_ebook')
                        }}
                        onSelectPrint={() => {
                          setEbookEditOpen(false)
                          navigateRoute('format_print')
                        }}
                      />
                    }
                    onJumpToChapter={(id) => {
                      setCurrentId(id)
                      navigateRoute('write')
                    }}
                  />
                </Suspense>
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
                          getWikilinkCandidates={() => wikilinkItemsRef.current}
                          onNoteMentionClick={openLinkedNotePopout}
                          onWikilinkClick={openLinkedNotePopout}
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
                    <Suspense fallback={<RouteWorkspaceFallback />}>
                      <EbookReview
                        chapters={chapters}
                        theme={displayTheme}
                        activeChapterId={currentId}
                        formatModeBar={
                          <FormatPreviewModeBar
                            mode="ebook"
                            onSelectEbook={() => {
                              setEbookEditOpen(false)
                              navigateRoute('format_ebook')
                            }}
                            onSelectPrint={() => {
                              setEbookEditOpen(false)
                              navigateRoute('format_print')
                            }}
                          />
                        }
                        onPrevChapter={prevChapter}
                        onNextChapter={nextChapter}
                      />
                    </Suspense>
                  </div>
                </div>
              ) : route === 'note_export' && isNote ? (
                <Suspense fallback={<RouteWorkspaceFallback />}>
                  <NoteExportHub
                    noteTitle={deriveNoteMetaTitle(project)}
                    wordCount={liveTotalBookWords}
                    onOpenNoteTools={() => setBookToolsOpen(true)}
                    onBackToWrite={() => navigateRoute('write')}
                    onExportTxt={exportTxt}
                    onExportProjectArchive={() => void exportBookArchive()}
                    onExportLibraryArchive={() => void exportFullLibrary()}
                    onImportProjectArchive={(file) => void importArchiveFile(file)}
                    onCopyFormattedHtml={() => void copyFormattedHtmlForWeb()}
                    onCopyMarkdown={() => void copyMarkdownForWeb()}
                    onDownloadHtml={() => downloadNoteWebHtml()}
                    onCloudBackupLibrary={
                      isCloudBackupConfigured() ? () => void uploadLibraryCloudBackup() : undefined
                    }
                    cloudBackupBusy={cloudBackupBusy}
                  />
                </Suspense>
              ) : route === 'publish' && !isNote ? (
                <Suspense fallback={<RouteWorkspaceFallback />}>
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
                    onOpenFormatPrint={() => navigateRoute('format_print')}
                    onOpenFormatEbook={() => {
                      setEbookEditOpen(false)
                      navigateRoute('format_ebook')
                    }}
                    onCloudBackupLibrary={
                      isCloudBackupConfigured() ? () => void uploadLibraryCloudBackup() : undefined
                    }
                    cloudBackupBusy={cloudBackupBusy}
                  />
                </Suspense>
              ) : current ? (
                <ManuscriptEditor
                  key={`${current.id}-${editorEpoch}`}
                  manuscriptId={current.id}
                  content={current.content}
                  onDocumentChange={updateCurrentContent}
                  editorRef={editorRef}
                  toolbarVariant={route === 'write' ? 'writeMinimal' : 'full'}
                  onOpenFindReplace={route === 'write' ? openFindReplaceModal : undefined}
                  compactFooterStats
                  chapterTitle={current.title}
                  onChapterTitleChange={updateCurrentTitle}
                  showChapterTitleOnPage
                  mentionItems={mentionItems}
                  getWikilinkCandidates={() => wikilinkItemsRef.current}
                  onNoteMentionClick={openLinkedNotePopout}
                  onWikilinkClick={openLinkedNotePopout}
                  totalBookWords={liveTotalBookWords}
                  statsBookLabel={isNote ? 'Entire note' : 'Entire book'}
                  statsScopeLabel={isNote ? 'Note' : 'Chapter'}
                  wordStatStorageKey={project.id}
                  leftOverlay={writeChaptersOverlay}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 font-serif text-lg text-walnut/80 dark:text-accent-warm/80">
                  Create a chapter to begin.
                </div>
              )}
            </main>
            {!isNote && (route === 'format_print' || route === 'format_ebook') ? (
              <Suspense fallback={<RouteWorkspaceFallback />}>
                <FormatThemeSidebar
                  theme={displayTheme}
                  formatScope={route === 'format_print' ? 'print' : 'ebook'}
                  onThemeChange={patchTheme}
                  onApplyThemePreset={applyInteriorPreset}
                  themeCommitDirty={themeCommitDirty}
                  onCommitTheme={commitActiveFormatTheme}
                  collapsed={formatThemeAsideCollapsed}
                  onSetCollapsed={setFormatThemeAsideCollapsedPersisted}
                  sideColumnClassName={chaptersAsideWidthClass}
                />
              </Suspense>
            ) : null}
          </div>

          <BookTools
            open={bookToolsOpen}
            onClose={() => setBookToolsOpen(false)}
            projectId={project.id}
            variant={isNote ? 'note' : 'book'}
            workspaceRoute={
              isNote ?
                route === 'note_export' ? 'note_export'
                : route === 'format_print' ? 'format_print'
                : route === 'format_ebook' ? 'format_ebook'
                : 'write'
              : route === 'format_print' ? 'format_print'
              : route === 'format_ebook' ? 'format_ebook'
              : route === 'publish' ? 'publish'
              : 'write'
            }
            onSetWorkspaceRoute={(next) => navigateRoute(next)}
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
                    navigateRoute('write')
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
            backlinks={noteBacklinks}
            onOpenBacklinkSource={(id) => {
              syncPersistedState()
              openProject(id)
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
            onCloudBackupLibrary={
              isCloudBackupConfigured() ? () => void uploadLibraryCloudBackup() : undefined
            }
            cloudBackupBusy={cloudBackupBusy}
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
              onOpenSiblingInPopout={setStickyNotePopoutId}
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
      {isInkwellCloudSyncConfigured() && inkwellLibrarySync.conflict ? (
        <SyncConflictModal
          open
          serverRev={inkwellLibrarySync.conflict.serverRev}
          busy={syncConflictBusy}
          onKeepLocal={() => {
            setSyncConflictBusy(true)
            void inkwellLibrarySync.resolveKeepLocal().finally(() => setSyncConflictBusy(false))
          }}
          onUseCloud={() => {
            setSyncConflictBusy(true)
            void inkwellLibrarySync.resolveUseCloud().finally(() => setSyncConflictBusy(false))
          }}
          onExportBoth={() => {
            setSyncConflictBusy(true)
            void inkwellLibrarySync.exportBothZips().finally(() => setSyncConflictBusy(false))
          }}
        />
      ) : null}
      <GettingStartedTour
        open={gettingStartedTourOpen}
        persistRemindLater={tourPersistRemindLater}
        resumeStepId={tourResumeStepId}
        routeBucket={tourRouteBucket}
        newProjectMenuOpen={newProjectMenuOpen}
        projectKind={project.kind}
        bookCreatedFromTourMenu={tourBookMenuCreate}
        onClearBookCreatedFromTourMenu={() => setTourBookMenuCreate(false)}
        onRequestBookshelf={tourGoBookshelf}
        onRequestWrite={tourGoWrite}
        onRequestFormat={tourGoFormat}
        onRequestPublish={tourGoPublish}
        onStepChange={handleTourStepChange}
        onClose={handleTourClose}
      />
      <NotesTour
        open={notesTourOpen}
        persistRemindLater={notesTourPersistRemindLater}
        resumeStepId={notesTourResumeStepId}
        routeBucket={tourRouteBucket}
        bookToolsOpen={bookToolsOpen}
        newProjectMenuOpen={newProjectMenuOpen}
        projectKind={project.kind}
        noteCreatedFromTourMenu={notesTourNoteFromMenu}
        onClearNoteCreatedFromTourMenu={() => setNotesTourNoteFromMenu(false)}
        onRequestBookshelf={tourGoBookshelf}
        onRequestWrite={tourGoWrite}
        onStepChange={handleNotesTourStepChange}
        onClose={handleNotesTourClose}
      />
    </div>
  )
}
