import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ChevronRight, Library, Loader2, NotebookPen } from 'lucide-react'
import type { ProjectKind } from '../types'

import {
  indexOfNotesTourStep,
  NOTES_TUTORIAL_STEPS,
  parseNotesTourResumeStepId,
  type NotesTourStep,
  type NotesTourStepId,
} from '../lib/notesTutorialSteps'
import { saveNotesTutorialResumeStep } from '../lib/bootstrapState'

import type { TourRouteBucket } from './GettingStartedTour'

type HoleRect = { top: number; left: number; width: number; height: number }

type Props = {
  open: boolean
  persistRemindLater: boolean
  resumeStepId: string | null
  routeBucket: TourRouteBucket
  bookToolsOpen: boolean
  newProjectMenuOpen: boolean
  projectKind: ProjectKind
  /** True after New → Note or Start Writing during the choose-note step (App sets one-shot). */
  noteCreatedFromTourMenu: boolean
  onClearNoteCreatedFromTourMenu: () => void
  onRequestBookshelf: () => void
  onRequestWrite: () => void
  onStepChange: (id: NotesTourStepId | null) => void
  /** `complete` marks the notes tutorial finished; `remind` only closes (resume may persist). */
  onClose: (reason: 'complete' | 'remind') => void
}

function queryTourTarget(selector: string): HTMLElement | null {
  return document.querySelector(`[data-inkwell-tour="${selector}"]`)
}

function measureHole(el: HTMLElement | null): HoleRect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  const pad = 8
  if (r.width < 2 && r.height < 2) return null
  return {
    top: Math.max(0, r.top - pad),
    left: Math.max(0, r.left - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  }
}

/** Bounding box of several elements (e.g. header control + BookTools drawer) so the dimmer cut-out covers the whole UI. */
function measureUnionHole(els: HTMLElement[]): HoleRect | null {
  const pad = 8
  let minT = Infinity
  let minL = Infinity
  let maxR = -Infinity
  let maxB = -Infinity
  let any = false
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width < 2 && r.height < 2) continue
    any = true
    minT = Math.min(minT, r.top)
    minL = Math.min(minL, r.left)
    maxR = Math.max(maxR, r.right)
    maxB = Math.max(maxB, r.bottom)
  }
  if (!any) return null
  return {
    top: Math.max(0, minT - pad),
    left: Math.max(0, minL - pad),
    width: maxR - minL + pad * 2,
    height: maxB - minT + pad * 2,
  }
}

function notesTourBookToolsUnionSteps(step: NotesTourStep): boolean {
  return step.id === 'notes-write-tools' || step.id === 'notes-write-linked-panel'
}

function resolveNotesTourTargetEl(step: NotesTourStep): HTMLElement | null {
  if (step.id === 'notes-shelf-create-note') {
    return queryTourTarget('shelf-menu-note') ?? queryTourTarget('shelf-new')
  }
  return queryTourTarget(step.target)
}

function cardIntersectsHole(
  cardTop: number,
  cardLeft: number,
  cw: number,
  ch: number,
  h: HoleRect,
): boolean {
  return !(
    cardLeft + cw <= h.left ||
    cardLeft >= h.left + h.width ||
    cardTop + ch <= h.top ||
    cardTop >= h.top + h.height
  )
}

function clampCardPos(
  top: number,
  left: number,
  cw: number,
  ch: number,
  vw: number,
  vh: number,
  margin: number,
): { top: number; left: number } {
  return {
    top: Math.max(margin, Math.min(top, vh - ch - margin)),
    left: Math.max(margin, Math.min(left, vw - cw - margin)),
  }
}

