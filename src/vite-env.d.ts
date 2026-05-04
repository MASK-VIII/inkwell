/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** HTTPS endpoint that accepts POST multipart field `archive` (library .zip). */
  readonly VITE_INKWELL_CLOUD_BACKUP_URL?: string
  /** Optional Bearer token sent as Authorization (private / self-hosted receivers only). */
  readonly VITE_INKWELL_CLOUD_BACKUP_KEY?: string
  /** When truthy, enables Supabase-backed library sync (requires URL + anon key). */
  readonly VITE_INKWELL_CLOUD_SYNC?: string
  readonly VITE_SUPABASE_URL?: string
  /** Legacy name; same role as publishable key below. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Supabase dashboard “Connect” often labels this the publishable key (`sb_publishable_…`). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
