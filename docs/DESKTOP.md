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
2. **Development:** Electron loads **`http://localhost:5173`** — the same origin as **`npm run dev`** in the browser. Workers and HMR behave like browser dev.

**Desktop dev performance:** by default, **`npm run dev:desktop`** does **not** auto-open Chromium DevTools (they add a lot of main-thread overhead while typing and using menus). Use **`npm run dev:desktop:debug`** or set **`INKWELL_ELECTRON_DEVTOOLS=1`** on the Electron process when you need the detached DevTools window.
3. **Vite `base`:** when `INKWELL_DESKTOP=1`, `vite.config.ts` sets `base: './'` so generated asset URLs resolve under `inkwell://app/…` instead of absolute `/…` paths meant for static hosting at domain root.

Entry: `electron/main.cjs`, preload: `electron/preload.cjs`. Renderer integration lives in `src/App.tsx` (menu + pending file open) behind `window.inkwellDesktop` (see `src/inkwell-desktop.d.ts`).

## Local-first library

Inkwell desktop is **local-only**: manuscripts and settings live on your device. Use **File → Export** menus or in-app archive export to back up your library. No cloud sign-in or sync is required.

## Offline UI fonts

Google Fonts were removed from `index.html` and the CSP. **Inter** and **Playfair Display** weights used by the UI are imported from **`@fontsource/*`** in `src/main.tsx`, matching the `--font-sans` / `--font-serif` tokens in `src/index.css`.

## Native menu and files

- **Application menu** (Electron `Menu.buildFromTemplate`): Import backup, Export book backup, Export full library backup, Toggle theme, **Check for updates…** (packaged Windows only), plus standard Edit/View roles.
- **Keyboard:** `Ctrl/Cmd+O` import, `Ctrl/Cmd+Shift+E` export current book backup, `Ctrl/Cmd+Shift+L` toggle theme.
- **Save dialogs** write **`.inkwell`** for single-book exports (ZIP payload identical to the in-app archive) so **file association** can target a dedicated extension.
- **Open on launch / second instance:** command-line paths matching `*.inkwell`, `*.inkwell.zip`, or `inkwell-library-backup.zip` are read in the main process and delivered to the renderer as a pending import (single-instance lock + `second-instance` on Windows).

`electron-builder` **file association** is declared for extension **`inkwell`** in `package.json` under `"build"`. Browser downloads may still use `.inkwell.zip`; use **File → Import** or rename as needed until export filenames converge.

## Release hardening: auto-update, signing, CI

### Auto-update (implemented)

Inkwell ships **`electron-updater`** in the **main process** (`electron/main.cjs`) for **packaged Windows** builds:

- **`package.json`** declares **`repository`** (GitHub URL) and **`build.publish`** with **`provider: "github"`** so `electron-builder` emits **`release/latest.yml`** (and **`*.blockmap`**) next to the NSIS installer. Those files must live on the **same** GitHub Release as the `.exe` (`v<version>` tag matching **`package.json`**).
- **CI (manual only):** **[`desktop-publish-master.yml`](../.github/workflows/desktop-publish-master.yml)** (**Publish desktop installer**) and **[`release-desktop.yml`](../.github/workflows/release-desktop.yml)** verify `latest.yml` exists and upload it (and blockmaps) alongside **`Inkwell-Setup-<version>.exe`**. Neither runs on ordinary `master` pushes — you trigger them when you want a new desktop build.
- **Runtime:** ~12s after the first successful load, the app checks GitHub in the background, **auto-downloads** newer installers, and shows an in-app **“Update ready”** banner with **Restart now** / **Later** once the download finishes. **View → Check for updates…** runs the same check immediately (native dialog if already up to date or on error).

**Not automatic in the sense of the website:** the **web** app updates when Vercel deploys. The **desktop** binary only changes when you **manually** publish a new installer (Actions or a `v*` tag); users pick it up via this updater (or by re-downloading). Forks should adjust **`package.json` → `repository.url`** if releases live under another org/repo.

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

The repository includes `.github/workflows/desktop.yml` as an optional **manual** unsigned matrix build (`workflow_dispatch` only).

### GitHub Actions (installers from the website / Releases)

Shipped **Windows** installers are built with **`npm run build:desktop`**. No cloud secrets are required — desktop and web builds are local-first.

| Secret | Required | Notes |
|--------|----------|--------|
| `VERCEL_DEPLOY_HOOK_URL` | No | Vercel **Deploy Hook** URL; **Publish desktop installer** POSTs after upload so Production can redeploy |

