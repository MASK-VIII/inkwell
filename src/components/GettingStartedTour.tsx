import { useCallback, useEffect, useId, useRef, useState } from 'react'

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Your bookshelf',
    body:
      'Drag books and notes to reorder them. Drag a note onto a book to attach it, or use the trash target to remove something from the shelf. Everything stays on this device until you export.',
  },
  {
    title: 'Write',
    body:
      'Open a project from the shelf to write and edit sections. Use the chapter list to add, reorder, or merge sections — drag a section by its book icon.',
  },
  {
    title: 'Format',
    body:
      'When your manuscript is ready, move to Format to tune print and ebook interiors — typography, margins, and theme presets — before you publish or export.',
  },
  {
    title: 'Publish',
    body:
      'From Publish, export to PDF, EPUB, and other formats. The flow is: write in the editor, refine layout in Format, then ship from Publish.',
  },
]

type Props = {
  open: boolean
  onClose: () => void
}

export function GettingStartedTour({ open, onClose }: Props) {
  const [step, setStep] = useState(0)
  const titleId = useId()
  const bodyId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) setStep(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    window.requestAnimationFrame(() => {
      primaryRef.current?.focus()
    })
  }, [open, step])

  const finish = useCallback(() => {
    onClose()
  }, [onClose])

  const onPrimary = useCallback(() => {
    if (step >= STEPS.length - 1) {
      finish()
      return
    }
    setStep((s) => s + 1)
  }, [finish, step])

  if (!open) return null

  const last = step >= STEPS.length - 1
  const content = STEPS[step]!

  return (
    <>
      <button
        type="button"
        aria-label="Dismiss getting started"
        className="fixed inset-0 z-[200] bg-ink/25 backdrop-blur-[1px] dark:bg-black/45"
        onClick={finish}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="fixed left-1/2 top-[min(8rem,12vh)] z-[201] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-dust bg-white p-5 shadow-2xl dark:border-border-dark dark:bg-panel-dark sm:top-28 sm:p-6"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-walnut/90 dark:text-accent-warm/90">
            Getting started
          </p>
          <button
            type="button"
            onClick={finish}
            className="shrink-0 text-xs font-medium text-ink/60 underline-offset-2 hover:text-ink hover:underline dark:text-ink-dark/60 dark:hover:text-ink-dark"
          >
            Skip
          </button>
        </div>
        <div
          className="mb-4 flex items-center gap-1.5"
          role="group"
          aria-label={`Step ${step + 1} of ${STEPS.length}`}
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-ink dark:bg-cream' : 'bg-dust/70 dark:bg-border-dark/70'
              }`}
            />
          ))}
        </div>
        <h2 id={titleId} className="font-serif text-xl font-semibold leading-snug text-ink dark:text-ink-dark">
          {content.title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-relaxed text-ink/70 dark:text-ink-dark/70">
          {content.body}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-2xl border border-dust px-4 py-2 text-sm font-medium text-ink hover:bg-dust/25 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/40"
            >
              Back
            </button>
          ) : null}
          <button
            ref={primaryRef}
            type="button"
            onClick={onPrimary}
            className="rounded-2xl bg-ink px-4 py-2 text-sm font-semibold text-parchment hover:bg-walnut dark:bg-cream dark:text-ink dark:hover:bg-accent-warm"
          >
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
