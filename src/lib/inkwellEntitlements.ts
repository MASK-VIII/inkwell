/**
 * Inkwell licensing tiers (Paddle → Supabase `user_entitlements`).
 * @see docs/LICENSING.md
 */

import {
  INKWELL_CLOUD_QUOTA_BASIC_BYTES,
  INKWELL_CLOUD_QUOTA_PRO_BYTES,
} from './cloudQuota'
import { isInkwellLocalOnlyMode } from './localPersonalMode'

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

/** Byte cap for cloud library zip backup; `null` when sync not included (Free). */
export function cloudLibraryQuotaBytes(tier: InkwellTier): number | null {
  if (tier === 'basic') return INKWELL_CLOUD_QUOTA_BASIC_BYTES
  if (tier === 'pro') return INKWELL_CLOUD_QUOTA_PRO_BYTES
  return null
}

export function computeInkwellGates(row: InkwellEntitlementRow | null): InkwellCapabilityGates {
  if (isInkwellLocalOnlyMode()) {
    return {
      tier: 'pro',
      canExportEpub: true,
      canUseProExports: true,
      canUseCloudSync: false,
      canUseEbookFormat: true,
      canUsePrintFormat: true,
      canUseNoteExportSuite: true,
    }
  }

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
