type Feature = {
  title: string
  body: string
}

const FEATURES: Feature[] = [
  {
    title: 'A manuscript-first workspace',
    body:
      'Books, chapters, scenes, and notes that travel together—simple enough on day one, flexible enough when your process gets opinionated.',
  },
  {
    title: 'Highly customizable, drag-and-drop first',
    body:
      'Reorder chapters, move notes, and shape your workspace with simple, tactile drag-and-drop. Inkwell stays flexible as the manuscript evolves.',
  },
  {
    title: 'A pleasant place to write',
    body:
      'Typography-led and distraction-light, with a page that feels calm at hour one and hour four. Light mode, dark mode, and everything in between.',
  },
  {
    title: 'Robust notes that belong to the book',
    body:
      'Scratch notes, linked notes, and a series bible that live alongside the manuscript. Keep research, continuity, and draft decisions close to the chapter that needs them.',
  },
  {
    title: 'Draft \u2192 publication, in one app',
    body:
      'Write, format for print or ebook, preview the interior, and export clean DOCX, PDF, or EPUB when the manuscript is ready. Your work stays yours, and it leaves with you.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="border-y border-dust/60 bg-white/50 dark:border-border-dark/80 dark:bg-panel-dark/40">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">Features</p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            Room to grow from chapter one to “the end.”
          </h2>
          <p className="mt-4 text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
            Whether you are drafting your first manuscript or your next release, Inkwell stays manuscript-first through the months when ideas become books. Try it locally on the Free tier with no sign-up—everything below works without an account until you choose paid exports or cloud backup.
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
