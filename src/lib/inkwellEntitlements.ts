/**
 * Inkwell licensing tiers (Paddle → Supabase `user_entitlements`).
 * @see docs/LICENSING.md
 */

export type InkwellTier = 'free' | 'ebook_suite' | 'pro'

export type InkwellEntitlementRow = {
  tier: InkwellTier
  status: string
}

export type InkwellCapabilityGates = {
  tier: InkwellTier
  canExportEpub: boolean
  canUseProExports: boolean
  canUseCloudSync: boolean
  canUseEbookFormat: boolean
  canUsePrintFormat: boolean
  /** Note / web export hub (HTML, MD, etc.) — Pro only */
  canUseNoteExportSuite: boolean
}

export function computeInkwellGates(row: InkwellEntitlementRow | null): InkwellCapabilityGates {
  const active = row == null || row.status === 'active'
  const tier: InkwellTier =
    !active || row == null ? 'free'
    : row.tier === 'ebook_suite' || row.tier === 'pro' ? row.tier
    : 'free'

  return {
    tier,
    canExportEpub: tier === 'ebook_suite' || tier === 'pro',
    canUseProExports: tier === 'pro',
    canUseCloudSync: tier === 'ebook_suite' || tier === 'pro',
    // Formatting workspaces are available on Free; exporting stays gated by tier.
    canUseEbookFormat: true,
    canUsePrintFormat: tier === 'pro',
    canUseNoteExportSuite: tier === 'pro',
  }
}
