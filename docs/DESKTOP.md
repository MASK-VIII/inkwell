# Inkwell desktop packaging

This document records how the desktop shell is wired, why those choices were made, and what remains for shipping signed builds with auto-updates.

## Shell choice: Electron (not Tauri)

**Decision:** wrap the existing Vite + React app with **Electron**.

**Reasons:**

- **Same toolchain as the web app** (TypeScript / Node). No Rust toolchain or MSVC pairing for contributors on Windows.
- **Mature ecosystem** for menus, dialogs, single-instance behavior, and installer targets (NSIS, DMG) via `electron-builder`.
- **Custom protocols** are well documented for serving a static Vite build with a real origin, which keeps **module workers** (`render.worker.ts`) and `fetch` predictable.

**When Tauri is attractive:** smaller install size and lower memory. If the team later standardizes on Rust for other reasons, the UI bundle strategy here (relative `base`, custom origin, no Google Fonts) still applies; only the native shell and IPC layer would change.

## Custom protocol and Vite `base`

**Problem:** loading `dist/index.html` over `file://` often causes subtle issues with ES module workers, resolution, and sometimes storage expectations.

**Approach:**

1. **Production:** Electron registers a privileged scheme **`inkwell`** and `protocol.handle('inkwell', …)` serves files from the Vite `dist/` directory with safe path containment (`path.relative` guard). The window loads **`inkwell://app/index.html`**, so the app origin is stable and same-origin rules match a normal web deployment.
2. **Development:** Electron loads **`http://localhost:5173`** — the same origin as **`npm run dev`** in the browser — so local projects and Supabase session storage match. Workers and HMR behave like browser dev.

**Desktop dev performance:** by default, **`npm run dev:desktop`** does **not** auto-open Chromium DevTools (they add a lot of main-thread overhead while typing and using menus). Use **`npm run dev:desktop:debug`** or set **`INKWELL_ELECTRON_DEVTOOLS=1`** on the Electron process when you need the detached DevTools window.
3. **Vite `base`:** when `INKWELL_DESKTOP=1`, `vite.config.ts` sets `base: './'` so generated asset URLs resolve under `inkwell://app/…` instead of absolute `/…` paths meant for static hosting at domain root.

Entry: `electron/main.cjs`, preload: `electron/preload.cjs`. Renderer integration lives in `src/App.tsx` (menu + pending file open) behind `window.inkwellDesktop` (see `src/inkwell-desktop.d.ts`).

## Sync and accounts (Supabase)

When **`VITE_INKWELL_CLOUD_SYNC`** and Supabase public env vars are set in the **renderer** build (same as web), the app uses the shared sync stack in `src/lib/sync/*`. For **session persistence**, the preload exposes `inkwellDesktop.authStorage` (`getItem` / `setItem` / `removeItem` via async IPC). The main process stores a small JSON map encrypted with Electron **`safeStorage`** when the OS supports it (`inkwell:auth-kv-*` handlers in `electron/main.cjs`); otherwise it falls back to UTF-8 plaintext in the user data directory (acceptable only for local dev — prefer a machine with encryption available for real use).

Web builds continue to use normal `localStorage` for Supabase session keys unless you inject a custom storage adapter.

See **`docs/CLOUD_SYNC.md`** for schema, RLS, conflict rules, and the manual test matrix.

### Sign-in screen shows only “Welcome” / offline on desktop

If the packaged app opens to **Welcome** with **Continue to library (offline)** and **no** email or password fields, the **renderer was built without** `VITE_INKWELL_CLOUD_SYNC` and Supabase URL/key. Cloud login is not missing at runtime—it was never compiled in. Fix by setting the variables below in **`.env.local`** (or your CI secrets), then **`npm run build:desktop`** again and reinstall.

If **email and password fields appear** but sign-in never completes or always fails, the build has cloud env (see CI **Verify renderer bundle inlined Supabase env**). On Windows, encrypted auth storage uses main-process IPC; the shell must trust the `inkwell://app/` window. If Electron reports an empty `senderFrame.url` for that protocol, Inkwell falls back to `webContents.getURL()` so `inkwell:auth-kv-*` handlers still run—update to a build that includes that fallback (`electron/main.cjs`).

