const emblemSrc = `${import.meta.env.BASE_URL}brand/inkwell-emblem.png`

type Props = {
  /** Header chip (bookshelf / editor) */
  size?: 'header' | 'signin'
  className?: string
}

export function InkwellEmblem({ size = 'header', className = '' }: Props) {
  const box = size === 'signin' ? 'h-12 w-12' : 'h-10 w-10'
  return (
    <div
      className={`inkwell-emblem flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-ink/15 transition-[box-shadow,ring-color] group-hover:ring-walnut/35 dark:ring-cream/20 dark:group-hover:ring-accent-warm/40 ${box} ${className}`.trim()}
    >
      <img
        src={emblemSrc}
        alt=""
        width={256}
        height={256}
        decoding="async"
        draggable={false}
        className="h-full w-full origin-center scale-[1.14] object-contain"
        aria-hidden
      />
    </div>
  )
}
