type Props = {
  as?: 'span' | 'h1'
  className?: string
}

/** Display wordmark for “Inkwell” — pairs with `InkwellEmblem`; styles live in `index.css` (`.inkwell-wordmark`). */
export function InkwellWordmark({ as: Comp = 'span', className = '' }: Props) {
  return (
    <Comp className={`inkwell-wordmark font-normal text-[2rem] leading-[1.05] sm:text-[2.5rem] ${className}`.trim()}>
      Inkwell
    </Comp>
  )
}
