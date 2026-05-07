type Step = {
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    title: 'Draft',
    body:
      'Create a book, sketch an outline, add chapters as you go. Notes and a series bible live alongside the manuscript so context is always one click away.',
  },
  {
    title: 'Format',
    body:
      'Drafts, revisions, and layout decisions in one place. Preview the interior for print or ebook while you write, so formatting is never a separate project.',
  },
  {
    title: 'Publish',
    body:
      'When the manuscript is ready, export the file you need: EPUB for ebooks, or a full export suite in Pro for print and submissions.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-parchment dark:bg-panel-dark">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">How it works</p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            With you every step of the way.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
            One steady rhythm from blank page to the file you hand off—debut or backlist.
          </p>
        </div>

        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-dust/70 bg-white/60 p-7 dark:border-border-dark dark:bg-panel-dark/60"
            >
              <p className="font-serif text-5xl leading-none text-walnut/30 dark:text-cream/18">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-4 font-serif text-xl leading-snug text-ink dark:text-ink-dark">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-walnut/90 dark:text-ink-dark/80">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
