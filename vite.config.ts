import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const desktop = process.env.INKWELL_DESKTOP === '1'

const packageRoot = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
  version?: string
  build?: { productName?: string }
}
const productName = pkg.build?.productName ?? 'Inkwell'
const appVersion = String(pkg.version ?? '0.0.0')
const installerFilename = `${productName} Setup ${appVersion}.exe`
/** Matches `npm run print:desktop-download-url` / GitHub Releases “latest” asset pattern. */
const inkwellDesktopDownloadDefault = `https://github.com/MASK-VIII/inkwell/releases/latest/download/${encodeURIComponent(installerFilename)}`

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
