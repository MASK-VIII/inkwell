/**
 * Dev-only Performance API marks for the Write chapters overlay toggle.
 * In Chrome DevTools → Performance: record, expand/collapse chapters, then inspect
 * Layout vs Paint during the marked window (filter by "inkwell-chapters").
 */
const PREFIX = 'inkwell-chapters'

function clearToggleMarks(tag: 'expand' | 'collapse') {
  const a = `${PREFIX}-${tag}-start`
  const b = `${PREFIX}-${tag}-end`
  const m = `${PREFIX}-${tag}-duration`
  try {
    performance.clearMarks(a)
    performance.clearMarks(b)
    performance.clearMeasures(m)
  } catch {
    /* ignore */
  }
}

/** Call when a chapters expand/collapse begins (e.g. from the persisted setter). */
export function devMarkChaptersToggleStart(nextExpanded: boolean) {
  if (!import.meta.env.DEV) return
  const tag: 'expand' | 'collapse' = nextExpanded ? 'expand' : 'collapse'
  clearToggleMarks(tag)
  try {
    performance.mark(`${PREFIX}-${tag}-start`)
  } catch {
    /* ignore */
  }
}

/** Call from the panel `transitionend` (transform) after the slide finishes. */
export function devMarkChaptersToggleEnd(currentExpanded: boolean) {
  if (!import.meta.env.DEV) return
  const tag: 'expand' | 'collapse' = currentExpanded ? 'expand' : 'collapse'
  try {
    performance.mark(`${PREFIX}-${tag}-end`)
    performance.measure(`${PREFIX}-${tag}-duration`, `${PREFIX}-${tag}-start`, `${PREFIX}-${tag}-end`)
    const entry = performance.getEntriesByName(`${PREFIX}-${tag}-duration`, 'measure').pop()
    if (entry) {
      console.debug(
        `[Inkwell dev: chapters ${tag}] ${entry.duration.toFixed(1)}ms — Performance panel: record, toggle chapters, compare Layout vs Paint in this interval.`,
      )
    }
  } catch {
    /* ignore */
  }
}
