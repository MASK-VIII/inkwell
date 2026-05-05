import { useState, type CSSProperties } from 'react'

type Props = {
  /** Path to the screenshot under `public/`, e.g. `/marketing/hero.png`. Falls back to a styled placeholder. */
  src: string
  alt: string
  /** Caption shown both inside the placeholder and beneath the figure. */
  caption: string
  /** CSS aspect-ratio string. Defaults to a 16:10 frame that suits desktop UI shots. */
  aspectRatio?: string
  /** Optional class additions for the outer figure (e.g. shadow tweaks). */
  className?: string
}

/**
 * Image frame for marketing screenshots. While the user has not yet dropped a
 * file at `src`, the component renders a tasteful placeholder labelled with
 * the caption. Once a file exists at the path, it shows the real image.
 */
export function MarketingScreenshot({ src, alt, caption, aspectRatio = '16 / 10', className = '' }: Props) {
  const [errored, setErrored] = useState(false)
  const frameStyle: CSSProperties = { aspectRatio }

  return (
    <figure className={`flex flex-col gap-3 ${className}`.trim()}>
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-dust/70 bg-white/60 shadow-[0_2px_30px_rgba(44,36,31,0.08)] ring-1 ring-walnut/5 dark:border-border-dark dark:bg-panel-dark/60 dark:shadow-[0_2px_40px_rgba(0,0,0,0.35)] dark:ring-cream/10"
        style={frameStyle}
      >
        {!errored ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-parchment via-white/70 to-dust/30 px-6 text-center dark:from-panel-dark dark:via-panel-dark/80 dark:to-border-dark/40">
            <div className="h-px w-16 bg-walnut/30 dark:bg-cream/25" aria-hidden />
            <p className="font-serif text-base text-walnut/85 sm:text-lg dark:text-ink-dark/80">{caption}</p>
            <p className="text-xs uppercase tracking-widest text-walnut/55 dark:text-ink-dark/55">Screenshot placeholder</p>
          </div>
        )}
      </div>
      <figcaption className="text-center text-xs uppercase tracking-widest text-walnut/65 dark:text-ink-dark/55">
        {caption}
      </figcaption>
    </figure>
  )
}
