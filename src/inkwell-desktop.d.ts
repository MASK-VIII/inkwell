export type InkwellPendingImport = {
  name: string
  buffer: ArrayBuffer
}

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
}

declare global {
  interface Window {
    inkwellDesktop?: InkwellDesktopBridge
  }
}

export {}
