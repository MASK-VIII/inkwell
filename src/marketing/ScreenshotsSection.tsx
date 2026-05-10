import { MarketingScreenshot } from './MarketingScreenshot'

type ShotSpec = {
  src: string
  darkSrc?: string
  alt: string
  caption: string
  objectPosition?: string
}

const SHOTS: ShotSpec[] = [
  {
    src: '/marketing/bookshelf-light.png',
    darkSrc: '/marketing/bookshelf-dark.png',
    alt: 'The Inkwell bookshelf with multiple manuscripts',
    caption: 'The bookshelf',
    objectPosition: '50% 18%',
  },
  {
    src: '/marketing/writing-page-light.png',
    darkSrc: '/marketing/writing-page-dark.png',
    alt: 'Inkwell writing workspace with editorial toolbars and manuscript canvas',
    caption: 'Writing workspace',
    objectPosition: '50% 16%',
  },
  {
    src: '/marketing/format-page-light.png',
    darkSrc: '/marketing/format-page-dark.png',
    alt: 'Inkwell format workspace with ebook preview, chapter list, and theme controls',
    caption: 'Print \u0026 ebook formatting',
    objectPosition: '50% 16%',
  },
]

export function ScreenshotsSection({ darkMode = false }: { darkMode?: boolean }) {
  return (
    <section
      id="screenshots"
      className="relative overflow-hidden border-y border-dust/60 bg-gradient-to-b from-parchment/50 via-white/35 to-parchment/40 dark:border-border-dark/80 dark:from-panel-dark dark:via-panel-dark/92 dark:to-panel-dark"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(28rem,55vw)] bg-[radial-gradient(ellipse_75%_60%_at_50%_0%,rgba(139,119,101,0.11),transparent)] dark:bg-[radial-gradient(ellipse_75%_60%_at_50%_0%,rgba(212,175,125,0.07),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mb-10 max-w-2xl sm:mb-12">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">Screenshots</p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            Elegant by default. Yours when you need it.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
            Your library, writing workspace, and format preview—straight from the app. Use the theme control in the header to see light and dark.
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-7">
          {SHOTS.map((shot, i) => (
            <MarketingScreenshot
              key={shot.src}
              index={i + 1}
              src={shot.src}
              darkSrc={shot.darkSrc}
              darkMode={darkMode}
              alt={shot.alt}
              caption={shot.caption}
              aspectRatio="16 / 10"
              objectPosition={shot.objectPosition}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
