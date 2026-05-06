/**
 * Display-only USD copy for marketing + in-app account UI.
 * Actual amounts charged at checkout are whatever you set in Paddle for each `pri_` price.
 */
export const INKWELL_DISPLAY_PRICE_BASIC = '$49'
export const INKWELL_DISPLAY_PRICE_PRO = '$99'
export const INKWELL_DISPLAY_PRICE_BASIC_TO_PRO = '$50'
/** Strike-through / future list price for Pro (early access messaging). */
export const INKWELL_DISPLAY_PRICE_PRO_LIST = '$149'

export const pricingCopy = {
  basicFinePrint: `From Basic, move up to Pro for ${INKWELL_DISPLAY_PRICE_BASIC_TO_PRO} (Basic → Pro upgrade). From Free, you can pick Basic at ${INKWELL_DISPLAY_PRICE_BASIC} or Pro at ${INKWELL_DISPLAY_PRICE_PRO}.`,
  proFinePrint: `Early-access ${INKWELL_DISPLAY_PRICE_PRO}. List price ${INKWELL_DISPLAY_PRICE_PRO_LIST} when Pro is fully polished.`,
  /** Shown under the plan cards on the marketing pricing section. */
  upgradePathLine: `Basic → Pro upgrade: ${INKWELL_DISPLAY_PRICE_BASIC_TO_PRO} one-time (you already have Basic). Go Pro from Free: ${INKWELL_DISPLAY_PRICE_PRO} one-time.`,
} as const
