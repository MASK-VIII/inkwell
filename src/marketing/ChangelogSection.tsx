import { useEffect, useMemo, useState } from 'react'
import { humanizeChangelogTitle } from './changelogDisplay'

/** Add roadmap bullets here when ready (shown under Coming soon). */
const COMING_SOON: string[] = []

type ChangelogItem = {
  kind: 'changelog' | 'feat' | 'fix'
  date: string
  title: string
  hash: string
}

type Feed = {
  generatedAt: string
  items: ChangelogItem[]
}

function Badge({ kind }: { kind: ChangelogItem['kind'] }) {
  const label = kind === 'feat' ? 'New' : kind === 'fix' ? 'Fix' : 'Update'
  const cls =
    kind === 'feat' ?
      'bg-cream/30 text-walnut dark:bg-cream/18 dark:text-ink-dark/80'
    : kind === 'fix' ?
      'bg-walnut/18 text-walnut dark:bg-border-dark dark:text-ink-dark/70'
    : 'bg-dust/40 text-walnut dark:bg-border-dark/70 dark:text-ink-dark/70'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-widest ${cls}`}>
      {label}
    </span>
  )
}

export function ChangelogSection() {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/changelog.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch_failed'))))
      .then((json) => {
        if (cancelled) return
        setFeed(json as Feed)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const items = useMemo(() => feed?.items?.slice(0, 4) ?? [], [feed])

  return (
    <section className="border-y border-dust/60 bg-panel-light-muted/62 dark:border-border-dark/80 dark:bg-panel-dark/35">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">Roadmap</p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            In progress and recently shipped.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
            What we are focused on next, plus a short changelog of improvements as they land.
          </p>
        </div>

        <div className="mb-14">
          <h3 className="font-serif text-xl text-ink dark:text-ink-dark sm:text-2xl">Coming soon</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-walnut/80 dark:text-ink-dark/75">
            Active priorities—not a promise of order or dates, but a window into what we are building.
          </p>
          {COMING_SOON.length > 0 ?
            <ul className="mt-6 grid gap-3 sm:max-w-2xl">
              {COMING_SOON.map((line) => (
                <li
                  key={line}
                  className="rounded-2xl border border-walnut/20 bg-panel-light-muted/72 px-5 py-4 text-sm leading-relaxed text-ink dark:border-accent-warm/35 dark:bg-panel-dark/50 dark:text-ink-dark"
                >
                  {line}
                </li>
              ))}
            </ul>
          : null}
        </div>

        <div>
          <h3 className="font-serif text-xl text-ink dark:text-ink-dark sm:text-2xl">Recently shipped</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-walnut/80 dark:text-ink-dark/75">
            User-facing notes from recent releases (auto-generated from commits).
          </p>

          <div className="mt-6">
            {failed ? (
              <div className="rounded-2xl border border-dust/70 bg-parchment/70 p-7 text-sm text-walnut/85 dark:border-border-dark dark:bg-panel-dark/60 dark:text-ink-dark/80">
                Ship history is unavailable right now.
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dust/70 bg-parchment/70 p-7 text-sm text-walnut/85 dark:border-border-dark dark:bg-panel-dark/60 dark:text-ink-dark/80">
                No changelog entries yet.
              </div>
            ) : (
              <ol className="grid gap-4">
                {items.map((it) => (
                  <li
                    key={`${it.date}-${it.hash}-${it.title}`}
                    className="rounded-2xl border border-dust/70 bg-parchment/70 p-6 dark:border-border-dark dark:bg-panel-dark/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Badge kind={it.kind} />
                        <p className="text-xs font-medium uppercase tracking-widest text-walnut/60 dark:text-ink-dark/58">
                          {it.date}
                        </p>
                      </div>
                      <p className="text-xs text-walnut/50 dark:text-ink-dark/58">#{it.hash}</p>
                    </div>
                    <p className="mt-3 font-serif text-lg text-ink dark:text-ink-dark">
                    {humanizeChangelogTitle(it.title) || it.title}
                  </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {feed?.generatedAt && (
          <p className="mt-8 text-xs text-walnut/60 dark:text-ink-dark/62">
            Changelog feed updated {new Date(feed.generatedAt).toLocaleDateString()}.
          </p>
        )}
      </div>
    </section>
  )
}

