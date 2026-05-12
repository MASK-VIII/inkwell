export type InkwellPendingImport = {
  name: string
  buffer: ArrayBuffer
}

export type InkwellAutoUpdateMessage =
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'not-available' }
  | { kind: 'error'; message: string }
  | { kind: 'progress'; percent: number }
  | { kind: 'downloaded'; version: string }

export type InkwellDesktopBridge = {
  takePendingImport: () => Promise<InkwellPendingImport | null>
  importArchiveDialog: () => Promise<InkwellPendingImport | null>
  saveBookBackup: (
    defaultBase: string,
    buffer: ArrayBuffer,
  ) => Promise<{ ok: boolean; path?: string }>
  saveLibraryBackup: (buffer: ArrayBuffer) => Promise<{ ok: boolean; path?: string }>
  onMenuAction: (handler: (action: string) => void) => () => void
  onPendingImport: (handler: () => void) => () => void
  /** Encrypted Supabase session key/value (main process); optional on web. */
  authStorage?: {
    getItem: (key: string) => Promise<string | null>
    setItem: (key: string, value: string) => Promise<void>
    removeItem: (key: string) => Promise<void>
  }
  /** Packaged Windows desktop: GitHub Releases auto-update (see docs/DESKTOP.md). */
  updates?: {
    check: () => Promise<
      | { ok: true; version: string | null }
      | { ok: false; reason?: string; message?: string }
    >
    quitAndInstall: () => Promise<{ ok: boolean; message?: string }>
    onStatus: (handler: (msg: InkwellAutoUpdateMessage) => void) => () => void
  }
}

declare global {
  interface Window {
    inkwellDesktop?: InkwellDesktopBridge
  }
}

export {}
