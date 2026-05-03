/** Matches `--inkwell-panel-motion-duration` (e.g. `520ms`) for timeouts and fallbacks. */
export function readInkwellPanelMotionDurationMs(): number {
  if (typeof document === 'undefined') return 520
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--inkwell-panel-motion-duration').trim()
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 520
}