### Vite env is compile-time for desktop

Copy **`.env.example`** to **`.env.local`** in the repo root and set, at minimum:

- **`VITE_INKWELL_CLOUD_SYNC=1`** (or `true`) to enable the feature gate.
- **`VITE_SUPABASE_URL`** — the full project URL including **`https://`** (for example `https://xxxx.supabase.co`), as shown in Supabase **Project Settings → API**.
- **`VITE_SUPABASE_ANON_KEY`** *or* **`VITE_SUPABASE_PUBLISHABLE_KEY`** — one non-empty key from the same settings page.

Then run **`npm run build:desktop`** (or `npm run dev:desktop`) so Vite inlines those `VITE_*` values into the renderer bundle. Editing `.env.local` after a build does **not** change an existing `release/*.exe` until you rebuild. Unsigned CI builds that omit these variables ship with cloud sync effectively off.

### Magic-link redirect (`inkwell://`) and the OS

Packaged desktop loads the UI from **`inkwell://app/`** (see *Custom protocol* above). Magic-link **`emailRedirectTo`** uses that origin so Supabase can redirect back into the app. The installer registers the **`inkwell`** protocol with the OS (`package.json` → `build.protocols`), and **`electron/main.cjs`** calls **`app.setAsDefaultProtocolClient('inkwell')`**, handles **`open-url`** (macOS), and **`second-instance`** argv (Windows/Linux) so callback URLs are loaded in the existing window for PKCE session detection in the renderer.

Add the same redirect URLs under Supabase **Authentication → URL configuration** (for example `inkwell://app/` with any path/query your app uses, plus dev `http://localhost:5173/...` as needed).

## Offline UI fonts

Google Fonts were removed from `index.html` and the CSP. **Inter** and **Playfair Display** weights used by the UI are imported from **`@fontsource/*`** in `src/main.tsx`, matching the `--font-sans` / `--font-serif` tokens in `src/index.css`.

## Native menu and files

- **Application menu** (Electron `Menu.buildFromTemplate`): Import backup, Export book backup, Export full library backup, **Sync library with cloud** (when the renderer handles the `sync-library-now` action), Toggle theme, **Check for updates…** (packaged Windows only), plus standard Edit/View roles.
- **Keyboard:** `Ctrl/Cmd+O` import, `Ctrl/Cmd+Shift+E` export current book backup, `Ctrl/Cmd+Shift+Y` sync library (same IPC action as menu), `Ctrl/Cmd+Shift+L` toggle theme.
- **Save dialogs** write **`.inkwell`** for single-book exports (ZIP payload identical to the in-app archive) so **file association** can target a dedicated extension.
- **Open on launch / second instance:** command-line paths matching `*.inkwell`, `*.inkwell.zip`, or `inkwell-library-backup.zip` are read in the main process and delivered to the renderer as a pending import (single-instance lock + `second-instance` on Windows).

`electron-builder` **file association** is declared for extension **`inkwell`** in `package.json` under `"build"`. Browser downloads may still use `.inkwell.zip`; use **File → Import** or rename as needed until export filenames converge.

## Release hardening: auto-update, signing, CI

### Auto-update (implemented)

Inkwell ships **`electron-updater`** in the **main process** (`electron/main.cjs`) for **packaged Windows** builds:

- **`package.json`** declares **`repository`** (GitHub URL) and **`build.publish`** with **`provider: "github"`** so `electron-builder` emits **`release/latest.yml`** (and **`*.blockmap`**) next to the NSIS installer. Those files must live on the **same** GitHub Release as the `.exe` (`v<version>` tag matching **`package.json`**).
- **CI:** **[`desktop-publish-master.yml`](../.github/workflows/desktop-publish-master.yml)** and **[`release-desktop.yml`](../.github/workflows/release-desktop.yml)** verify `latest.yml` exists and upload it (and blockmaps) alongside **`Inkwell Setup <version>.exe`**.
- **Runtime:** ~12s after the first successful load, the app checks GitHub in the background, **auto-downloads** newer installers, and shows an in-app **“Update ready”** banner with **Restart now** / **Later** once the download finishes. **View → Check for updates…** runs the same check immediately (native dialog if already up to date or on error).

