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

`electron-builder` can try to unpack tooling that contains symbolic links (for code-sign metadata). On Windows without symlink privileges, that step fails. This repo sets **`build.win.signAndEditExecutable": false`** so local and CI builds produce an NSIS installer without that path. For **retail Windows releases** with a real certificate, turn signing back on and run builds in an environment that can create symlinks (Developer Mode enabled, or elevated CI).

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

## App icon (electron-builder)

`package.json` → `build.icon` references `build/icon.png`. When you change `public/favicon.svg`, run `npm run generate:brand-icons` to regenerate that PNG plus `public/apple-touch-icon.png` before cutting a desktop build.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev:desktop` | Vite (desktop `base`) + Electron against localhost |
| `npm run build:desktop` | Typecheck, Vite production build with `INKWELL_DESKTOP=1`, then `electron-builder` |
| `npm run generate:brand-icons` | Rasterize `public/favicon.svg` → `build/icon.png` (512) and `public/apple-touch-icon.png` (180) |

Installers land in `release/` (see `package.json` → `build.directories.output`).
