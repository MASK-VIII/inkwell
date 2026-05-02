export function clampNumber(value: string, fallback: number, min?: number, max?: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const lo = min == null ? n : Math.max(min, n)
  return max == null ? lo : Math.min(max, lo)
}
