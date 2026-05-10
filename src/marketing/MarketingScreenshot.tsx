import { useState, type CSSProperties } from 'react'

type Props = {
  /** Path to the screenshot under `public/`, e.g. `/marketing/hero.png`. Falls back to a styled placeholder. */
  src: string
  alt: string
  /** Caption shown both inside the placeholder and beneath the figure. */
  caption: string
  /** CSS aspect-ratio string. Defaults to a 16:10 frame that suits desktop UI shots. */
  aspectRatio?: string
  /** CSS object-position for crop framing (e.g. "50% 20%"). */
  objectPosition?: string
  /** Optional class additions for the outer figure (e.g. shadow tweaks). */
  className?: string
  /** 1-based step index for gallery-style labels (optional). */
  index?: number
}

/**
 * Image frame for marketing screenshots. While the user has not yet dropped a
 * file at `src`, the component renders a tasteful placeholder labelled with
 * the caption. Once a file exists at the path, it shows the real image.
 */
export function MarketingScreenshot({
  src,
  alt,
  caption,
  aspectRatio = '16 / 10',
  objectPosition,
  className = '',
  index,
}: Props) {
  const [errored, setErrored] = useState(false)
  const frameStyle: CSSProperties = { aspectRatio }
  const imgStyle: CSSProperties | undefined = objectPosition ? { objectPosition } : undefined

  return (
    <figure className={`flex flex-col gap-3.5 ${className}`.trim()}>
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-dust/70 bg-panel-light-muted/82 shadow-[0_2px_30px_rgba(44,36,31,0.08)] ring-1 ring-walnut/5 transition-shadow duration-300 hover:shadow-[0_12px_44px_rgba(44,36,31,0.11)] dark:border-border-dark dark:bg-panel-dark/60 dark:shadow-[0_2px_40px_rgba(0,0,0,0.35)] dark:ring-cream/10 dark:hover:shadow-[0_14px_48px_rgba(0,0,0,0.45)]"
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
            style={imgStyle}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-parchment via-white/70 to-dust/30 px-6 text-center dark:from-panel-dark dark:via-panel-dark/80 dark:to-border-dark/40">
            <div className="h-px w-16 bg-walnut/30 dark:bg-cream/25" aria-hidden />
            <p className="font-serif text-base text-walnut/85 sm:text-lg dark:text-ink-dark/80">{caption}</p>
            <p className="text-xs uppercase tracking-widest text-walnut/55 dark:text-ink-dark/62">Screenshot placeholder</p>
          </div>
        )}
      </div>
      <figcaption className="flex flex-col items-center gap-1 text-center">
        {index != null ? (
          <span className="text-[0.65rem] font-semibold tabular-nums tracking-[0.16em] text-walnut/45 dark:text-ink-dark/48">
            {String(index).padStart(2, '0')}
          </span>
        ) : null}
        <span className="max-w-[18rem] font-serif text-[0.9375rem] leading-snug text-ink dark:text-ink-dark">{caption}</span>
      </figcaption>
    </figure>
  )
}
