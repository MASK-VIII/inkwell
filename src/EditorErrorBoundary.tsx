import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { error: Error | null }

/** Catches render errors (e.g. TipTap/ProseMirror) so the app does not go fully blank. */
export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Inkwell] Editor error boundary', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center text-ink dark:text-ink-dark">
          <p className="font-serif text-lg font-semibold">The editor hit an error</p>
          <p className="max-w-md text-sm opacity-80">
            Try reloading the page. If this happened after importing a file, the document may contain unsupported
            structure—try simplifying it in Word and import again.
          </p>
          <pre className="max-h-40 max-w-2xl overflow-auto rounded-2xl border border-dust bg-white/80 p-4 text-left text-xs dark:border-border-dark dark:bg-panel-dark/80">
            {String(this.state.error)}
          </pre>
          <button
            type="button"
            className="rounded-3xl bg-ink px-5 py-2.5 text-sm font-semibold text-parchment dark:bg-cream dark:text-ink"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
