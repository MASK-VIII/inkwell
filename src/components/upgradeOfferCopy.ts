import {
  INKWELL_DISPLAY_PRICE_BASIC,
  INKWELL_DISPLAY_PRICE_BASIC_TO_PRO,
  INKWELL_DISPLAY_PRICE_PRO,
} from '../marketing/pricingCopy'

export type UpgradeOfferIntent = 'basic' | 'pro' | 'upgrade'

export function upgradeOfferTitleFor(intent: UpgradeOfferIntent): string {
  switch (intent) {
    case 'basic':
      return 'Upgrade to Basic'
    case 'upgrade':
      return 'Upgrade to Pro'
    case 'pro':
    default:
      return 'Upgrade to Pro'
  }
}

export function upgradeOfferBodyFor(intent: UpgradeOfferIntent): string {
  switch (intent) {
    case 'basic':
      return `Basic (${INKWELL_DISPLAY_PRICE_BASIC}) unlocks EPUB export and cloud library sync across your devices. Continue to secure checkout when you are ready.`
    case 'upgrade':
      return `Move from Basic to Pro for ${INKWELL_DISPLAY_PRICE_BASIC_TO_PRO} (one-time upgrade). Continue to checkout to complete your upgrade.`
    case 'pro':
    default:
      return `Pro (${INKWELL_DISPLAY_PRICE_PRO} early access) unlocks the full export suite (PDF, DOCX, archives, and more). Continue to secure checkout when you are ready.`
  }
}

