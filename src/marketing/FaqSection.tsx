type Qa = {
  q: string
  a: string
}

const FAQ: Qa[] = [
  {
    q: 'What do I get for free?',
    a: 'The full writing experience: projects, chapters, notes, organization, and formatting previews. You can use Inkwell indefinitely on the Free plan.',
  },
  {
    q: 'What is locked on Free?',
    a: 'Exports and cloud sync. Upgrade when you are ready to publish (exports) or write across devices (cloud sync).',
  },
  {
    q: 'What does Ebook Suite unlock?',
    a: 'EPUB export. It is the simplest finish line if you are publishing digitally and want an ebook file you can take to readers and platforms.',
  },
  {
    q: 'Why are exports paid?',
    a: 'Because Inkwell is built by one developer. Paid exports keep the lights on and the updates coming.',
  },
  {
    q: 'Where is my work stored?',
    a: 'On your device first. Cloud sync is optional (Pro) and keeps a backup that travels across devices.',
  },
  {
    q: 'Do I need an internet connection?',
    a: 'No. Inkwell works fully offline. Cloud sync is optional and runs in the background when you are online.',
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
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-walnut/30 text-walnut transition group-open:rotate-45 dark:border-border-dark dark:text-ink-dark/70"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="6" y1="2" x2="6" y2="10" />
                      <line x1="2" y1="6" x2="10" y2="6" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-walnut/90 dark:text-ink-dark/70">{qa.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
