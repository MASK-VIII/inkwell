/// <reference types="vite/client" />

/** Injected by `vite.config.ts` when `VITE_INKWELL_DESKTOP_DOWNLOAD_URL` is unset. */
declare const __INKWELL_DESKTOP_DOWNLOAD_DEFAULT__: string

interface ImportMetaEnv {
  /** HTTPS URL to the Windows desktop installer (e.g. GitHub Release asset). Shown on the marketing site when set. */
  readonly VITE_INKWELL_DESKTOP_DOWNLOAD_URL?: string
  /** Optional `Owner/repo` for default GitHub latest-download URL when `git remote` is unavailable at build time. */
  readonly VITE_INKWELL_GITHUB_OWNER_REPO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
