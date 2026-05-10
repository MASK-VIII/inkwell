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

- **Application menu** (Electron `Menu.buildFromTemplate`): Import backup, Export book backup, Export full library backup, **Sync library with cloud** (when the renderer handles the `sync-library-now` action), Toggle theme, plus standard Edit/View roles.
- **Keyboard:** `Ctrl/Cmd+O` import, `Ctrl/Cmd+Shift+E` export current book backup, `Ctrl/Cmd+Shift+Y` sync library (same IPC action as menu), `Ctrl/Cmd+Shift+L` toggle theme.
- **Save dialogs** write **`.inkwell`** for single-book exports (ZIP payload identical to the in-app archive) so **file association** can target a dedicated extension.
- **Open on launch / second instance:** command-line paths matching `*.inkwell`, `*.inkwell.zip`, or `inkwell-library-backup.zip` are read in the main process and delivered to the renderer as a pending import (single-instance lock + `second-instance` on Windows).

`electron-builder` **file association** is declared for extension **`inkwell`** in `package.json` under `"build"`. Browser downloads may still use `.inkwell.zip`; use **File → Import** or rename as needed until export filenames converge.

## Release hardening: auto-update, signing, CI

### Auto-update

Recommended path: add **`electron-updater`** (pairs with `electron-builder` publish config). High level:

1. Configure `build.publish` (e.g. GitHub Releases or S3 + YAML update manifest).
2. In `electron/main.cjs` (main process only), on `app.whenReady`, call `autoUpdater.checkForUpdatesAndNotify()` behind a feature flag for beta channels.
3. Gate downloads behind HTTPS and verify signatures provided by `electron-updater` / your host.

Do **not** run the updater from the renderer; keep trust boundaries in the main process.

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

## Supabase installer hosting (start here if the bucket already exists)

Use this when the GitHub repo is **private** (anonymous `/releases/latest/download/…` returns **404**) but you still want a **public HTTPS** link for the marketing site.

You already created a Storage **bucket**. Finish setup in this order:

1. **Make the bucket public**  
   Supabase Dashboard → **Storage** → your bucket → **Configuration** (or bucket menu) → enable **Public bucket** so objects under `/object/public/…` are readable without a login.

2. **Tell Actions your bucket id (variable or secret)**  
   GitHub repo → **Settings** → **Secrets and variables** → **Actions**  
   - **Variables** → **New repository variable**: Name **`INKWELL_DESKTOP_BUCKET`**, value = bucket id **exactly** as in Supabase (case-sensitive), **or**  
   - **Secrets** → **New repository secret** with the **same name** if you prefer (the workflow accepts either; variable wins if both are set).

3. **Create two GitHub Actions secrets (never commit these)**  
   Same settings page → tab **Secrets** → **New repository secret**  
   - **`SUPABASE_URL`** — project API URL, e.g. `https://abcdefghijklmnop.supabase.co` (no trailing slash). Same host as **Project Settings → API** in Supabase.  
   - **`SUPABASE_SERVICE_ROLE_KEY`** — **service_role** key from the same page. **CI-only.** Do not put this in the web app or Vercel.

4. **Cut a desktop release (CI builds and uploads)**  
   Bump **`version`** in `package.json`, commit, push **`master`**, then either:  
   - **Actions** → **Release desktop (Windows)** → **Run workflow**, or  
   - Push tag **`v<version>`** matching `package.json` (e.g. `v0.8.0` for `0.8.0`).  

   The workflow builds **`release/Inkwell Setup <version>.exe`**, then uploads to your bucket (when the variable is set):  
   - **`Inkwell-Setup-<version>.exe`** (versioned)  
   - **`Inkwell-Setup-latest.exe`** (overwritten each release — use this for a stable marketing URL)

5. **Point the website at the stable URL**  
   In the workflow log, find the line **Public installer URL**. It looks like:  
   `https://<project>.supabase.co/storage/v1/object/public/<bucket>/Inkwell-Setup-latest.exe`  

   Set **Vercel** (Production) environment variable:  
   **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** = that exact URL.  
   Redeploy (or push any commit that triggers a production build). Locally, put the same line in **`.env.local`** for testing.

