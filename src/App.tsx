import {
  BookOpen,
  Download,
  GripVertical,
  Library,
  Moon,
  Plus,
  Sun,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { BookTools } from './components/BookTools'
import { ManuscriptEditor } from './components/ManuscriptEditor'
import {
  defaultDoc,
  loadProject,
  nextManuscriptId,
  saveProject,
  totalWordsInChapters,
} from './lib/manuscripts'
import type { BookMeta, InkwellProject, Manuscript, WritingGoals } from './types'
import type { Editor, JSONContent } from '@tiptap/core'

const THEME_KEY = 'inkwell-theme'

type DeletedSnapshot = Manuscript & { originalIndex: number }

function loadInitialAppState(): { project: InkwellProject; currentId: number | null } {
  const project = loadProject()
  return {
    project,
    currentId: project.chapters[0]?.id ?? null,
  }
}

function readInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(THEME_KEY)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return stored === 'dark' || (!stored && prefersDark)
}

function slugDownload(name: string) {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'manuscript'
}

export default function App() {
  const initial = loadInitialAppState()
  const [project, setProject] = useState<InkwellProject>(() => initial.project)
  const [currentId, setCurrentId] = useState<number | null>(() => initial.currentId)
  const [bookToolsOpen, setBookToolsOpen] = useState(false)
  const [toast, setToast] = useState<{ node: ReactNode; ms: number } | null>(null)
  const [darkMode, setDarkMode] = useState(readInitialDarkMode)
  const lastDeletedRef = useRef<DeletedSnapshot | null>(null)

  const editorRef = useRef<Editor | null>(null)

  const chapters = project.chapters
  const current = chapters.find((m) => m.id === currentId) ?? null
  const totalBookWords = totalWordsInChapters(chapters)
  const wordsWrittenToday = Math.max(0, totalBookWords - project.goals.dailyBaselineWordCount)

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const persistProject = useCallback((next: InkwellProject) => {
    setProject(saveProject(next))
  }, [])

  const patchBook = useCallback((patch: Partial<BookMeta>) => {
    setProject((prev) => saveProject({ ...prev, book: { ...prev.book, ...patch } }))
  }, [])

  const patchGoals = useCallback((patch: Partial<WritingGoals>) => {
    setProject((prev) => saveProject({ ...prev, goals: { ...prev.goals, ...patch } }))
  }, [])

  const showToast = useCallback((node: ReactNode, ms = 3200) => {
    setToast({ node, ms })
    window.setTimeout(() => setToast(null), ms)
  }, [])

  const updateCurrentContent = useCallback(
    (json: JSONContent) => {
      if (currentId === null) return
      setProject((prev) => {
        const nextChapters = prev.chapters.map((m) =>
          m.id === currentId ? { ...m, content: json } : m,
        )
        return saveProject({ ...prev, chapters: nextChapters })
      })
    },
    [currentId],
  )

  const updateCurrentTitle = useCallback(
    (title: string) => {
      if (currentId === null) return
      setProject((prev) => {
        const nextChapters = prev.chapters.map((m) =>
          m.id === currentId ? { ...m, title } : m,
        )
        return saveProject({ ...prev, chapters: nextChapters })
      })
    },
    [currentId],
  )

  const undoDelete = useCallback(() => {
    const snap = lastDeletedRef.current
    if (!snap) return
    const { originalIndex, ...rest } = snap
    lastDeletedRef.current = null
    setProject((prev) => {
      const copy = [...prev.chapters]
      const idx = Math.min(originalIndex, copy.length)
      copy.splice(idx, 0, rest)
      return saveProject({ ...prev, chapters: copy })
    })
    setCurrentId(rest.id)
    showToast('Chapter restored')
  }, [showToast])

  const createManuscript = () => {
    let newId = 0
    setProject((prev) => {
      newId = nextManuscriptId(prev.chapters)
      const next: Manuscript = {
        id: newId,
        title: `Untitled Chapter ${newId}`,
        content: defaultDoc('Begin writing here…'),
      }
      return saveProject({ ...prev, chapters: [next, ...prev.chapters] })
    })
    setCurrentId(newId)
    showToast('New chapter created')
  }

  const deleteManuscript = (id: number) => {
    const index = chapters.findIndex((m) => m.id === id)
    if (index === -1) return
    const removed = chapters[index]
    lastDeletedRef.current = { ...removed, originalIndex: index }
    const nextChapters = chapters.filter((m) => m.id !== id)
    persistProject({ ...project, chapters: nextChapters })
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

  const onReorder = (draggedId: number, targetId: number) => {
    if (draggedId === targetId) return
    const draggedIndex = chapters.findIndex((m) => m.id === draggedId)
    const targetIndex = chapters.findIndex((m) => m.id === targetId)
    if (draggedIndex === -1 || targetIndex === -1) return
    const copy = [...chapters]
    const [row] = copy.splice(draggedIndex, 1)
    copy.splice(targetIndex, 0, row)
    persistProject({ ...project, chapters: copy })
    showToast('Chapters reordered')
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-parchment text-ink transition-colors dark:bg-panel-dark dark:text-ink-dark">
      <header className="sticky top-0 z-50 border-b border-dust bg-white/90 backdrop-blur-md dark:border-border-dark dark:bg-panel-dark/90">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-ink text-lg text-parchment dark:bg-cream dark:text-ink sm:text-xl">
              🪶
            </div>
            <h1 className="hidden font-serif text-xl font-semibold tracking-tight sm:block sm:text-2xl">
              Inkwell
            </h1>
          </div>

          <div className="min-w-0 flex-1 px-1 sm:px-4">
            <input
              type="text"
              value={current?.title ?? ''}
              disabled={!current}
              onChange={(e) => updateCurrentTitle(e.target.value)}
              placeholder="Chapter title"
              className="w-full min-w-0 rounded-2xl border border-transparent bg-transparent px-3 py-2 text-base font-medium focus:border-walnut focus:outline-none dark:focus:border-cream sm:px-4 sm:text-lg"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setBookToolsOpen(true)}
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
            <button
              type="button"
              onClick={exportHtml}
              disabled={!current}
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
                onSelect={() => setCurrentId(ms.id)}
                onDelete={() => deleteManuscript(ms.id)}
                onDropReorder={onReorder}
              />
            ))}
          </div>
          <p className="mt-auto border-t border-dust pt-3 text-[11px] leading-snug opacity-60 dark:border-border-dark">
            Drag handle to reorder
          </p>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-parchment/40 dark:bg-panel-dark/40">
          {current ? (
            <ManuscriptEditor
              key={current.id}
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
        book={project.book}
        onBookChange={patchBook}
        goals={project.goals}
        onGoalsChange={patchGoals}
        totalBookWords={totalBookWords}
        wordsWrittenToday={wordsWrittenToday}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-8 right-8 z-[9999] flex max-w-sm items-center gap-3 rounded-3xl bg-ink px-6 py-4 text-sm font-medium text-parchment shadow-2xl dark:bg-cream dark:text-ink"
        >
          {toast.node}
        </div>
      )}
    </div>
  )
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type RowProps = {
  manuscript: Manuscript
  active: boolean
  onSelect: () => void
  onDelete: () => void
  onDropReorder: (draggedId: number, targetId: number) => void
}