**Not automatic in the sense of the website:** the **web** app updates when Vercel deploys. The **desktop** binary only changes when CI publishes a new installer; users pick it up via this updater (or by re-downloading). Forks should adjust **`package.json` → `repository.url`** if releases live under another org/repo.

Do **not** run the updater from the renderer; IPC bridges are exposed only via **`electron/preload.cjs`**.

### Windows packaging without Developer Mode

`electron-builder` can try to unpack tooling that contains symbolic links (for code-sign metadata). On Windows without symlink privileges, that step can fail.

**Custom app icon (`.exe` + shortcuts):** Windows embeds the icon by **editing the executable** (rcedit). If you set **`build.win.signAndEditExecutable` to `false`**, that step is skipped and the packaged **`Inkwell.exe` keeps the default Electron icon**, even if your installer and `build/icon.ico` look correct. This repo leaves **`signAndEditExecutable` at the default (true)** so the emblem is applied. If a build fails on symlink limits, enable **Developer Mode** (or use a CI image that can create symlinks) rather than turning this off, or you will lose the custom Windows icon.

### Code signing

| Platform | What buyers expect | Practical notes |
|----------|---------------------|-----------------|
| **Windows** | Authenticode (EV cert strongly recommended for SmartScreen reputation) | Sign the installer and bundled `.exe` (electron-builder `win.certificateFile` / `CSC_LINK` + `CSC_KEY_PASSWORD` or Azure Key Vault). |
| **macOS** | Apple Developer ID + **notarization** | Requires Apple account, hardened runtime entitlements, `notarize` step in CI; unsigned DMGs alarm Gatekeeper. |

For **unsigned CI artifacts** (PRs / forks), set `CSC_IDENTITY_AUTO_DISCOVERY=false` so `electron-builder` skips signing and still produces installable test builds where policy allows.

### CI build matrix

Use a **matrix** over OS so native binaries are produced on real hosts:

| `runs-on` | Targets |
|-----------|---------|
| `windows-latest` | NSIS (`.exe`) from `npm run build:desktop` |
| `macos-latest` | DMG (or `zip` for faster CI artifacts) |

**Suggested workflow shape:**

1. Checkout, `actions/setup-node` with npm cache, `npm ci`.
2. `npm run build` for web regression (optional but cheap).
3. `npm run build:desktop` with `CSC_IDENTITY_AUTO_DISCOVERY=false` unless release tags + secrets present.
4. Upload `release/*` as workflow artifacts; on tagged releases, attach to GitHub Releases and run signing/notarization only on protected branches.

The repository includes `.github/workflows/desktop.yml` as a minimal unsigned matrix build; tighten secrets and signing steps when you are ready to ship.

### GitHub Actions secrets (installers from the website / Releases)

Shipped **Windows** installers are built with **`npm run build:desktop`**, which bakes **Vite** env into the renderer at compile time. If **`VITE_SUPABASE_*`** is missing in CI, users only see the offline **Welcome** screen (no email login).

**Repository secrets** (Settings → Secrets and variables → Actions) — use the **same names and values** as `.env.local` for the web app:

| Secret | Required for release workflow | Notes |
|--------|-------------------------------|--------|
| `VITE_SUPABASE_URL` | Yes | Full `https://…supabase.co` project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | One of the two keys | Preferred new key name |
| `VITE_SUPABASE_ANON_KEY` | **or** publishable above | Legacy anon JWT; either key is enough |
| `VERCEL_DEPLOY_HOOK_URL` | No | Vercel **Deploy Hook** URL; **[`desktop-publish-master.yml`](../.github/workflows/desktop-publish-master.yml)** POSTs after upload so Production can redeploy |