/** Prefer a card position that does not cover the spotlight hole (dialog is above dimmers in z-order). */
function pickCardPosClearOfHole(h: HoleRect, cw: number, ch: number, vw: number, vh: number, margin: number): {
  top: number
  left: number
} {
  let left = h.left + h.width + 16
  if (left + cw + margin > vw) {
    left = h.left - cw - 16
  }
  if (left < margin) {
    left = Math.max(margin, (vw - cw) / 2)
  }
  let top = h.top
  if (top + ch + margin > vh) {
    top = Math.max(margin, vh - ch - margin)
  }
  if (top < margin) top = margin

  const initial = clampCardPos(top, left, cw, ch, vw, vh, margin)
  const candidates: Array<{ top: number; left: number }> = [
    initial,
    clampCardPos(h.top + h.height + margin, h.left, cw, ch, vw, vh, margin),
    clampCardPos(h.top - ch - margin, h.left, cw, ch, vw, vh, margin),
    clampCardPos(h.top, h.left - cw - margin, cw, ch, vw, vh, margin),
    clampCardPos(h.top, h.left + h.width + margin, cw, ch, vw, vh, margin),
    clampCardPos(vh - ch - margin, (vw - cw) / 2, cw, ch, vw, vh, margin),
    clampCardPos(margin, (vw - cw) / 2, cw, ch, vw, vh, margin),
  ]

  for (const p of candidates) {
    if (!cardIntersectsHole(p.top, p.left, cw, ch, h)) return p
  }
  return initial
}

function stepRouteOk(step: NotesTourStep, bucket: TourRouteBucket): boolean {
  if (step.route === 'bookshelf') return bucket === 'bookshelf'
  if (step.route === 'write') return bucket === 'write'
  if (step.route === 'format') return bucket === 'format'
  if (step.route === 'publish') return bucket === 'publish'
  return false
}