6. **Sanity check**  
   Paste the URL in a **private/incognito** browser window — it should **download** the `.exe`, not HTML. If you get XML/JSON errors, the bucket is not public or the path is wrong.

If **`INKWELL_DESKTOP_BUCKET`** is unset (neither variable nor secret), the workflow **skips** Supabase upload and only publishes to **GitHub Releases** (unchanged behavior). The job log will show a **Skipping Supabase upload** notice.

## Marketing download URL (website + Vercel)

The NSIS installer for Windows is **`Inkwell Setup <version>.exe`** (from `productName` + `version` in `package.json`). This is **not** `win-unpacked/Inkwell.exe` (that is the unpacked app beside the installer).

The web app bakes a default download URL from **`package.json` version** at build time (`vite.config.ts` → GitHub `releases/latest/download/…`). After you bump version, **redeploy the website** (e.g. push to the branch Vercel builds) so the marketing link matches the uploaded asset name.

**Which GitHub repo?** At build time, `vite.config.ts` resolves **`Owner/repo` from `git remote origin`** (same as `npm run print:desktop-download-url`). If your URL 404s, check **`git remote -v`** matches the repo in the browser (e.g. after an org rename). In CI without a full clone, set **`VITE_INKWELL_GITHUB_OWNER_REPO=Owner/inkwell`**.

**Private repositories:** Unauthenticated visitors often get GitHub’s generic **404** page on `/releases/latest/download/…` (no login prompt). For a public “Download app” button, either **host the `.exe` on a public URL** and set **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`**, or **make the repo public**, or accept that only logged-in collaborators can download from GitHub Releases.

### Automated publishing (recommended)

Workflow **[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)** builds Windows in CI and uploads the NSIS installer to **GitHub Releases** as **Latest**. If **`INKWELL_DESKTOP_BUCKET`** is set (Actions variable or secret) and Supabase secrets are present, it also uploads **`Inkwell-Setup-latest.exe`** to that **public** bucket for **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`**.

**One-time — GitHub Actions permissions**

1. Repo **Settings → Actions → General → Workflow permissions**.
2. Select **Read and write permissions** (required so `GITHUB_TOKEN` can create releases and upload assets).
3. Save.

**Release routine**

1. Bump **`version`** in `package.json` (semver, e.g. `0.8.0`).
2. Commit and push to **`master`** (or your production branch) so **Vercel** runs **`npm run build`** and the site embeds the new download URL.
3. Create and push an **annotated or lightweight tag** whose semver matches `package.json` **exactly** (leading `v` only):

   ```bash
   git tag v0.8.0   # must match package.json 0.8.0
   git push origin v0.8.0
   ```

   The workflow verifies the tag matches `package.json`; then it runs **`npm run build:desktop`** on `windows-latest` and publishes **`release/Inkwell Setup <version>.exe`** to a GitHub Release.

   Alternatively, run **Actions → Release desktop (Windows) → Run workflow** on `master` after bumping `package.json` (no git tag required for this path; the workflow creates/updates the release for `v<version>` at the current commit).

4. Confirm the asset: open the URL from **`npm run print:desktop-download-url`** in a browser — it should download the `.exe`, not HTML.

**Vercel**

- Link the project to this repo and set **Production branch** to `master` (or whatever you use).
- Enable **automatic deployments** on push so you never need a manual “Deploy” for step (2).
- **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** is optional: omit it to use the build-time default from `vite.config.ts`; set it only to override (CDN, fork, or different filename).

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
| GitHub Actions **Release desktop (Windows)** | On push `v*` or manual dispatch: CI builds NSIS and uploads `Inkwell Setup <version>.exe` to GitHub Releases (**Latest**); requires workflow **Read and write** permission |

Installers land in **`release/`** (`package.json` → `build.directories.output`), next to `win-unpacked/` or the macOS `.dmg`. Running **`npm run build:desktop` does not install the app** — use **`npm run build:desktop:install`** or double-click the **`Inkwell Setup … .exe`** file in `release/`.
