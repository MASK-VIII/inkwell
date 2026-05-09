type Feature = {
  title: string
  body: string
}

const FEATURES: Feature[] = [
  {
    title: 'Structure that grows with the book',
    body:
      'Organize by title, chapter, and scene—add depth when you need it, not before.',
  },
  {
    title: 'Reorder by dragging',
    body:
      'Move chapters and notes on the shelf when the outline shifts—fewer loose files and side documents.',
  },
  {
    title: 'Made for long sessions',
    body:
      'Clear type and a quiet page. Switch light or dark when the room—or your eyes—changes.',
  },
  {
    title: 'Notes tied to the book',
    body:
      'Scratch pads, linked notes, and a series bible next to your chapters—catch continuity without jumping elsewhere.',
  },
  {
    title: 'Draft, format, publish\u2014in one app',
    body:
      'Preview print and ebook layouts while you write. Basic unlocks EPUB export; Pro adds PDF, DOCX, Markdown, and plain text—everything downloads to your machine.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="border-y border-dust/60 bg-white/50 dark:border-border-dark/80 dark:bg-panel-dark/40">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">Features</p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            For the first-time author and the pro.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
            Whether you are drafting your first manuscript or your next indie release, Inkwell keeps the same draft—format—publish rhythm through the months when ideas become books—whether you are hobby writing or self-publishing. Try it locally on the Free tier with no sign-up—everything below works without an account until you choose paid exports or cloud backup (see pricing for what Basic vs Pro unlock).
          </p>
        </div>

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <li
              key={feature.title}
              className="relative rounded-2xl border border-dust/70 bg-parchment/70 p-7 transition hover:border-walnut/40 hover:bg-parchment dark:border-border-dark dark:bg-panel-dark/60 dark:hover:border-accent-warm/40 dark:hover:bg-panel-dark/75"
            >
              <p className="font-serif text-xs uppercase tracking-widest text-walnut/60 dark:text-ink-dark/58">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-3 font-serif text-xl leading-snug text-ink dark:text-ink-dark">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-walnut/90 dark:text-ink-dark/80">{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
