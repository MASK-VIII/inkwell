import { MarketingScreenshot } from './MarketingScreenshot'

type ShotSpec = {
  src: string
  alt: string
  caption: string
}

const SHOTS: ShotSpec[] = [
  {
    src: '/marketing/shelf.png',
    alt: 'The Inkwell bookshelf with multiple manuscripts',
    caption: 'The bookshelf',
  },
  {
    src: '/marketing/editor.png',
    alt: 'A chapter open in the Inkwell editor',
    caption: 'The chapter editor',
  },
  {
    src: '/marketing/tools.png',
    alt: 'Inkwell tools: goals, readability, repeated-words feedback',
    caption: 'Editorial tools',
  },
  {
    src: '/marketing/format.png',
    alt: 'Inkwell formatting an interior for print',
    caption: 'Print \u0026 ebook formatting',
  },
]

export function ScreenshotsSection() {
  return (
    <section className="border-y border-dust/60 bg-white/40 dark:border-border-dark/80 dark:bg-panel-dark/35">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">A look inside</p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            The interface, on purpose.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-walnut/85 dark:text-ink-dark/70">
            Type-driven, parchment-warm, dark-mode-friendly. Inkwell looks like a place you would want to spend an afternoon.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {SHOTS.map((shot) => (
            <MarketingScreenshot
              key={shot.src}
              src={shot.src}
              alt={shot.alt}
              caption={shot.caption}
              aspectRatio="16 / 10"
            />
          ))}
        </div>
      </div>
    </section>
  )
}