**[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)** and **[`.github/workflows/desktop-publish-master.yml`](../.github/workflows/desktop-publish-master.yml)** set **`VITE_INKWELL_CLOUD_SYNC=1`** for the build and **fail early** if URL or keys are missing, so you do not publish a login-less installer by mistake. Both run **`scripts/verify-desktop-renderer-inlined-supabase.mjs`** after **`vite build`** so the packaged app cannot pass CI if Supabase values were not inlined into **`dist/`**.

**[`.github/workflows/desktop.yml`](../.github/workflows/desktop.yml)** passes the same secrets when present (fork PRs without secrets still produce offline-only artifacts).

### Continuous desktop installer (master)

Every push to **`master`** runs **[`.github/workflows/desktop-publish-master.yml`](../.github/workflows/desktop-publish-master.yml)**. It builds **`npm run build:desktop`** with the same **`VITE_*`** secrets as **Release desktop**, runs **`scripts/verify-desktop-renderer-inlined-supabase.mjs`** so a bad Windows env cannot ship an offline-only bundle silently, then either **creates** a GitHub Release for **`v<package.json version>`** (if none exists yet) or **re-uploads** the NSIS file with **`gh release upload … --clobber`**, keeping the asset name **`Inkwell Setup <version>.exe`** aligned with **[`scripts/fetch-desktop-installer-for-vercel.mjs`](../scripts/fetch-desktop-installer-for-vercel.mjs)** (which resolves **`v${version}`** from `package.json`).

Requirements:

- The same **repository secrets** in the table above (`VITE_SUPABASE_URL` plus one key). If they are missing, the workflow **stops after the gate step** and skips build/publish (green run with a notice — GitHub does not allow `secrets` in job-level `if`, so this uses a gate step instead).
- **Settings → Actions → General → Workflow permissions → Read and write** (same as tag releases).

Optional **Actions** secret **`VERCEL_DEPLOY_HOOK_URL`**: a Vercel **Deploy Hook** URL. After the `.exe` is on GitHub, the workflow **POST**s to it so Production can redeploy once the release asset exists (tighter than relying only on the fetch script’s polling when the Windows job finishes after the first Vercel build).

Tag-based **[`release-desktop.yml`](../.github/workflows/release-desktop.yml)** stays the path for **`v*`** pushes and **`workflow_dispatch`** with the stricter **tag must match package.json** check.

After adding secrets, run **Release desktop** again (tag or `workflow_dispatch`) **or** rely on **Publish desktop installer (master)** on each **`master`** push; let Vercel production rebuild (or use the deploy hook) if you use **`fetch-desktop-installer-for-vercel.mjs`** so **`/downloads/Inkwell-Setup-latest.exe`** picks up the new binary.

## Vercel same-origin installer (private GitHub repo; no large-file Storage)

When the repo stays **private**, anonymous **`/releases/latest/download/…`** still **404**s. Instead of committing a **~120 MB** `.exe` (GitHub blocks blobs **> ~100 MB**) or paying for larger Storage quotas, **production Vercel builds** can **download** the installer from the GitHub API using a **read-only PAT**, then ship it as a static file.

**Flow**

1. **[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)** (tags / manual) or **[`.github/workflows/desktop-publish-master.yml`](../.github/workflows/desktop-publish-master.yml)** (every **`master`** push) publishes **`Inkwell Setup <version>.exe`** to a GitHub Release tagged **`v<version>`**.
2. **`npm run build`** on Vercel runs [**`scripts/fetch-desktop-installer-for-vercel.mjs`**](../scripts/fetch-desktop-installer-for-vercel.mjs) **before** `vite build` when **`VERCEL=1`** and **`VERCEL_ENV=production`** (or when **`INKWELL_FETCH_DESKTOP_INSTALLER=1`** for local testing).
3. The script polls GitHub until that release asset exists (desktop CI can take several minutes after you bump **`package.json`**), then writes **`public/downloads/Inkwell-Setup-latest.exe`** (gitignored).
4. Vercel should serve **`/downloads/Inkwell-Setup-latest.exe`** as a static file from the build output. If the installer was **not** fetched (missing PAT, failed CI, etc.), that URL may fall through to **`index.html`** — you would see the **marketing landing**, not an in-app 404, after routing fixes. Check the **production build log** for **`[fetch-desktop-installer] done`**.

