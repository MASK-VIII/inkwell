/**
 * Inkwell licensing tiers (Paddle → Supabase `user_entitlements`).
 * @see docs/LICENSING.md
 */

export type InkwellTier = 'free' | 'basic' | 'pro'
export type InkwellEntitlementSourceTier = InkwellTier | 'ebook_suite'

export type InkwellEntitlementRow = {
  tier: InkwellEntitlementSourceTier
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

export function normalizeInkwellTier(tier: unknown): InkwellTier {
  if (tier === 'ebook_suite' || tier === 'basic') return 'basic'
  if (tier === 'pro') return 'pro'
  return 'free'
}

export function computeInkwellGates(row: InkwellEntitlementRow | null): InkwellCapabilityGates {
  const active = row == null || row.status === 'active'
  const tier: InkwellTier = !active || row == null ? 'free' : normalizeInkwellTier(row.tier)

  return {
    tier,
    canExportEpub: tier === 'basic' || tier === 'pro',
    canUseProExports: tier === 'pro',
    canUseCloudSync: tier === 'basic' || tier === 'pro',
    // Formatting workspaces are available on Free; exporting stays gated by tier.
    canUseEbookFormat: true,
    canUsePrintFormat: tier === 'pro',
    canUseNoteExportSuite: tier === 'pro',
  }
}
