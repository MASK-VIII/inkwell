/// <reference types="vite/client" />

/** Injected by `vite.config.ts` when `VITE_INKWELL_DESKTOP_DOWNLOAD_URL` is unset. */
declare const __INKWELL_DESKTOP_DOWNLOAD_DEFAULT__: string

interface ImportMetaEnv {
  /** HTTPS endpoint that accepts POST multipart field `archive` (library .zip). */
  readonly VITE_INKWELL_CLOUD_BACKUP_URL?: string
  /** Optional Bearer token sent as Authorization (private / self-hosted receivers only). */
  readonly VITE_INKWELL_CLOUD_BACKUP_KEY?: string
  /** Explicit opt-in for the legacy unauthenticated backup POST flow (disabled in production by default). */
  readonly VITE_ENABLE_LEGACY_BACKUP?: string
  /** When truthy, enables Supabase-backed library sync (requires URL + anon key). */
  readonly VITE_INKWELL_CLOUD_SYNC?: string
  /** HTTPS URL to the Windows desktop installer (e.g. GitHub Release asset). Shown on the sign-in screen in web builds when set. */
  readonly VITE_INKWELL_DESKTOP_DOWNLOAD_URL?: string
  readonly VITE_SUPABASE_URL?: string
  /** Legacy name; same role as publishable key below. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Supabase dashboard “Connect” often labels this the publishable key (`sb_publishable_…`). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
