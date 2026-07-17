import type { ReactNode } from 'react'

type Qa = {
  q: string
  a: ReactNode
}

const FAQ: Qa[] = [
  {
    q: 'How mature is Inkwell right now?',
    a: (
      <>
        Inkwell 1.0 is built and supported by one person—the core writing loop (projects, chapters, notes, formatting
        previews, and exports) is stable in daily use. Edge cases still surface; fixes ship quickly and a public roadmap
        shows what is next. For evergreen workflow notes, see{' '}
        <a
          href="/guides"
          className="font-medium text-ink underline decoration-walnut/45 underline-offset-2 transition hover:decoration-walnut/70 dark:text-cream dark:decoration-cream/45 dark:hover:decoration-cream/70"
        >
          Inkwell guides
        </a>
        .
      </>
    ),
  },
  {
    q: 'Is Inkwell really free?',
    a: 'Yes. The full writing workspace, formatting previews, and every export format (EPUB, print-ready PDF, DOCX, Markdown, plain text) are free. There are no paid tiers, no subscription, and no account to create.',
  },
  {
    q: 'Is Inkwell only for beginners?',
    a: 'No. The chapter-first workspace is ideal when you are starting out, and the formatting previews and full export suite carry working novelists through revisions, submissions, and self-publishing. Everything works offline.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. Inkwell has no sign-up and no login. Open the app and start writing; your library is created on your device.',
  },
  {
    q: 'Where is my work stored?',
    a: 'On your device. In the browser, manuscripts live in local browser storage for that browser profile; the desktop app stores them locally on your machine. You can export or download a full library archive anytime for your own backups.',
  },
  {
    q: 'Do I need an internet connection?',
    a: 'No. Inkwell works fully offline—the desktop app always, and the web app after it has loaded once.',
  },
  {
    q: 'Can I use Inkwell for self-publishing on Kindle?',
    a: 'Yes. Export your manuscript as EPUB—the usual starting point for Kindle Direct Publishing and most ebook stores—then upload the file where you sell. PDF and DOCX exports are there when you need print interiors or editor-friendly files.',
  },
  {
    q: 'How do I back up or move my library?',
    a: 'Use the library archive export (.inkwell.zip) to save a complete copy of your work, and import it on another device or browser. Because Inkwell is local-first, your backups are ordinary files you control.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="bg-parchment dark:bg-panel-dark">
      <div className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">Common questions</p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            What writers usually want to know.
          </h2>
        </div>

        <ul className="divide-y divide-dust/70 border-y border-dust/70 dark:divide-border-dark dark:border-border-dark">
          {FAQ.map((qa) => (
            <li key={qa.q}>
              <details className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6">
                  <span className="font-serif text-lg text-ink dark:text-ink-dark">{qa.q}</span>
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-walnut/30 text-walnut transition group-open:rotate-45 dark:border-border-dark dark:text-ink-dark/82"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="6" y1="2" x2="6" y2="10" />
                      <line x1="2" y1="6" x2="10" y2="6" />
                    </svg>
                  </span>
                </summary>
                <div className="mt-3 max-w-3xl text-sm leading-relaxed text-walnut/90 dark:text-ink-dark/82">
                  {qa.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
