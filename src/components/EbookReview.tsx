import DOMPurify from 'dompurify'
import { startTransition, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { EbookTheme, Manuscript } from '../types'
import { ebookCss } from '../lib/ebook/ebookCss'
import { nextWorkerRev, onWorkerMessage, sendWorker } from '../lib/workerClient'

type Props = {
  chapters: Manuscript[]
  theme: { ebook: EbookTheme }
  activeChapterId: number | null
  onPrevChapter?: () => void
  onNextChapter?: () => void
  /** Ebook / Print toggle (centered). */
  formatModeBar?: ReactNode
}

export function EbookReview({
  chapters,
  theme,
  activeChapterId,
  onPrevChapter,
  onNextChapter,
  formatModeBar,
}: Props) {
  const [device, setDevice] = useState<'phone' | 'tablet' | 'ereader'>(() => 'ereader')
  const viewportEl = useRef<HTMLDivElement | null>(null)
  const revRef = useRef(0)
  const debounceRef = useRef<number | null>(null)

  const [css, setCss] = useState(() => ebookCss(theme.ebook))
  const [html, setHtml] = useState<string>('')
  const [status, setStatus] = useState<'idle' | 'rendering' | 'error'>('idle')

  const safeHtml = useMemo(() => {
    if (!html) return ''
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: [
        'p',
        'h1',
        'h2',
        'h3',
        'em',
        'strong',
        'u',
        's',
        'blockquote',
        'ul',
        'ol',
        'li',
        'hr',
        'br',
        'a',
        'img',
        'figure',
        'sup',
        'mark',
        'section',
        'span',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'data-id'],
      ALLOW_UNKNOWN_PROTOCOLS: false,
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
    })
  }, [html])

  const { width, height } = useMemo(() => {
    if (device === 'phone') return { width: 360, height: 740 }
    if (device === 'tablet') return { width: 700, height: 860 }
    return { width: 460, height: 820 } // e-reader
  }, [device])

  const active = useMemo(
    () => (activeChapterId == null ? null : chapters.find((c) => c.id === activeChapterId) ?? null),
    [chapters, activeChapterId],
  )

  useEffect(() => {
    return onWorkerMessage((msg) => {
      if (msg.kind === 'ebookResult') {
        if (msg.rev !== revRef.current) return
        setCss(msg.css)
        setHtml(msg.html)
        setStatus('idle')
        viewportEl.current?.scrollTo({ top: 0 })
      } else if (msg.kind === 'error') {
        if (msg.rev !== revRef.current) return
        if (msg.job === 'renderEbook') setStatus('error')
      }
    })
  }, [])

  useEffect(() => {
    if (!active) {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = null
      return
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    startTransition(() => setStatus('rendering'))
    debounceRef.current = window.setTimeout(() => {
      const rev = nextWorkerRev()
      revRef.current = rev
      sendWorker({
        kind: 'renderEbook',
        rev,
        chapter: { id: active.id, title: active.title, content: active.content },
        ebookTheme: theme.ebook,
      })
    }, 280)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [active, theme.ebook])

  const canPrev = !!active && chapters.findIndex((c) => c.id === active.id) > 0
  const canNext = !!active && chapters.findIndex((c) => c.id === active.id) < chapters.length - 1

  return (
    <div className="inkwell-ebook-review-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overscroll-y-contain">
      <div className="inkwell-theme-bridge sticky top-0 z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-dust bg-white/90 px-4 py-3 backdrop-blur-sm dark:border-border-dark dark:bg-panel-dark/90 sm:px-5">
        <div className="min-w-0" aria-hidden />
        <div className="flex justify-center">{formatModeBar}</div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Device
          </label>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as typeof device)}
            className="rounded-2xl border border-dust bg-parchment px-3 py-2 text-sm font-medium text-ink focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-cream"
          >
            <option value="phone">Phone</option>
            <option value="tablet">Tablet</option>
            <option value="ereader">E-reader</option>
          </select>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center px-4 py-6 pb-20 sm:px-5 sm:py-8 sm:pb-28">
        <div className="flex w-full max-w-[1100px] flex-col items-center gap-6">
          <div style={{ width }}>
            <style>{css}</style>
            <div
              ref={viewportEl}
              className="inkwell-ebook-device-scroll overflow-y-auto overflow-x-hidden rounded-[2rem] border border-dust bg-white shadow-xl dark:border-border-dark dark:bg-panel-dark/40"
              style={{ height }}
            >
              <div className="inkwell-ebook-preview">
                <div className="py-6 px-4">
                  {!active ? (
                    <div className="rounded-3xl border border-dust bg-white/60 p-6 text-sm text-ink/70 dark:border-border-dark dark:bg-panel-dark/60 dark:text-ink-dark/70">
                      Select a chapter to preview.
                    </div>
                  ) : status === 'error' ? (
                    <div className="rounded-3xl border border-dust bg-white/60 p-6 text-sm text-ink/70 dark:border-border-dark dark:bg-panel-dark/60 dark:text-ink-dark/70">
                      Preview failed to render.
                    </div>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full max-w-[min(46rem,100%)] items-center justify-between gap-3">
            <button
              type="button"
              onClick={onPrevChapter}
              disabled={!onPrevChapter || !canPrev}
              className="rounded-3xl border border-dust bg-white/70 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-white disabled:opacity-40 dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
            >
              ‹ Chapter
            </button>
            <div className="text-xs font-semibold uppercase tracking-widest text-walnut/80 dark:text-accent-warm/80">
              {!active ? 'Preview' : status === 'rendering' ? 'Rendering…' : active.title}
            </div>
            <button
              type="button"
              onClick={onNextChapter}
              disabled={!onNextChapter || !canNext}
              className="rounded-3xl border border-dust bg-white/70 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-white disabled:opacity-40 dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
            >
              Chapter ›
            </button>
          </div>

          <div className="max-w-xl text-center text-xs text-ink/60 dark:text-ink-dark/60">
            This is a reflow preview. Real EPUB readers may differ in fonts and pagination.
          </div>
        </div>
      </div>
    </div>
  )
}

