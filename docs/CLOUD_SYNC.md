# Cloud sync and backup (web + desktop)

This document records product and engineering decisions for moving beyond local-only storage. It complements the high-level storage picture in the codebase (`localStorage`, IndexedDB, `.inkwell.zip` archives).

## 1. Sync model (decisions)

### Primary goal for v1 (shipped paths)

- **Legacy backup POST:** Optional unauthenticated `VITE_INKWELL_CLOUD_BACKUP_URL` + `VITE_INKWELL_CLOUD_BACKUP_KEY` — single POST of the library zip (`src/lib/cloudBackup.ts`). Suitable only for **private** receivers.
- **Authenticated two-way sync (Supabase):** When `VITE_INKWELL_CLOUD_SYNC` is enabled together with Supabase env vars, the app uses **signed-in users**, **Storage** for library zips, **Postgres** `library_heads` + RPC for `remoteRev` concurrency, a **client sync engine** (`src/lib/sync/syncEngine.ts`), a **durable IndexedDB queue** (`src/lib/cloudSync/syncQueue.ts`), and **conflict UI** (modal + status strip). See milestones below.

### Phase 2 behavior (two-way)

**Two-way sync** with explicit pull/push and conflict handling—not invisible merge.

| Mode | Status |
|------|--------|
| Real-time collaborative editing (CRDT, live cursors) | Out of scope until backup + two-way sync prove stable. |
| Near-real-time upload of saves | Debounced push after local idle + queue flush when online. |
| **Backup-only POST (`cloudBackup.ts`)** | **Still supported** when only backup URL is set; superseded for product UX when Supabase sync is enabled. |

### Conflict policy (Supabase path)

1. **Server:** Opaque monotonic `remote_rev` per user in `library_heads`, plus `storage_object_path` for the current zip in the `libraries` bucket.
2. **On push:** Client uploads a **new object** under `{user_id}/…`, then calls RPC `inkwell_commit_library_push(p_base_rev, p_storage_path)`. Stale base → JSON `{ ok: false, error: "conflict", server_rev }` (surfaced as sync conflict in UI).
3. **Resolution UI:** “Keep this device” → `inkwell_force_commit_library_push` (new revision, overwrites metadata pointer). “Use cloud copy” → download current path + `importInkwellArchive`. “Download both as .zip” → local `exportLibraryZip` + Storage download for manual merge.
4. **No automatic CRDT** for full-library blobs.

### Web + desktop parity

- **Same React bundle** on web and Electron: sync logic is shared (`src/lib/sync/*`).
- **Auth tokens:** Web uses Supabase JS default persistence (`localStorage` unless overridden). **Desktop:** `electron/preload.cjs` exposes `inkwellDesktop.authStorage`, backed by the main process with **`safeStorage`** when available (`electron/main.cjs` IPC `inkwell:auth-kv-*`), so refresh tokens are not left in plain renderer `localStorage` on Electron when OS encryption is available.
- **Feature flags:** Sync is off unless `VITE_INKWELL_CLOUD_SYNC` is truthy **and** `VITE_SUPABASE_URL` plus **`VITE_SUPABASE_ANON_KEY`** or **`VITE_SUPABASE_PUBLISHABLE_KEY`** is set. Backup POST remains off unless `VITE_INKWELL_CLOUD_BACKUP_URL` is set.

## 2. Backend: Supabase (provisioned by you)

Apply the SQL in **`supabase/migrations/20260503120000_inkwell_library_sync.sql`** in the Supabase SQL editor (or via Supabase CLI). It creates:

| Piece | Purpose |
|-------|---------|
| Table **`library_heads`** | `user_id`, `remote_rev`, `storage_object_path`, `updated_at` with RLS (row owner = `auth.uid()`). |
| Bucket **`libraries`** | Private object storage; object keys must start with `{auth.uid()}/`. Per-object size limit is raised by **`20260507180000_raise_libraries_bucket_limit.sql`** (25 GiB ceiling); tier quotas (Basic 2 GiB / Pro 20 GiB compressed backup) are enforced in the client via `src/lib/cloudQuota.ts` + `pushLibraryZip` options. |
| RPC **`inkwell_commit_library_push`** | Optimistic concurrency: bump rev only when `p_base_rev` matches. |
| RPC **`inkwell_force_commit_library_push`** | “Keep this device” — always advance rev and set path. |

