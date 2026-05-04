/**
 * Light-mode raster: replace `public/brand/inkwell-emblem-light.png` (same framing as dark).
 * Ask your image model for a **light-chrome** version: no heavy black annulus; outer area
 * parchment or soft shadow only; gold disc only inside the circle.
 *
 * **Inkwell palette (hex) — paste into Grok / Imagine:**
 * - Parchment (page / outer safe area): `#F8F1E3`
 * - Ink (deep brown, quill / ink only, not as a thick ring): `#2C241F`
 * - Accent gold (highlights, rim glints): `#D9A441`
 * - Bronze / mid gold (disc body): `#B8892E` → `#8B6914` gradient feel
 * - Dust (soft secondary): `#D4C3A8`
 * - **Avoid:** `#000000` outer ring, heavy black bezel, cool gray chrome
 * - **Halo + coin:** inner gold disc and outer halo must meet in **gold** (no black annulus
 *   between them) if you want both visible inside a circular app chip; otherwise the chip
 *   crops to the inner disc only (see CSS zoom below).
 *
 * Dark asset: `public/brand/inkwell-emblem.png` (current gold-on-charcoal look).
 */
const base = import.meta.env.BASE_URL
const emblemDarkSrc = `${base}brand/inkwell-emblem.png`
const emblemLightSrc = `${base}brand/inkwell-emblem-light.png`

/** Matches `html` / surface theme bridge (`--inkwell-theme-bridge-*` in `index.css`). */
const THEME_T = 'duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]'

type Props = {
  darkMode: boolean
  className?: string
}

export function InkwellEmblem({ darkMode, className = '' }: Props) {
  /* One footprint everywhere (sign-in, bookshelf, editor): matches sign-in chip scale. */
  const box = 'h-14 w-14'

  const shellLight =
    'shadow-md shadow-amber-950/10 ring-1 ring-amber-800/16 group-hover:shadow-lg group-hover:shadow-amber-950/15 group-hover:ring-amber-700/26'
  const shellDark =
    'shadow-[0_1px_14px_rgba(0,0,0,0.5)] ring-1 ring-cream/22 group-hover:shadow-[0_2px_18px_rgba(0,0,0,0.55)] group-hover:ring-accent-warm/40'

  /* Shared crop: zoom past in-PNG halos / parchment margin so the circle traces solid coin;
     enlarged chip (box) matches prior halo-inclusive diameter. Theme-only color tweaks. */
  const imgCrop =
    'pointer-events-none absolute left-1/2 top-1/2 max-h-none max-w-none -translate-x-1/2 -translate-y-1/2 h-[136%] w-[136%] object-[50%_47%] object-cover'
  const imgTuneLight = 'brightness-[1.02] saturate-[1.05] contrast-[1.02]'
  const imgTuneDark = 'brightness-[1.03] saturate-[0.98] contrast-[1.03]'
  const imgMotion = `origin-center transform-gpu transition-[opacity,transform] ${THEME_T} will-change-[opacity,transform] motion-reduce:transition-none motion-reduce:will-change-auto motion-reduce:duration-0`

  return (
    <div
      className={`inkwell-emblem relative shrink-0 overflow-hidden rounded-full transition-[box-shadow,ring-color] ${THEME_T} motion-reduce:transition-none motion-reduce:duration-0 ${darkMode ? shellDark : shellLight} ${box} ${className}`.trim()}
    >
      <img
        src={emblemLightSrc}
        alt=""
        width={256}
        height={256}
        decoding="async"
        draggable={false}
        className={`${imgCrop} ${imgTuneLight} ${imgMotion} z-[1] scale-100 opacity-100 motion-safe:dark:scale-[0.98] dark:opacity-0`}
        aria-hidden
      />
      <img
        src={emblemDarkSrc}
        alt=""
        width={256}
        height={256}
        decoding="async"
        draggable={false}
        className={`${imgCrop} ${imgTuneDark} ${imgMotion} z-[2] motion-safe:scale-[0.98] opacity-0 motion-safe:dark:scale-100 dark:opacity-100`}
        aria-hidden
      />
    </div>
  )
}
