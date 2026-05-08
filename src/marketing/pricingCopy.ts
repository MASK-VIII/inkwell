/**
 * Display-only USD copy for marketing + in-app account UI.
 * Actual amounts charged at checkout are whatever you set in Paddle for each `pri_` price.
 */

import { CLOUD_LIMIT_BASIC_DISPLAY, CLOUD_LIMIT_PRO_DISPLAY } from '../lib/cloudQuota'

export { CLOUD_LIMIT_BASIC_DISPLAY, CLOUD_LIMIT_PRO_DISPLAY }

export const INKWELL_DISPLAY_PRICE_BASIC = '$49'
export const INKWELL_DISPLAY_PRICE_PRO = '$99'
export const INKWELL_DISPLAY_PRICE_BASIC_TO_PRO = '$50'
/** Strike-through / future list price for Pro (early access messaging). */
export const INKWELL_DISPLAY_PRICE_PRO_LIST = '$149'

export const pricingCopy = {
  basicFinePrint: `Upgrade Basic → Pro later for ${INKWELL_DISPLAY_PRICE_BASIC_TO_PRO} one-time. New purchase: Basic ${INKWELL_DISPLAY_PRICE_BASIC} or Pro ${INKWELL_DISPLAY_PRICE_PRO}.`,
  proFinePrint: `Full price moves to ${INKWELL_DISPLAY_PRICE_PRO_LIST} after early access.`,
  /** Shown under the plan cards on the marketing pricing section. */
  upgradePathLine: `Basic → Pro upgrade: ${INKWELL_DISPLAY_PRICE_BASIC_TO_PRO} one-time (you already have Basic; backup rises to ${CLOUD_LIMIT_PRO_DISPLAY}). Go Pro from Free: ${INKWELL_DISPLAY_PRICE_PRO} one-time.`,
} as const