**Desktop is not rebuilt on every web push.** Use one of:

| Workflow | When to use |
|----------|-------------|
| **[Publish desktop installer](../.github/workflows/desktop-publish-master.yml)** | Actions → Run workflow (recommended day-to-day) |
| **[Release desktop (Windows)](../.github/workflows/release-desktop.yml)** | Push tag `v*` matching `package.json`, or manual dispatch |

Both build NSIS, write **`latest.yml`** with the exact asset filename **`Inkwell-Setup-<version>.exe`**, and upload to GitHub Release **`v<version>`**.

Requirements:

- **Settings → Actions → General → Workflow permissions → Read and write**.

Optional **Actions** secret **`VERCEL_DEPLOY_HOOK_URL`**: after the `.exe` lands, the publish workflow can **POST** so Production redeploys and refreshes **`/downloads/Inkwell-Setup-latest.exe`**.

## Vercel same-origin installer (private GitHub repo; no large-file Storage)

When the repo stays **private**, anonymous **`/releases/latest/download/…`** still **404**s. Instead of committing a **~120 MB** `.exe` (GitHub blocks blobs **> ~100 MB**) or paying for larger Storage quotas, **production Vercel builds** can **download** the installer from the GitHub API using a **read-only PAT**, then ship it as a static file.

**Flow**

1. You run **Publish desktop installer** (or tag **`v*`**) so **`Inkwell-Setup-<version>.exe`** lands on GitHub Release **`v<version>`**.
2. **`npm run build`** on Vercel runs [**`scripts/fetch-desktop-installer-for-vercel.mjs`**](../scripts/fetch-desktop-installer-for-vercel.mjs) **before** `vite build` when **`VERCEL=1`** and **`VERCEL_ENV=production`** (or when **`INKWELL_FETCH_DESKTOP_INSTALLER=1`** for local testing).
3. The script prefers tag **`v${version}`**, briefly retries, then falls back to **`/releases/latest`**, and writes **`public/downloads/Inkwell-Setup-latest.exe`** (gitignored).
4. Vercel should serve **`/downloads/Inkwell-Setup-latest.exe`** as a static file from the build output. If the installer was **not** fetched (missing PAT, no release yet, etc.), that URL may fall through to **`index.html`**. Check the **production build log** for **`[fetch-desktop-installer] done`**.

**Vercel configuration**

| Variable / secret | Purpose |
|-------------------|---------|
| **`INKWELL_GITHUB_RELEASE_TOKEN`** (secret) | Classic GitHub PAT with **`repo`** scope (read-only suffices). **Never** expose to the client; Vercel build env only. |
| **`INKWELL_GITHUB_OWNER_REPO`** (optional) | `Owner/repo` if Vercel clone has no useful **`origin`** (otherwise same as **`VITE_INKWELL_GITHUB_OWNER_REPO`**). |
| **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** | Set to **`https://<your-domain>/downloads/Inkwell-Setup-latest.exe`** or the origin-relative **`/downloads/Inkwell-Setup-latest.exe`** (supported by [`src/lib/marketing/desktopDownloadUrl.ts`](../src/lib/marketing/desktopDownloadUrl.ts)). |

Preview deployments **skip** the fetch by default (avoids downloading ~120 MB per PR). To fetch on preview too, set **`INKWELL_FETCH_DESKTOP_INSTALLER_ON_PREVIEW=1`**.

**Operational note:** Bump **`package.json` `version`**, push the web change, then **separately** run **Publish desktop installer**. Prefer publishing desktop **before** (or with) the deploy hook so Production can fetch **`v{version}`**. Until that release exists, the fetch script uses **`/releases/latest`**. Set **`INKWELL_SKIP_DESKTOP_INSTALLER_FETCH=1`** on Vercel only as an emergency bypass.

### Alternative: public GitHub repo (simplest hosting)

Make the repository **public**. Anonymous **`/releases/latest/download/…`** works with no PAT and no fetch step. Clear **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** on Vercel to use the default URL from **`vite.config.ts`** (same shape as **`npm run print:desktop-download-url`**).

### Optional: host the installer URL elsewhere (CDN)

You can set **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** to any **HTTPS** URL that serves the NSIS file (R2, S3, etc.). Some free object-storage tiers cap object size below a typical Electron installer (~**120 MB**). This repo’s **[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)** publishes **only** to **GitHub Releases**.

## Marketing download URL (website + Vercel)