export function NotesTour({
  open,
  persistRemindLater,
  resumeStepId,
  routeBucket,
  bookToolsOpen,
  newProjectMenuOpen,
  projectKind,
  noteCreatedFromTourMenu,
  onClearNoteCreatedFromTourMenu,
  onRequestBookshelf,
  onRequestWrite,
  onStepChange,
  onClose,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const [hole, setHole] = useState<HoleRect | null>(null)
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  /** True when the create-note step is highlighting New because the menu row is not mounted yet. */
  const [spotlightNewForNoteStep, setSpotlightNewForNoteStep] = useState(false)
  const titleId = useId()
  const bodyId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const resumeAppliedRef = useRef(false)

  const step = NOTES_TUTORIAL_STEPS[stepIndex] ?? NOTES_TUTORIAL_STEPS[0]!
  const last = stepIndex >= NOTES_TUTORIAL_STEPS.length - 1
  const routeMismatch = !stepRouteOk(step, routeBucket)

  const updateLayout = useCallback(() => {
    const el = resolveNotesTourTargetEl(step)
    const menuNoteRow = queryTourTarget('shelf-menu-note')
    if (step.id === 'notes-shelf-create-note') {
      setSpotlightNewForNoteStep(!menuNoteRow)
    } else {
      setSpotlightNewForNoteStep(false)
    }

    const drawer = queryTourTarget('book-tools-drawer')
    const headerTools = queryTourTarget('header-book-tools')
    const scrollEl =
      notesTourBookToolsUnionSteps(step) && bookToolsOpen && drawer ? drawer
      : el

    if (scrollEl) {
      try {
        scrollEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' as ScrollBehavior })
      } catch {
        scrollEl.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
    window.requestAnimationFrame(() => {
      let h: HoleRect | null = null
      if (notesTourBookToolsUnionSteps(step) && bookToolsOpen) {
        const unionEls = [headerTools, drawer].filter((n): n is HTMLElement => n != null)
        h = measureUnionHole(unionEls)
      }
      if (!h) {
        h = measureHole(el)
      }
      setHole(h)
      const cardEl = cardRef.current
      const vw = window.innerWidth
      const vh = window.innerHeight
      const cw = Math.min(cardEl?.offsetWidth ?? 360, vw - 24)
      const ch = cardEl?.offsetHeight ?? 200
      if (!h) {
        setCardPos({ top: Math.min(96, vh * 0.08), left: Math.max(12, (vw - cw) / 2) })
        return
      }
      const margin = 12
      const pos = pickCardPosClearOfHole(h, cw, ch, vw, vh, margin)
      setCardPos(pos)
    })
  }, [step, bookToolsOpen])

  useEffect(() => {
    onStepChange(step.id)
    return () => {
      onStepChange(null)
    }
  }, [step.id, onStepChange])

  useEffect(() => {
    if (open) return
    resumeAppliedRef.current = false
    /* eslint-disable react-hooks/set-state-in-effect -- reset tour chrome when overlay closes */
    setStepIndex(0)
    setHole(null)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open])

  useEffect(() => {
    if (!open) return
    if (resumeAppliedRef.current) return
    resumeAppliedRef.current = true
    const rid = parseNotesTourResumeStepId(resumeStepId ?? undefined)
    if (rid != null) {
      const i = indexOfNotesTourStep(rid)
      if (i >= 0) {
        /* eslint-disable react-hooks/set-state-in-effect -- apply saved resume step once per open */
        setStepIndex(i)
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } else {
      setStepIndex(0)
    }
  }, [open, resumeStepId])

  useLayoutEffect(() => {
    if (!open) return
    queueMicrotask(() => updateLayout())
  }, [open, stepIndex, step.target, routeBucket, bookToolsOpen, newProjectMenuOpen, updateLayout])

  useEffect(() => {
    if (!open) return
    const ro = new ResizeObserver(() => updateLayout())
    ro.observe(document.documentElement)
    const onScroll = () => updateLayout()
    const onResize = () => updateLayout()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    const t = window.setTimeout(updateLayout, 280)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      window.clearTimeout(t)
    }
  }, [open, updateLayout])

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(NOTES_TUTORIAL_STEPS.length - 1, i + 1))
  }, [])

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  useEffect(() => {
    if (!open) return
    if (step.id === 'notes-shelf-new' && newProjectMenuOpen) {
      queueMicrotask(() => {
        goNext()
      })
    }
  }, [open, step.id, newProjectMenuOpen, goNext])

  useEffect(() => {
    if (!open) return
    if (step.id !== 'notes-shelf-create-note') return
    if (routeBucket === 'write' && projectKind === 'note' && noteCreatedFromTourMenu) {
      onClearNoteCreatedFromTourMenu()
      queueMicrotask(() => {
        goNext()
      })
    }
  }, [open, step.id, routeBucket, projectKind, noteCreatedFromTourMenu, onClearNoteCreatedFromTourMenu, goNext])

  const finishComplete = useCallback(() => {
    onClose('complete')
  }, [onClose])

  const remindLater = useCallback(() => {
    if (persistRemindLater) {
      saveNotesTutorialResumeStep(step.id)
    }
    onClose('remind')
  }, [persistRemindLater, step.id, onClose])

  const skipForever = useCallback(() => {
    onClose('complete')
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        remindLater()
        return
      }
      if (e.key === 'ArrowLeft' && stepIndex > 0) {
        e.preventDefault()
        goPrev()
        return
      }
      if (e.key === 'ArrowRight' && !routeMismatch && !last && step.kind !== 'action') {
        e.preventDefault()
        goNext()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, remindLater, stepIndex, last, routeMismatch, step.kind, goPrev, goNext])

  useEffect(() => {
    if (!open) return
    window.requestAnimationFrame(() => {
      primaryRef.current?.focus()
    })
  }, [open, stepIndex])

  const onPrimary = useCallback(() => {
    if (last) {
      finishComplete()
      return
    }
    goNext()
  }, [last, finishComplete, goNext])

  if (!open) return null

  const padT = hole ? hole.top : 0
  const padL = hole ? hole.left : 0

  const nudge = (s: NotesTourStep): ReactNode => {
    if (s.route === 'bookshelf' && routeBucket !== 'bookshelf') {
      return (
        <button
          type="button"
          onClick={onRequestBookshelf}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-walnut/25 bg-parchment/50 px-3 py-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-walnut/45 hover:bg-parchment/90 dark:border-accent-warm/30 dark:bg-panel-dark/60 dark:text-ink-dark dark:hover:border-accent-warm/50 dark:hover:bg-panel-dark/90"
        >
          <Library className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2.25} aria-hidden />
          Go to Bookshelf
        </button>
      )
    }
    if (s.route === 'write' && s.kind === 'info' && routeBucket !== 'write') {
      return (
        <button
          type="button"
          onClick={onRequestWrite}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-walnut/25 bg-parchment/50 px-3 py-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-walnut/45 hover:bg-parchment/90 dark:border-accent-warm/30 dark:bg-panel-dark/60 dark:text-ink-dark dark:hover:border-accent-warm/50 dark:hover:bg-panel-dark/90"
        >
          Go to Write
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2.25} aria-hidden />
        </button>
      )
    }
    return null
  }

  const dimPanel =
    'pointer-events-auto bg-gradient-to-br from-ink/[0.26] via-ink/[0.22] to-ink/[0.28] backdrop-blur-[3px] dark:from-black/55 dark:via-black/48 dark:to-black/58'

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]">
      {hole ?
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className={`absolute left-0 right-0 ${dimPanel}`}
            style={{ top: 0, height: padT }}
            onClick={remindLater}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className={`absolute ${dimPanel}`}
            style={{ top: padT, left: 0, width: padL, height: hole.height }}
            onClick={remindLater}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className={`absolute ${dimPanel}`}
            style={{ top: padT, left: hole.left + hole.width, right: 0, height: hole.height }}
            onClick={remindLater}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className={`absolute bottom-0 left-0 right-0 ${dimPanel}`}
            style={{ top: padT + hole.height }}
            onClick={remindLater}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute z-[1] rounded-xl border-2 border-cream/85 shadow-[0_0_0_1px_rgba(44,36,31,0.12),0_0_36px_rgba(217,164,65,0.22),inset_0_0_20px_rgba(248,241,227,0.06)] dark:border-accent-warm/90 dark:shadow-[0_0_0_1px_rgba(247,231,194,0.08),0_0_42px_rgba(217,164,65,0.28)]"
            style={{ top: padT, left: padL, width: hole.width, height: hole.height }}
          />
        </>
      : (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className={`pointer-events-auto absolute inset-0 ${dimPanel}`}
          onClick={remindLater}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="pointer-events-auto fixed z-[201] w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-dust/90 bg-white p-5 shadow-[0_24px_48px_-12px_rgba(44,36,31,0.28),0_0_0_1px_rgba(44,36,31,0.04)] ring-1 ring-ink/[0.04] transition-[box-shadow,transform] duration-200 ease-out dark:border-border-dark dark:bg-panel-dark dark:shadow-[0_28px_56px_-16px_rgba(0,0,0,0.65),0_0_0_1px_rgba(247,231,194,0.06)] dark:ring-cream/10 sm:p-6"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cream/80 to-transparent dark:via-accent-warm/70"
          aria-hidden
        />
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-walnut/12 via-parchment to-dust/35 text-walnut shadow-inner shadow-white/30 ring-1 ring-walnut/20 dark:from-accent-warm/15 dark:via-panel-dark dark:to-border-dark dark:text-accent-warm dark:shadow-none dark:ring-accent-warm/25"
              aria-hidden
            >
              <NotebookPen className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-walnut/95 dark:text-accent-warm/95">
                Notes and Projects
              </p>
              <p className="mt-0.5 text-xs text-ink/45 dark:text-ink-dark/45">
                Step {stepIndex + 1} of {NOTES_TUTORIAL_STEPS.length}
                <span className="text-ink/30 dark:text-ink-dark/35" aria-hidden>
                  {' · '}
                </span>
                <span className="text-ink/50 dark:text-ink-dark/50">
                  {stepIndex < 3 ? 'Shelf' : 'Write'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={remindLater}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-ink/55 transition-colors hover:bg-dust/30 hover:text-ink dark:text-ink-dark/55 dark:hover:bg-border-dark/50 dark:hover:text-ink-dark"
            >
              Later
            </button>
            <span className="text-ink/25 dark:text-ink-dark/25" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={skipForever}
              title="Mark as done; reopen anytime from Help on the bookshelf"
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-ink/55 transition-colors hover:bg-dust/30 hover:text-ink dark:text-ink-dark/55 dark:hover:bg-border-dark/50 dark:hover:text-ink-dark"
            >
              Skip
            </button>
          </div>
        </div>
        <div
          className="mb-5 flex gap-1 rounded-full bg-dust/20 p-1 dark:bg-border-dark/55"
          role="group"
          aria-label="Progress"
        >
          {NOTES_TUTORIAL_STEPS.map((_, i) => (
            <span
              key={_.id}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ease-out ${
                i === stepIndex ?
                  'bg-walnut shadow-sm dark:bg-cream'
                : i < stepIndex ?
                  'bg-ink/30 dark:bg-cream/45'
                : 'bg-dust/55 dark:bg-border-dark'
              }`}
            />
          ))}
        </div>
        <h2
          id={titleId}
          className="font-serif text-[1.35rem] font-semibold leading-snug tracking-tight text-ink dark:text-ink-dark"
        >
          {step.title}
        </h2>
        <p
          id={bodyId}
          className="mt-2.5 whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink/72 dark:text-ink-dark/72"
        >
          {step.body}
        </p>
        {step.hint || (step.id === 'notes-shelf-create-note' && spotlightNewForNoteStep) ?
          <p className="mt-3 rounded-xl border border-dust/50 bg-gradient-to-br from-parchment/80 to-dust/15 px-3 py-2.5 text-xs leading-snug text-ink/65 dark:border-border-dark dark:from-panel-dark/80 dark:to-border-dark/40 dark:text-ink-dark/65">
            {step.id === 'notes-shelf-create-note' && spotlightNewForNoteStep ?
              <>
                Open <span className="font-medium text-ink/80 dark:text-ink-dark/80">New</span>, then choose{' '}
                <span className="font-medium text-ink/80 dark:text-ink-dark/80">Note</span>. The menu opens when you
                reach this step—tap New if it is closed.
                {step.hint ?
                  <>
                    {' '}
                    {step.hint}
                  </>
                : null}
              </>
            : step.hint}
          </p>
        : null}
        <div className="mt-2">{nudge(step)}</div>
        {last ?
          <p className="mt-4 text-center text-[11px] leading-snug text-ink/48 dark:text-ink-dark/48">
            Open this guide again from <span className="font-medium text-ink/60 dark:text-ink-dark/60">Help</span> on the
            bookshelf.
          </p>
        : null}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-dust/40 pt-5 dark:border-border-dark/60">
          {stepIndex > 0 ?
            <button
              type="button"
              onClick={goPrev}
              className="rounded-2xl border border-dust/90 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-dust/30 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/45"
            >
              Back
            </button>
          : null}
          {step.kind === 'info' && !routeMismatch ?
            <button
              ref={primaryRef}
              type="button"
              onClick={onPrimary}
              title={last ? undefined : 'Right arrow also advances'}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-ink px-4 py-2 text-sm font-semibold text-parchment shadow-md shadow-ink/15 transition-[background-color,box-shadow] hover:bg-walnut hover:shadow-lg dark:bg-cream dark:text-ink dark:shadow-black/30 dark:hover:bg-accent-warm"
            >
              {last ? 'Done' : 'Next'}
              {!last ?
                <ChevronRight className="h-4 w-4 opacity-90" aria-hidden strokeWidth={2.25} />
              : null}
            </button>
          : null}
          {step.kind === 'action' ?
            <p className="flex w-full items-center justify-end gap-2 text-right text-xs font-medium text-ink/60 dark:text-ink-dark/60 sm:w-auto sm:flex-1 sm:justify-start sm:text-left">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-walnut/80 dark:text-accent-warm/90" aria-hidden />
              <span>
                {step.id === 'notes-shelf-new' ? 'Waiting for the New menu…' : null}
                {step.id === 'notes-shelf-create-note' ? 'Choose Note or Start Writing…' : null}
              </span>
            </p>
          : null}
        </div>
      </div>
    </div>
  )
}
