import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight, Loader2, Sparkles } from 'lucide-react'
import type { ProjectKind } from '../types'
import {
  indexOfStep,
  parseResumeStepId,
  TUTORIAL_STEPS,
  type TourStep,
  type TourStepId,
} from '../lib/tutorialSteps'
import { saveTutorialResumeStep } from '../lib/bootstrapState'

export type TourRouteBucket = 'bookshelf' | 'write' | 'format' | 'publish' | 'other'

type HoleRect = { top: number; left: number; width: number; height: number }

type Props = {
  open: boolean
  /** When true, Esc / Remind later persist `tutorialStepId` in bootstrap. False for help-button replay after the tour is already complete. */
  persistRemindLater: boolean
  resumeStepId: string | null
  routeBucket: TourRouteBucket
  newProjectMenuOpen: boolean
  projectKind: ProjectKind
  /** True after Book was chosen from the shelf New menu while the pick-book step is active (App sets this one-shot). */
  bookCreatedFromTourMenu: boolean
  onClearBookCreatedFromTourMenu: () => void
  onRequestBookshelf: () => void
  onRequestWrite: () => void
  onRequestFormat: () => void
  onRequestPublish: () => void
  onStepChange: (id: TourStepId | null) => void
  /** `complete` marks the tutorial finished in bootstrap; `remind` only closes the overlay. */
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

function stepRouteOk(step: TourStep, bucket: TourRouteBucket): boolean {
  if (step.route === 'bookshelf') return bucket === 'bookshelf'
  if (step.route === 'write') return bucket === 'write'
  if (step.route === 'format') return bucket === 'format'
  if (step.route === 'publish') return bucket === 'publish'
  return false
}

export function GettingStartedTour({
  open,
  persistRemindLater,
  resumeStepId,
  routeBucket,
  newProjectMenuOpen,
  projectKind,
  bookCreatedFromTourMenu,
  onClearBookCreatedFromTourMenu,
  onRequestBookshelf,
  onRequestWrite,
  onRequestFormat,
  onRequestPublish,
  onStepChange,
  onClose,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const [hole, setHole] = useState<HoleRect | null>(null)
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const titleId = useId()
  const bodyId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const resumeAppliedRef = useRef(false)

  const step = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0]!
  const last = stepIndex >= TUTORIAL_STEPS.length - 1

  const updateLayout = useCallback(() => {
    const el = queryTourTarget(step.target)
    if (el) {
      try {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' as ScrollBehavior })
      } catch {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
    window.requestAnimationFrame(() => {
      const h = measureHole(el)
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
      setCardPos({ top, left })
    })
  }, [step.target])

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
    const rid = parseResumeStepId(resumeStepId ?? undefined)
    if (rid != null) {
      const i = indexOfStep(rid)
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
    updateLayout()
  }, [open, stepIndex, step.target, routeBucket, newProjectMenuOpen, updateLayout])

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
    setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1))
  }, [])

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const finishComplete = useCallback(() => {
    onClose('complete')
  }, [onClose])

  const remindLater = useCallback(() => {
    if (persistRemindLater) {
      saveTutorialResumeStep(step.id)
    }
    onClose('remind')
  }, [persistRemindLater, step.id, onClose])

  const skipForever = useCallback(() => {
    onClose('complete')
  }, [onClose])

  useEffect(() => {
    if (!open) return
    if (step.id === 'shelf-open-new' && newProjectMenuOpen) {
      queueMicrotask(() => {
        goNext()
      })
    }
  }, [open, step.id, newProjectMenuOpen, goNext])

  useEffect(() => {
    if (!open) return
    if (step.id !== 'shelf-pick-book') return
    if (routeBucket === 'write' && projectKind === 'book' && bookCreatedFromTourMenu) {
      onClearBookCreatedFromTourMenu()
      queueMicrotask(() => {
        goNext()
      })
    }
  }, [
    open,
    step.id,
    routeBucket,
    projectKind,
    bookCreatedFromTourMenu,
    onClearBookCreatedFromTourMenu,
    goNext,
  ])

  useEffect(() => {
    if (!open) return
    if (step.id === 'workspace-format' && routeBucket === 'format') {
      queueMicrotask(() => {
        goNext()
      })
    }
  }, [open, step.id, routeBucket, goNext])

  useEffect(() => {
    if (!open) return
    if (step.id === 'workspace-publish' && routeBucket === 'publish') {
      queueMicrotask(() => {
        finishComplete()
      })
    }
  }, [open, step.id, routeBucket, finishComplete])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        remindLater()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, remindLater])

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

  const routeMismatch = !stepRouteOk(step, routeBucket)

  if (!open) return null

  const padT = hole ? hole.top : 0
  const padL = hole ? hole.left : 0

  const nudge = (s: TourStep): React.ReactNode => {
    if (s.route === 'bookshelf' && routeBucket !== 'bookshelf') {
      return (
        <button
          type="button"
          onClick={onRequestBookshelf}
          className="mt-3 w-full rounded-2xl border border-dust/90 px-3 py-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-dust/35 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/50"
        >
          Go to Bookshelf
        </button>
      )
    }
    if (s.route === 'write' && s.kind === 'info' && routeBucket !== 'write') {
      return (
        <button
          type="button"
          onClick={onRequestWrite}
          className="mt-3 w-full rounded-2xl border border-dust/90 px-3 py-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-dust/35 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/50"
        >
          Go to Write
        </button>
      )
    }
    if (s.id === 'workspace-format' && routeBucket === 'write') {
      return (
        <button
          type="button"
          onClick={onRequestFormat}
          className="mt-3 w-full rounded-2xl border border-dust/90 px-3 py-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-dust/35 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/50"
        >
          Open Format
        </button>
      )
    }
    if (s.id === 'workspace-publish' && routeBucket === 'format') {
      return (
        <button
          type="button"
          onClick={onRequestPublish}
          className="mt-3 w-full rounded-2xl border border-dust/90 px-3 py-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-dust/35 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/50"
        >
          Open Publish
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
        className="pointer-events-auto fixed z-[201] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-dust/90 bg-panel-light-strong p-5 shadow-[0_24px_48px_-12px_rgba(44,36,31,0.28),0_0_0_1px_rgba(44,36,31,0.04)] ring-1 ring-ink/[0.04] dark:border-border-dark dark:bg-panel-dark dark:shadow-[0_28px_56px_-16px_rgba(0,0,0,0.65),0_0_0_1px_rgba(247,231,194,0.06)] dark:ring-cream/10 sm:p-6"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cream/80 to-transparent dark:via-accent-warm/70"
          aria-hidden
        />
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-parchment to-dust/40 text-walnut shadow-inner shadow-white/40 ring-1 ring-dust/60 dark:from-panel-dark dark:to-border-dark dark:text-accent-warm dark:shadow-none dark:ring-border-dark"
              aria-hidden
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-walnut/95 dark:text-accent-warm/95">
                Getting Started
              </p>
              <p className="mt-0.5 text-xs text-ink/45 dark:text-ink-dark/45">
                Step {stepIndex + 1} of {TUTORIAL_STEPS.length}
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
          {TUTORIAL_STEPS.map((_, i) => (
            <span
              key={i}
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
        <p id={bodyId} className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink/72 dark:text-ink-dark/72">
          {step.body}
        </p>
        {step.hint ?
          <p className="mt-3 rounded-xl border border-dust/50 bg-parchment/40 px-3 py-2 text-xs leading-snug text-ink/58 dark:border-border-dark dark:bg-border-dark/35 dark:text-ink-dark/58">
            {step.hint}
          </p>
        : null}
        <div className="mt-2">{nudge(step)}</div>
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
                {step.id === 'shelf-open-new' ? 'Waiting for the New menu…' : null}
                {step.id === 'shelf-pick-book' ? 'Choose Book from the menu…' : null}
                {step.id === 'workspace-format' ? 'Open Format when you are ready…' : null}
                {step.id === 'workspace-publish' ? 'Opening Publish completes this tour.' : null}
              </span>
            </p>
          : null}
        </div>
      </div>
    </div>
  )
}