The NSIS installer for Windows is **`Inkwell-Setup-<version>.exe`** (`package.json` → `build.win.artifactName`). This is **not** `win-unpacked/Inkwell.exe` (that is the unpacked app beside the installer). Stable hyphenated names keep GitHub Release assets and **`latest.yml`** in sync for electron-updater.

The web app bakes a default download URL from **`package.json` version** at build time (`vite.config.ts` → GitHub `releases/latest/download/…`). After you bump version **and** publish desktop, **redeploy the website** (or use the deploy hook) so the marketing link matches the uploaded asset.

**Which GitHub repo?** At build time, `vite.config.ts` resolves **`Owner/repo` from `git remote origin`** (same as `npm run print:desktop-download-url`). If your URL 404s, check **`git remote -v`** matches the repo in the browser (e.g. after an org rename). In CI without a full clone, set **`VITE_INKWELL_GITHUB_OWNER_REPO=Owner/inkwell`**.

**Private repositories:** Unauthenticated visitors often get GitHub’s generic **404** page on `/releases/latest/download/…` (no login prompt). For a public “Download app” button, prefer **Vercel same-origin fetch** (above), **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** to any public HTTPS binary URL, or **make the repo public**.

### Automated publishing (recommended)

Workflow **[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml)** (or **Publish desktop installer**) builds Windows in CI and uploads **`Inkwell-Setup-<version>.exe`** to **GitHub Releases** as **Latest** (source for **Vercel**’s optional fetch step above).

**One-time — GitHub Actions permissions**

1. Repo **Settings → Actions → General → Workflow permissions**.
2. Select **Read and write permissions** (required so `GITHUB_TOKEN` can create releases and upload assets).
3. Save.

**Release routine (desktop only when you choose)**

1. Bump **`version`** in `package.json` (semver, e.g. `1.1.0`) when the desktop app should advertise a new version.
2. Commit and push to **`master`** for the **web** deploy (does **not** publish desktop by itself).
3. Ship desktop explicitly — either:

   - GitHub Actions → **Publish desktop installer** → Run workflow, **or**
   - Tag matching `package.json` exactly:

   ```bash
   git tag v1.1.0   # must match package.json 1.1.0
   git push origin v1.1.0
   ```

   CI runs **`npm run build:desktop`** on `windows-latest` and publishes **`release/Inkwell-Setup-<version>.exe`** + **`latest.yml`**.

   Alternatively, run **Actions → Release desktop (Windows) → Run workflow** on `master` after bumping `package.json` (no git tag required for this path; the workflow creates/updates the release for `v<version>` at the current commit).

4. Confirm the asset: open the URL from **`npm run print:desktop-download-url`** in a browser — it should download the `.exe`, not HTML.

**Vercel**

- Link the project to this repo and set **Production branch** to `master` (or whatever you use).
- Enable **automatic deployments** on push so you never need a manual “Deploy” for step (2).
- **`VITE_INKWELL_DESKTOP_DOWNLOAD_URL`** is optional: omit it to use the build-time default from `vite.config.ts`; set it to override (same-site **`/downloads/…`**, CDN, fork). **`INKWELL_GITHUB_RELEASE_TOKEN`** on Vercel only affects the optional fetch script — never prefix with **`VITE_`** (that would expose it to the browser).

### Manual publishing (fallback)

1. Run **`npm run build:desktop`** and find **`Inkwell-Setup-….exe`** under **`release/`** (see `package.json` → `build.directories.output`).
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
| `scripts/fetch-desktop-installer-for-vercel.mjs` | Invoked from **`npm run build`** on Vercel production (or when **`INKWELL_FETCH_DESKTOP_INSTALLER=1`**): downloads Release **`Inkwell-Setup-<version>.exe`** via GitHub API → **`public/downloads/Inkwell-Setup-latest.exe`** |
| GitHub Actions **Publish desktop installer** | **Manual** (`workflow_dispatch`): NSIS + upload/clobber **`v<version>`**; optional **`VERCEL_DEPLOY_HOOK_URL`** |
| GitHub Actions **Release desktop (Windows)** | On push `v*` or manual dispatch: same publish path; tag must match `package.json` |
| GitHub Actions **Desktop build** | **Manual** smoke matrix (Windows + macOS artifacts); does not publish Releases |

Installers land in **`release/`** (`package.json` → `build.directories.output`), next to `win-unpacked/` or the macOS `.dmg`. Running **`npm run build:desktop` does not install the app** — use **`npm run build:desktop:install`** or double-click the **`Inkwell-Setup-….exe`** file in `release/`.
