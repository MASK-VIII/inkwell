import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const desktop = process.env.INKWELL_DESKTOP === '1'

const packageRoot = dirname(fileURLToPath(import.meta.url))

/** Same idea as `scripts/print-desktop-download-url.mjs` — never hardcode org in the default URL. */
function gitHubOwnerRepoForDownloadLink(): string {
  const fromEnv = process.env.VITE_INKWELL_GITHUB_OWNER_REPO?.trim()
  if (fromEnv && /^[\w.-]+\/[\w.-]+$/.test(fromEnv)) {
    return fromEnv
  }
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const m =
      url.match(/git@github\.com:([^/]+)\/([^/.]+)/i) ?? url.match(/github\.com[:/]([^/]+)\/([^/.]+)/i)
    if (m) return `${m[1]}/${m[2]}`
  } catch {
    // e.g. no .git, shallow clone without remote
  }
  return 'MASK-VIII/inkwell'
}

const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
  version?: string
  build?: { productName?: string }
}
const productName = pkg.build?.productName ?? 'Inkwell'
const appVersion = String(pkg.version ?? '0.0.0')
const installerFilename = `${productName} Setup ${appVersion}.exe`
const ownerRepo = gitHubOwnerRepoForDownloadLink()
/** Vercel production fetches the `.exe` into `public/downloads/`; same-origin avoids anonymous GitHub 404 on private repos. */
const vercelProductionWeb =
  process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production' && !desktop
/** GitHub Releases “latest” asset URL; matches `npm run print:desktop-download-url`. */
const inkwellDesktopDownloadDefault =
  vercelProductionWeb ?
    '/downloads/Inkwell-Setup-latest.exe'
  : `https://github.com/${ownerRepo}/releases/latest/download/${encodeURIComponent(installerFilename)}`

// https://vite.dev/config/
// Desktop (Electron production) loads from a custom origin (`inkwell://app/`) so asset
// URLs must be relative (`./`). Web builds keep `/` for normal hosting.
export default defineConfig({
  base: desktop ? './' : '/',
  define: {
    __INKWELL_DESKTOP_DOWNLOAD_DEFAULT__: JSON.stringify(inkwellDesktopDownloadDefault),
  },
  plugins: [react(), tailwindcss()],
  // Use the same default host as `npm run dev` (localhost) so browser + Electron share one origin
  // (IndexedDB / localStorage). Binding only 127.0.0.1 would make `localhost:5173` a different site.
  ...(desktop ?
    {
      server: {
        port: 5173,
        strictPort: true,
      },
    }
  : {}),
})