function ManuscriptRow({
  manuscript,
  active,
  onSelect,
  onDelete,
  onDropReorder,
}: RowProps) {
  const [dragOver, setDragOver] = useState(false)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      className={`flex items-center gap-2 rounded-3xl px-3 py-3 transition-colors sm:gap-3 sm:px-4 sm:py-4 ${
        active
          ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
          : 'hover:bg-dust/30 dark:hover:bg-border-dark/50'
      } ${dragOver && !active ? 'bg-dust text-ink dark:bg-border-dark dark:text-ink-dark' : ''} ${dragging ? 'opacity-40 scale-[0.98]' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const id = Number(e.dataTransfer.getData('text/plain'))
        if (!Number.isFinite(id)) return
        onDropReorder(id, manuscript.id)
      }}
    >
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(manuscript.id))
          e.dataTransfer.effectAllowed = 'move'
          setDragging(true)
        }}
        onDragEnd={() => setDragging(false)}
        className={`cursor-grab touch-none text-walnut active:cursor-grabbing dark:text-accent-warm ${active ? 'text-parchment/80 dark:text-ink/70' : ''}`}
        aria-label="Reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <BookOpen className="h-4 w-4 shrink-0 opacity-80" />
        <span className="truncate font-medium">{manuscript.title}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl transition-colors ${
          active
            ? 'text-parchment/70 hover:bg-white/10 dark:text-ink/60 dark:hover:bg-black/10'
            : 'text-walnut hover:bg-white/40 hover:text-red-600 dark:text-accent-warm dark:hover:bg-black/20 dark:hover:text-red-400'
        }`}
        aria-label="Delete chapter"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
