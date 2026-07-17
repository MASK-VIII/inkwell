/**
 * Local-only free mode (`VITE_INKWELL_LOCAL_ONLY=1`): no cloud sync, no accounts,
 * no purchases — all export features unlocked. This is the current public product
 * posture; cloud/Paddle code stays in the repo behind this flag for a possible
 * future return to commercial mode.
 */
export function isInkwellLocalOnlyMode(): boolean {
  const v = (import.meta.env.VITE_INKWELL_LOCAL_ONLY ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}