**Client contract:** Library zip format matches `exportLibraryZip()` / `importInkwellArchive()` (`src/lib/projectArchive.ts`).

**Security:** Ship only the **anon** or **publishable** key to the SPA/Electron bundle. Never expose the **service role** key in the client. For **email/password** sign-in, URL allowlists are not required for login itself. Keep **Authentication → URL configuration** correct for any **password recovery** or **OAuth** redirects (web origin, `http://localhost:5173` for dev, and `inkwell://app/…` for packaged desktop if you use those flows).

## 3. Client modules (reference)

| Module | Role |
|--------|------|
| `src/lib/sync/syncEnv.ts` | Feature flag + public Supabase URL/key. |
| `src/lib/sync/authSession.ts` | Magic link (`signInWithOtp`), session subscription, sign-out. |
| `src/lib/sync/supabaseClient.ts` | Singleton `createClient` with PKCE + custom auth storage. |
| `src/lib/sync/syncEngine.ts` | `pullLibraryIfNewer`, `pushLibraryZip`, `forcePushLibraryZip`, head fetch. |
| `src/lib/sync/libraryHeadCache.ts` | Last known `remoteRev` cache in IndexedDB (`inkwell-projects` KV). |
| `src/lib/cloudSync/syncQueue.ts` | Persistent queue, backoff, conflict stop. |
| `src/lib/sync/useInkwellLibrarySync.ts` | React wiring: online/visibility/interval flush, initial pull, conflict handlers. |

## 4. Environment variables (Vite)

| Variable | Required for | Meaning |
|----------|----------------|---------|
| `VITE_INKWELL_CLOUD_BACKUP_URL` | Legacy POST backup | HTTPS POST target for library zip. |
| `VITE_INKWELL_CLOUD_BACKUP_KEY` | No | Optional Bearer for private backup receivers. |
| `VITE_INKWELL_CLOUD_SYNC` | Supabase sync | Truthy (`1`, `true`, …) enables sync UI + engine when URL/key present. |
| `VITE_SUPABASE_URL` | Supabase sync | Project URL. |
| `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase sync | Public client key (JWT **anon** or newer **`sb_publishable_…`** from the dashboard; set one or the other). |

Never commit production secrets; inject via CI or host env for builds.

## 5. Phased delivery (status)

| Milestone | Outcome |
|-----------|---------|
| **M1** | Supabase schema + Storage + email/password sign-in + manual “Sync library now” (bookshelf **Account** menu and Electron **Application** menu); status strip shows **Synced** when signed in, idle, and the durable queue is empty (not a second manual-sync control). |
| **M2** | Initial pull after sign-in; debounced push after local save idle; periodic / visibility / online flush. |
| **M3** | Conflict modal + status strip + queue persistence/backoff. |
| **M4** | Electron `safeStorage`-backed session KV (implemented via main/preload IPC). |
| **M5** | Per-project delta sync, retention/versioning, rate limits (future). |

## 6. Manual test matrix (critical paths)

Run with a **staging** Supabase project. Use two profiles (two browsers or browser + desktop).

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Feature off | No sync env vars | No sync strip; sign-in screen is local-only (or offline-only branch hidden when sync flag off). |
| 2 | Email / password | Enable sync; enter Supabase user email + password; Sign in | Session restores; bookshelf shows email; initial pull runs without error when cloud empty. |
| 3 | First push | Local library with projects; wait idle or Sync now | `library_heads` row appears; Storage has zip under your `user_id/`. |
| 4 | Second device pull | Device B signed same user after A pushed | B imports cloud library (or noop if same rev); toast + reload if data applied. |
| 5 | Conflict | A offline, edit both A and B, push B then A online push | A sees conflict modal; “Keep this device” or “Use cloud” resolves; no silent merge. |
| 6 | Offline queue | Airplane mode; edit; online | Strip leaves offline; push retries with backoff (watch network tab). |
| 7 | Desktop session | Desktop build with sync; sign in; quit app; reopen | Session still valid (encrypted KV); sync works. |
| 8 | Export both | From conflict modal, export both | Two zip downloads (local + cloud). |

Automated browser E2E is not in-repo yet; this matrix is the acceptance checklist for releases touching sync.

## 7. Deprecated / compatibility

- **`VITE_INKWELL_CLOUD_BACKUP_*`:** Still supported for self-hosted POST backup. When Supabase sync is the primary product path, prefer authenticated sync for any public deployment.