**Vercel configuration**

| Variable / secret | Purpose |
|-------------------|---------|
| **`INKWELL_GITHUB_RELEASE_TOKEN`** (secret) | Classic GitHub PAT with **`repo`** scope (read-only suffices). **Never** expose to the client; Vercel build env only. |
| **`INKWELL_GITHUB_OWNER_REPO`** (optional) | `Owner/repo` if Vercel clone has no useful **`origin`** (otherwise same as **`VITE_INKWELL_GITHUB_OWNER_REPO`**). |
| **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** | Set to **`https://<your-domain>/downloads/Inkwell-Setup-latest.exe`** or the origin-relative **`/downloads/Inkwell-Setup-latest.exe`** (supported by [`src/lib/marketing/desktopDownloadUrl.ts`](../src/lib/marketing/desktopDownloadUrl.ts)). |

Preview deployments **skip** the fetch by default (avoids downloading ~120 MB per PR). To fetch on preview too, set **`INKWELL_FETCH_DESKTOP_INSTALLER_ON_PREVIEW=1`**.

**Operational note:** If you bump **`package.json`** and push, **Vercel** and **desktop** workflows may start together; the script **retries** (about **15 minutes** total) until the release asset appears. Optional **`VERCEL_DEPLOY_HOOK_URL`** on **Publish desktop installer (master)** triggers a second Production deploy after the `.exe` lands. If the desktop workflow is disabled or fails, the **production** build fails at this step — fix CI or temporarily remove the PAT / override URL.

### Alternative: public GitHub repo (simplest hosting)

Make the repository **public**. Anonymous **`/releases/latest/download/…`** works with no PAT and no fetch step. Clear **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** on Vercel to use the default URL from **`vite.config.ts`** (same shape as **`npm run print:desktop-download-url`**).

### Optional: host the installer URL elsewhere (e.g. Storage CDN)

You can set **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** to any **HTTPS** URL that serves the NSIS file (Supabase Storage, R2, etc.). Free Storage tiers often cap object size below a typical Electron installer (~**120 MB**). This repo’s **[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)** publishes **only** to **GitHub Releases**; there is **no** automated Storage upload step. If you previously added GitHub Actions secrets **`SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`**, or variable **`INKWELL_DESKTOP_BUCKET`** only for installer uploads, you can delete them to reduce clutter.

## Marketing download URL (website + Vercel)

The NSIS installer for Windows is **`Inkwell Setup <version>.exe`** (from `productName` + `version` in `package.json`). This is **not** `win-unpacked/Inkwell.exe` (that is the unpacked app beside the installer).

The web app bakes a default download URL from **`package.json` version** at build time (`vite.config.ts` → GitHub `releases/latest/download/…`). After you bump version, **redeploy the website** (e.g. push to the branch Vercel builds) so the marketing link matches the uploaded asset name.

**Which GitHub repo?** At build time, `vite.config.ts` resolves **`Owner/repo` from `git remote origin`** (same as `npm run print:desktop-download-url`). If your URL 404s, check **`git remote -v`** matches the repo in the browser (e.g. after an org rename). In CI without a full clone, set **`VITE_INKWELL_GITHUB_OWNER_REPO=Owner/inkwell`**.

**Private repositories:** Unauthenticated visitors often get GitHub’s generic **404** page on `/releases/latest/download/…` (no login prompt). For a public “Download app” button, prefer **Vercel same-origin fetch** (above), **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** to any public HTTPS binary URL, or **make the repo public**.

### Automated publishing (recommended)

Workflow **[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)** builds Windows in CI and uploads **`Inkwell Setup <version>.exe`** to **GitHub Releases** as **Latest** (source for **Vercel**’s optional fetch step above).

**One-time — GitHub Actions permissions**

1. Repo **Settings → Actions → General → Workflow permissions**.
2. Select **Read and write permissions** (required so `GITHUB_TOKEN` can create releases and upload assets).
3. Save.

**Release routine**

1. Bump **`version`** in `package.json` (semver, e.g. `1.0.0`).
2. Commit and push to **`master`** (or your production branch) so **Vercel** runs **`npm run build`** and the site embeds the new download URL.
3. Create and push an **annotated or lightweight tag** whose semver matches `package.json` **exactly** (leading `v` only):

   ```bash
   git tag v1.0.0   # must match package.json 1.0.0
   git push origin v1.0.0
   ```

   The workflow verifies the tag matches `package.json`; then it runs **`npm run build:desktop`** on `windows-latest` and publishes **`release/Inkwell Setup <version>.exe`** to a GitHub Release.

   Alternatively, run **Actions → Release desktop (Windows) → Run workflow** on `master` after bumping `package.json` (no git tag required for this path; the workflow creates/updates the release for `v<version>` at the current commit).

4. Confirm the asset: open the URL from **`npm run print:desktop-download-url`** in a browser — it should download the `.exe`, not HTML.

**Vercel**

- Link the project to this repo and set **Production branch** to `master` (or whatever you use).
- Enable **automatic deployments** on push so you never need a manual “Deploy” for step (2).
- **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** is optional: omit it to use the build-time default from `vite.config.ts`; set it to override (same-site **`/downloads/…`**, Supabase, CDN, fork). **`INKWELL_GITHUB_RELEASE_TOKEN`** on Vercel only affects the optional fetch script — never prefix with **`VITE_`** (that would expose it to the browser).

### Manual publishing (fallback)

1. Run **`npm run build:desktop`** and find **`Inkwell Setup … .exe`** under **`release/`** (see `package.json` → `build.directories.output`).
2. **`npm run print:desktop-download-url`** prints the exact GitHub asset URL.
3. Create a GitHub **Release** and upload that `.exe` under **Assets** using the **exact** filename (spaces matter).

The public **`/releases/latest/download/…`** link works only after that asset exists on the repo’s **Latest** non-prerelease release.

## App icon (electron-builder)

`package.json` → `build.icon` references `build/icon.png`. When you change `public/favicon.svg`, run `npm run generate:brand-icons` to regenerate that PNG plus `public/apple-touch-icon.png` before cutting a desktop build.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev:desktop` | Vite (desktop `base`) + Electron against localhost |
| `npm run build:desktop` | Typecheck, Vite production build with `INKWELL_DESKTOP=1`, then `electron-builder` (writes installers under `release/`) |
| `npm run build:desktop:install` | Same as above, then launches the Windows NSIS installer or opens the macOS `.dmg` |
| `npm run generate:brand-icons` | Rasterize `public/favicon.svg` → `build/icon.png` (512) and `public/apple-touch-icon.png` (180) |
| `npm run print:desktop-download-url` | Print `VITE_INKWELL_DESKTOP_DOWNLOAD_URL` for the Windows NSIS installer (GitHub Releases **latest** asset pattern) |
| `scripts/fetch-desktop-installer-for-vercel.mjs` | Invoked from **`npm run build`** on Vercel production (or when **`INKWELL_FETCH_DESKTOP_INSTALLER=1`**): downloads Release **`Inkwell Setup <version>.exe`** via GitHub API → **`public/downloads/Inkwell-Setup-latest.exe`** |
| GitHub Actions **Release desktop (Windows)** | On push `v*` or manual dispatch: CI builds NSIS and uploads `Inkwell Setup <version>.exe` to GitHub Releases (**Latest**); requires workflow **Read and write** permission |
| GitHub Actions **Publish desktop installer (master)** | On every push to **`master`**: same NSIS build + create or **clobber**-upload the release asset for **`v<version>`**; optional **`VERCEL_DEPLOY_HOOK_URL`** secret |

Installers land in **`release/`** (`package.json` → `build.directories.output`), next to `win-unpacked/` or the macOS `.dmg`. Running **`npm run build:desktop` does not install the app** — use **`npm run build:desktop:install`** or double-click the **`Inkwell Setup … .exe`** file in `release/`.
